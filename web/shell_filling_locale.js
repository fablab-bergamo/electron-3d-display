/* Shared interaction strings for the English and Italian lessons. */
const ShellFillingLocale = (() => {
    const italian = document.documentElement.lang === 'it';
    const names = 'Idrogeno Elio Litio Berillio Boro Carbonio Azoto Ossigeno Fluoro Neon Sodio Magnesio Alluminio Silicio Fosforo Zolfo Cloro Argon Potassio Calcio'.split(' ');
    return {
        name: index => italian ? ShellFilling.nameItalian(index + 1) || names[index] : ShellFilling.elements[index][1],
        play: italian ? 'Avvia' : 'Play',
        pause: italian ? 'Pausa' : 'Pause',
        replay: italian ? 'Ripeti' : 'Replay',
        electrons: italian ? 'elettroni' : 'electrons',
        opposite: italian ? ', spin opposti' : ', opposite spins',
        orbital: italian ? 'orbitale' : 'orbital',
        placed: italian ? 'Elettroni inseriti' : 'Electrons placed',
        begin: italian ? 'Premi Avvia o + Elettrone per iniziare da 1s.' : 'Press Play or + Electron to begin filling 1s.',
        pauli: italian ? 'Pauli: aggiungi lo spin opposto in un orbitale già occupato.' : 'Pauli: pair with opposite spin in an occupied orbital.',
        hund: italian ? 'Hund: occupa un orbitale vuoto del sottolivello prima di formare coppie.' : 'Hund: occupy an empty orbital in this subshell before pairing.',
        aufbau: italian ? 'Aufbau: inizia il prossimo sottolivello disponibile nell’ordine di riempimento.' : 'Aufbau: begin the next available subshell in the filling order.',
        entry: (count, label) => italian ? `L’elettrone ${count} entra in ${label}.` : `Electron ${count} enters ${label}.`,
        complete: symbol => italian ? `La configurazione fondamentale di ${symbol} è completa.` : `${symbol} ground-state configuration is complete.`,
        latest: label => italian ? `Ultimo sottolivello: ${label}` : `Latest contribution: ${label}`,
        inspected: label => italian ? `Sottolivello isolato: ${label}` : `Isolated subshell: ${label}`,
        nucleus: italian ? 'Inizia dal nucleo' : 'Start with the nucleus',
        atomLabel: (target, count) => italian ? `${ShellFilling.nameItalian(target) || names[target - 1]}: ${count} di ${target} elettroni; nuvole calcolate di probabilità colorate per guscio` : `${ShellFilling.elements[target - 1][0]} construction: ${count} of ${target} electrons; calculated shell-colored probability clouds`,
        radialModel: z => italian ? (z === 1 ? 'Idrogeno: soluzione esatta dell’equazione di Schrödinger non relativistica.' : z <= 92 ? 'Orbitali calcolati con il modello LDA del progetto: includono lo schermaggio degli altri elettroni. È un’approssimazione quantistica, senza correzioni relativistiche.' : 'Oltre l’uranio: orbitali idrogenoidi con schermaggio secondo Slater; un’approssimazione meno precisa degli orbitali calcolati per He–U.') : (z === 1 ? 'Hydrogen: exact nonrelativistic Schrödinger solution.' : z <= 92 ? 'Calculated orbitals from the project’s LDA model include screening by other electrons. This is a quantum approximation, without relativistic corrections.' : 'Beyond uranium: hydrogen-like orbitals with Slater screening; less accurate than the calculated He–U orbitals.'),
        radialNodes: (label, positions) => italian ? `${label}: ${positions.length} ${positions.length === 1 ? 'nodo radiale' : 'nodi radiali'}${positions.length ? ' a ' + positions.join(', ') + ' pm' : ''}.` : `${label}: ${positions.length} radial ${positions.length === 1 ? 'node' : 'nodes'}${positions.length ? ' at ' + positions.join(', ') + ' pm' : ''}.`,
        radialChart: label => italian ? `Probabilità radiale del sottolivello ${label}; distanza in picometri` : `${label} radial probability; distance in picometres`,
        exception: italian ? 'La configurazione dell’elemento scelto differisce dal semplice ordine di Madelung; il riempimento segue le sue occupazioni finali.' : 'This element differs from the simple Madelung order; construction follows its final subshell occupancies.',
        prediction: italian ? 'Per gli elementi più pesanti il modello usa configurazioni previste.' : 'For the heaviest elements the model uses predicted configurations.',
    };
})();
