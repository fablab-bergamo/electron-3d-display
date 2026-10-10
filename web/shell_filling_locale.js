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
        nucleus: italian ? 'Inizia dal nucleo' : 'Start with the nucleus',
        atomLabel: (target, count) => italian ? `${ShellFilling.nameItalian(target) || names[target - 1]}: ${count} di ${target} elettroni; nuvole schematiche di probabilità colorate per guscio` : `${ShellFilling.elements[target - 1][0]} construction: ${count} of ${target} electrons; shell-colored schematic probability clouds`,
        exception: italian ? 'La configurazione dell’elemento scelto differisce dal semplice ordine di Madelung; il riempimento segue le sue occupazioni finali.' : 'This element differs from the simple Madelung order; construction follows its final subshell occupancies.',
        prediction: italian ? 'Per gli elementi più pesanti il modello usa configurazioni previste.' : 'For the heaviest elements the model uses predicted configurations.',
    };
})();
