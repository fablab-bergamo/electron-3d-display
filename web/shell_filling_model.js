/* Configuration construction for a selected neutral atom. Equivalent orbitals
 * are filled singly before pairing; intermediate steps are teaching states. */
(function (root) {
    const subshells = [];
    for (let n = 1; n <= 7; ++n) {
        for (let ell = 0; ell <= Math.min(3, n - 1); ++ell) {
            if (n + ell > 8) continue;
            subshells.push({label: `${n}${'spdf'[ell]}`, n, ell, orbitals: 2 * ell + 1});
        }
    }
    subshells.sort((a, b) => a.n + a.ell - b.n - b.ell || a.n - b.n);
    const elements = 'H Hydrogen,He Helium,Li Lithium,Be Beryllium,B Boron,C Carbon,N Nitrogen,O Oxygen,F Fluorine,Ne Neon,Na Sodium,Mg Magnesium,Al Aluminium,Si Silicon,P Phosphorus,S Sulfur,Cl Chlorine,Ar Argon,K Potassium,Ca Calcium'
        .split(',').map(entry => entry.split(' '));

    let reference = null;
    const groundStates = new Map();
    function groundState(z) {
        if (!Number.isInteger(z) || z < 1 || z > 118) throw new RangeError('Atomic number must be 1..118');
        if (!groundStates.has(z)) {
            if (!reference && z > 20) throw new Error('The shared physics model is not loaded');
            let remaining = z;
            const occupancies = reference ? reference.configuration(z) : subshells.map(s => {
                const occupancy = Math.min(remaining, s.orbitals * 2);
                remaining -= occupancy;
                return [s.n, s.ell, occupancy];
            });
            groundStates.set(z, subshells.map(s => occupancies.find(([n, ell]) => n === s.n && ell === s.ell)?.[2] || 0));
        }
        return groundStates.get(z);
    }

    function configuration(count, target = Math.max(1, count)) {
        if (!Number.isInteger(count) || count < 0 || count > target) throw new RangeError('Electron count must be 0..target');
        const final = groundState(target);
        let remaining = count;
        return subshells.map((subshell, index) => {
            const occupancy = Math.min(remaining, final[index]);
            remaining -= occupancy;
            const boxes = Array.from({length: subshell.orbitals}, (_, index) =>
                (index < occupancy ? '↑' : '') +
                (index < occupancy - subshell.orbitals ? '↓' : ''));
            return {...subshell, occupancy, finalOccupancy: final[index], boxes};
        });
    }

    function useReference(model) {
        reference = model;
        groundStates.clear();
        for (let z = 1; z <= 118; ++z) {
            elements[z - 1] = [model.symbol(z), elements[z - 1]?.[1] || `Z = ${z}`];
        }
    }

    const api = {subshells, elements, configuration, useReference,
        nameItalian: z => reference?.nameItalian(z), groundState};
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.ShellFilling = api;
})(globalThis);
