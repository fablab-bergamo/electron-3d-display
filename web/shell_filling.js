async function initLesson() {
    await Promise.all([ShellFillingBackend.load(), ShellFillingRadial.load()]);
    document.getElementById("lesson-controls").disabled = false;
    document.getElementById("loading").hidden = true;
/* Presentation is separate from the configuration model for headless validation. */
const {elements, configuration} = ShellFilling;
const text = ShellFillingLocale;
const byId = id => document.getElementById(id);
const colors = ['#31baff', '#ff9638', '#a477ff', '#32efb4', '#ff65b8', '#ffd64d', '#5de7ff'];
const atomView = ShellFillingAtom.createAtomView(byId('atom'), colors);
const requestedElement = Number(new URLSearchParams(location.search).get('z'));
let target = Number.isInteger(requestedElement) && requestedElement >= 1 && requestedElement <= elements.length ? requestedElement : 8;
let count = 0;
let timer = null;
let inspected = null;

function inspectRadial(state) {
    const occupied = state.filter(s => s.occupancy);
    const select = byId('radial-subshell');
    if (!occupied.some(s => s.label === inspected)) inspected = occupied.at(-1)?.label || null;
    select.replaceChildren(...occupied.map(s => {
        const option = document.createElement('option');
        option.value = option.textContent = s.label;
        return option;
    }));
    select.disabled = !occupied.length;
    if (inspected) select.value = inspected;
    atomView.inspect(inspected, byId('isolate').checked);
    byId('radial-model').textContent = text.radialModel(target);
    const canvas = byId('radial-chart');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!inspected) { byId('radial-nodes').textContent = text.begin; return; }
    const subshell = occupied.find(s => s.label === inspected);
    const source = ShellFillingRadial.source(target, subshell.n, subshell.ell);
    const maxRadius = source.quantile(0.999);
    const left = 34, top = 18, width = canvas.width - 52, height = canvas.height - 48;
    const samples = Array.from({length: 1001}, (_, i) => [maxRadius * i / 1000, source.density(maxRadius * i / 1000)]);
    const peak = Math.max(...samples.map(row => row[1]));
    ctx.strokeStyle = '#71829b';
    ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left, top + height); ctx.lineTo(left + width, top + height); ctx.stroke();
    ctx.strokeStyle = colors[subshell.n - 1]; ctx.lineWidth = 2;
    ctx.beginPath();
    samples.forEach(([r, density], i) => {
        const x = left + width * r / maxRadius, y = top + height * (1 - density / peak);
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = '#e9eef8'; ctx.font = '13px system-ui';
    ctx.fillText('P(r)', left + 6, 13);
    ctx.fillText('0', left, canvas.height - 10);
    ctx.textAlign = 'right'; ctx.fillText(`${(maxRadius * 52.9177210903).toFixed(1)} pm`, left + width, canvas.height - 10); ctx.textAlign = 'left';
    ctx.strokeStyle = '#e9eef8'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    source.nodes.filter(r => r < maxRadius).forEach(r => {
        const x = left + width * r / maxRadius;
        ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + height); ctx.stroke();
    });
    ctx.setLineDash([]);
    byId('radial-nodes').textContent = text.radialNodes(inspected, source.nodes.map(r => (r * 52.9177210903).toFixed(1)));
    canvas.setAttribute('aria-label', text.radialChart(inspected));
}

elements.forEach(([symbol], index) => {
    const option = document.createElement('option');
    option.value = index + 1;
    option.textContent = `${symbol} · ${text.name(index)} (${index + 1})`;
    byId('element').append(option);
});
byId('element').value = target;

function pause() {
    clearInterval(timer);
    timer = null;
    byId('play').textContent = count === target ? text.replay : text.play;
}

function render(animate = false) {
    atomView.update(count, target, animate);
    const state = configuration(count, target);
    const previous = configuration(Math.max(0, count - 1), target);
    byId('orbitals').replaceChildren();
    let active = null;
    state.forEach((subshell, rowIndex) => {
        if (!subshell.finalOccupancy) return;
        const row = document.createElement('div');
        row.className = 'row';
        row.style.setProperty('--shell', colors[subshell.n - 1]);
        const label = document.createElement('span');
        label.className = 'label';
        label.textContent = subshell.label;
        row.append(label);
        subshell.boxes.forEach((spins, boxIndex) => {
            const changed = spins !== previous[rowIndex].boxes[boxIndex];
            const box = document.createElement('span');
            box.className = 'box' + (changed ? ' active' : '');
            box.setAttribute('aria-label', `${subshell.label} ${text.orbital} ${boxIndex + 1}: ${spins.length} ${text.electrons}${spins.length === 2 ? text.opposite : ''}`);
            Array.from(spins).forEach((spin, spinIndex) => {
                const arrow = document.createElement('span');
                arrow.textContent = spin;
                if (animate && changed && spinIndex === spins.length - 1) arrow.className = 'new';
                box.append(arrow);
            });
            row.append(box);
            if (changed) active = {subshell, paired: spins.length === 2};
        });
        byId('orbitals').append(row);
    });
    byId('configuration').replaceChildren();
    state.filter(s => s.occupancy).forEach(s => {
        const segment = document.createElement('span');
        segment.style.color = colors[s.n - 1];
        segment.append(s.label);
        const superscript = document.createElement('sup');
        superscript.textContent = s.occupancy;
        segment.append(superscript, ' ');
        byId('configuration').append(segment);
    });
    for (let n = 1; n <= 7; ++n) {
        const total = state.filter(s => s.n === n).reduce((sum, s) => sum + s.occupancy, 0);
        let shell = byId('shells').children[n - 1];
        if (!shell) {
            shell = document.createElement('div');
            shell.className = 'shell';
            shell.style.setProperty('--shell', colors[n - 1]);
            const label = document.createElement('div');
            const track = document.createElement('div');
            track.className = 'track';
            const fill = document.createElement('div');
            fill.className = 'fill';
            track.append(fill);
            shell.append(label, track);
            byId('shells').append(shell);
        }
        shell.children[0].textContent = `${'KLMNOPQ'[n - 1]} · n = ${n}: ${total} / ${2 * n * n}`;
        const fill = shell.children[1].children[0];
        fill.style.width = `${100 * total / (2 * n * n)}%`;
    }
    const [symbol] = elements[target - 1];
    const languageLink = document.querySelector('nav a[hreflang]');
    if (languageLink) {
        const languageUrl = new URL(languageLink.href);
        languageUrl.searchParams.set('z', target);
        languageLink.href = languageUrl.href;
    }
    byId('progress').max = target;
    byId('progress').value = count;
    byId('progress-label').textContent = `${text.name(target - 1)} (${symbol}) · ${text.placed}: ${count} / ${target}`;
    let explanation = text.begin;
    if (active) {
        const rule = active.paired ? text.pauli : active.subshell.orbitals > 1 ? text.hund : text.aufbau;
        explanation = `${text.entry(count, active.subshell.label)} ${rule}`;
        if (count === target) explanation += ` ${text.complete(symbol)}`;
    }
    let naiveRemaining = target;
    const differs = state.map(s => {
        const expected = Math.min(naiveRemaining, 2 * s.orbitals);
        naiveRemaining -= expected;
        return expected !== s.finalOccupancy;
    }).some(Boolean);
    byId('configuration-note').textContent = [differs ? text.exception : '', target > 103 ? text.prediction : ''].filter(Boolean).join(' ');
    byId('explanation').textContent = explanation;
    byId('back').disabled = count === 0;
    byId('next').disabled = count === target;
    byId('play').textContent = timer ? text.pause : count === target ? text.replay : text.play;
    inspectRadial(state);
}

function play() {
    if (timer) { pause(); return; }
    if (count === target) { count = 0; render(); }
    timer = setInterval(() => {
        count += 1;
        if (count === target) pause();
        render(true);
    }, Number(byId('speed').value));
    byId('play').textContent = text.pause;
}

byId('play').onclick = play;
byId('next').onclick = () => { pause(); count = Math.min(target, count + 1); render(true); };
byId('back').onclick = () => { pause(); count = Math.max(0, count - 1); render(); };
byId('reset').onclick = () => { pause(); count = 0; render(); };
byId('progress').oninput = event => { pause(); count = Number(event.target.value); render(); };
byId('element').onchange = event => { pause(); target = Number(event.target.value); count = 0; render(); };
byId('speed').onchange = () => { if (timer) { pause(); play(); } };
byId('rotation').onchange = event => atomView.setRotation(event.target.checked);
byId('density').oninput = event => {
    const percent = Number(event.target.value);
    atomView.setDensity(percent);
    byId('density-value').textContent = `${percent}%`;
};
byId('radial-subshell').onchange = event => { inspected = event.target.value; inspectRadial(configuration(count, target)); };
byId('isolate').onchange = () => inspectRadial(configuration(count, target));
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
render();

}
initLesson().catch(error => {
    const italian = document.documentElement.lang === "it";
    document.getElementById("loading").textContent = (italian ? "Impossibile caricare il modello. Controlla la connessione e riprova." : "Could not load the model. Check your connection and retry.");
    const retry = document.getElementById("retry");
    retry.hidden = false;
    retry.onclick = () => location.reload();
    console.error(error);
});
