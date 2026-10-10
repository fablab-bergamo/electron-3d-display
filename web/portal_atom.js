/* Rotate the shared model's sampled carbon cloud, without a Python startup. */
(() => {
    const canvas = document.getElementById('portal-atom');
    const context = canvas?.getContext('2d');
    if (!context || !PortalAtomPoints.length) return;
    const fallback = document.getElementById('portal-atom-fallback');
    const toggle = document.getElementById('portal-rotation');
    const italian = document.documentElement.lang === 'it';
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const sprites = ['#31baff', '#ff9638'].map(color => {
        const sprite = document.createElement('canvas');
        sprite.width = sprite.height = 20;
        const brush = sprite.getContext('2d');
        const glow = brush.createRadialGradient(10, 10, 0, 10, 10, 10);
        glow.addColorStop(0, '#fff');
        glow.addColorStop(0.15, color);
        glow.addColorStop(0.4, color + '60');
        glow.addColorStop(1, color + '00');
        brush.fillStyle = glow;
        brush.fillRect(0, 0, 20, 20);
        return sprite;
    });
    let running = !preference.matches;
    let visible = true;
    let time = 0;
    let last = null;
    let frame = null;

    function draw(now) {
        frame = null;
        if (last !== null && running) time += Math.min(now - last, 60);
        last = now;
        const yaw = 0.4 + time * 0.0003;
        const tilt = 0.35 + 0.22 * Math.sin(time * 0.00016);
        const roll = 0.15 * Math.sin(time * 0.0001);
        context.globalCompositeOperation = 'source-over';
        context.globalAlpha = 1;
        context.fillStyle = '#080e18';
        context.fillRect(0, 0, 480, 480);
        context.globalCompositeOperation = 'lighter';
        for (const [x, y, z, shell] of PortalAtomPoints) {
            const rx = x * Math.cos(yaw) + z * Math.sin(yaw);
            const rz = z * Math.cos(yaw) - x * Math.sin(yaw);
            const ry = y * Math.cos(tilt) - rz * Math.sin(tilt);
            const depth = y * Math.sin(tilt) + rz * Math.cos(tilt);
            const px = rx * Math.cos(roll) - ry * Math.sin(roll);
            const py = rx * Math.sin(roll) + ry * Math.cos(roll);
            const near = Math.max(0, Math.min(1, (depth + 1) / 2));
            const size = 3.5 + 2.5 * near;
            context.globalAlpha = 0.45 + 0.4 * near;
            context.drawImage(sprites[shell - 1], 240 + px * 190 - size / 2,
                240 + py * 190 - size / 2, size, size);
        }
        context.globalAlpha = 1;
        context.globalCompositeOperation = 'source-over';
        const nucleus = context.createRadialGradient(240, 240, 0, 240, 240, 12);
        nucleus.addColorStop(0, '#fff6e8');
        nucleus.addColorStop(0.3, '#ffba72');
        nucleus.addColorStop(1, '#ffba7200');
        context.fillStyle = nucleus;
        context.fillRect(228, 228, 24, 24);
        canvas.hidden = false;
        fallback.hidden = true;
        if (running && visible && !document.hidden) frame = requestAnimationFrame(draw);
    }

    function refresh() {
        if (frame !== null) cancelAnimationFrame(frame);
        last = null;
        frame = requestAnimationFrame(draw);
        toggle.textContent = running ? (italian ? 'Ferma la rotazione' : 'Pause rotation') : (italian ? 'Ruota l’atomo' : 'Rotate atom');
        toggle.setAttribute('aria-pressed', String(running));
    }
    toggle.hidden = false;
    toggle.onclick = () => { running = !running; refresh(); };
    preference.addEventListener('change', () => { running = !preference.matches; refresh(); });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { if (frame !== null) cancelAnimationFrame(frame); frame = null; last = null; }
        else refresh();
    });
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(entries => {
            visible = entries[0].isIntersecting;
            if (visible) refresh();
            else { if (frame !== null) cancelAnimationFrame(frame); frame = null; last = null; }
        }).observe(canvas.parentElement);
    }
    refresh();
})();
