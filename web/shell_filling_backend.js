/* Read shared literal data without evaluating Python or downloading a runtime. */
const ShellFillingBackend = {
    fromSource(source) {
        function words(name) {
            const block = source.match(new RegExp(`^${name} = \\(([\\s\\S]*?)^\\)\\.split\\(\\)`, 'm'))?.[1];
            if (!block) throw new Error(`Missing shared data: ${name}`);
            const strings = block.match(/"[^"\\\r\n]*"/g);
            if (!strings || block.replace(/"[^"\\\r\n]*"/g, '').trim()) throw new Error(`Unsupported shared data: ${name}`);
            return strings.map(value => JSON.parse(value)).join('').trim().split(/\s+/);
        }
        const symbols = words('_ELEMENT_SYMBOLS');
        const names = words('_ELEMENT_NAMES_IT');
        const block = source.match(/^_CONFIG_EXCEPTIONS = \{([\s\S]*?)^\}/m)?.[1];
        if (block === undefined || symbols.length !== 118 || names.length !== 118) throw new Error('Incomplete shared data');
        const numeric = block.replace(/#[^\r\n]*/g, '');
        if (!/^[\d\s:,()[\]]*$/.test(numeric)) throw new Error('Unsupported exception data');
        const exceptions = JSON.parse('{' + numeric.replace(/(\d+)\s*:/g, '"$1":')
            .replace(/\(/g, '[').replace(/\)/g, ']').replace(/,\s*$/, '') + '}');
        const model = {
            configuration(z) {
                if (!Number.isInteger(z) || z < 1 || z > 118) throw new RangeError('Atomic number must be 1..118');
                if (exceptions[z]) return exceptions[z].map(row => row.slice());
                let remaining = z;
                return ShellFilling.subshells.map(s => {
                    const occupancy = Math.min(remaining, 2 * s.orbitals);
                    remaining -= occupancy;
                    return [s.n, s.ell, occupancy];
                }).filter(row => row[2]);
            },
            symbol: z => symbols[z - 1],
            nameItalian: z => names[z - 1],
        };
        for (let z = 1; z <= 118; ++z) {
            const rows = model.configuration(z);
            if (rows.reduce((sum, row) => sum + row[2], 0) !== z || rows.some(([n, ell, occ]) =>
                !ShellFilling.subshells.some(s => s.n === n && s.ell === ell) || occ < 1 || occ > 2 * (2 * ell + 1))) {
                throw new Error(`Invalid shared configuration: ${z}`);
            }
        }
        return model;
    },
    async load() {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch('../micropython/slater.py', {signal: controller.signal});
            if (!response.ok) throw new Error(`Physics model: HTTP ${response.status}`);
            ShellFilling.useReference(this.fromSource(await response.text()));
        } finally {
            clearTimeout(timeout);
        }
    },
};
if (typeof module !== 'undefined' && module.exports) module.exports = ShellFillingBackend;
