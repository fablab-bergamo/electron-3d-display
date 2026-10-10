/* Physical radii in Bohr. Reuse the signed u=rR tables already used on-device.
 * Between grid points u is linear; integrate its square, not a smoothed density,
 * so a sign change retains its radial node. No display-size calibration is used. */
(function (root) {
    const model = root.ShellFilling || (typeof require === 'function' ? require('./shell_filling_model.js') : null);
    let tables = null;
    const cache = new Map();

    function distribution(r, u, kind) {
        if (r.length !== u.length || r.length < 2 || !Number.isFinite(r[0]) || !Number.isFinite(u[0]) || r[0] < 0) throw new Error('Invalid radial grid');
        const cdf = [0];
        const nodes = [];
        for (let i = 1; i < r.length; ++i) {
            if (!Number.isFinite(r[i]) || !Number.isFinite(u[i]) || !(r[i] > r[i - 1])) throw new Error('Invalid radial row');
            const a = u[i - 1], b = u[i];
            const area = (r[i] - r[i - 1]) * (a * a + a * b + b * b) / 3;
            cdf.push(cdf[i - 1] + area);
            if (a * b < 0) nodes.push(r[i - 1] + (r[i] - r[i - 1]) * a / (a - b));
            else if (b === 0 && i + 1 < u.length && a * u[i + 1] < 0) nodes.push(r[i]);
        }
        const norm = cdf[cdf.length - 1];
        if (!(norm > 0) || !Number.isFinite(norm)) throw new Error('Empty radial distribution');
        function interval(radius) {
            let low = 0, high = r.length - 1;
            while (high - low > 1) {
                const mid = (low + high) >> 1;
                if (r[mid] <= radius) low = mid;
                else high = mid;
            }
            return low;
        }
        const result = {kind, r, u, nodes, norm,
            density(radius) {
                if (radius < r[0] || radius > r[r.length - 1]) return 0;
                const i = interval(radius);
                const t = (radius - r[i]) / (r[i + 1] - r[i]);
                const value = u[i] + t * (u[i + 1] - u[i]);
                return value * value / norm;
            },
            quantile(probability) {
                const wanted = Math.max(0, Math.min(1, probability)) * norm;
                let low = 0, high = cdf.length - 1;
                while (high - low > 1) {
                    const mid = (low + high) >> 1;
                    if (cdf[mid] <= wanted) low = mid;
                    else high = mid;
                }
                const a = u[low], d = u[high] - a, width = r[high] - r[low];
                let left = 0, right = 1;
                for (let iteration = 0; iteration < 28; ++iteration) {
                    const t = (left + right) / 2;
                    const area = width * (a * a * t + a * d * t * t + d * d * t * t * t / 3);
                    if (cdf[low] + area < wanted) left = t;
                    else right = t;
                }
                return r[low] + width * (left + right) / 2;
            },
        };
        // Eigensolver roundoff can flip signs deep in an effectively empty tail.
        // Do not label those flips as nodes; leave the sampled distribution intact.
        result.nodes = nodes.filter(radius => radius < result.quantile(1 - 1e-8));
        return result;
    }

    function readTables(buffer) {
        const view = new DataView(buffer);
        const gridSize = view.getUint16(0, true);
        const elementCount = view.getUint16(2, true);
        const subshellCount = view.getUint16(4, true);
        const elementStart = 6 + gridSize * 4;
        const subshellStart = elementStart + elementCount * 3;
        const dataStart = subshellStart + subshellCount * 2;
        if (gridSize < 2 || elementCount !== 92 || buffer.byteLength !== dataStart + gridSize * subshellCount * 4) {
            throw new Error('Invalid shared radial table');
        }
        const r = Array.from({length: gridSize}, (_, i) => view.getFloat32(6 + i * 4, true));
        const rows = new Map();
        for (let z = 1; z <= elementCount; ++z) {
            const position = elementStart + (z - 1) * 3;
            const offset = view.getUint16(position, true), count = view.getUint8(position + 2);
            if (offset + count > subshellCount) throw new Error('Invalid radial index');
            for (let i = offset; i < offset + count; ++i) {
                const n = view.getUint8(subshellStart + i * 2), ell = view.getUint8(subshellStart + i * 2 + 1);
                const u = Array.from({length: gridSize}, (_, j) => view.getFloat32(dataStart + (i * gridSize + j) * 4, true));
                rows.set(`${z}/${n}/${ell}`, distribution(r, u, 'lda'));
            }
        }
        tables = rows;
        cache.clear();
    }

    // Screened hydrogenic fallback mirrors slater.py's Slater/n* rules.
    function effectiveCharge(z, n, ell) {
        const config = model.configuration(z, z).filter(s => s.occupancy);
        const rank = ell <= 1 ? 0 : ell;
        let same = 0, shield = 0;
        for (const s of config) {
            const otherRank = s.ell <= 1 ? 0 : s.ell;
            if (s.n === n && otherRank === rank) same += s.occupancy;
            else if (ell <= 1) {
                if (s.n === n - 1) shield += 0.85 * s.occupancy;
                else if (s.n < n - 1) shield += s.occupancy;
            } else if (s.n < n || (s.n === n && s.ell < ell)) shield += s.occupancy;
        }
        shield += (n === 1 && ell === 0 ? 0.3 : 0.35) * Math.max(0, same - 1);
        const nStar = [0, 1, 2, 3, 3.7, 4, 4.2][Math.min(n, 6)];
        return Math.max(1, z - shield) * n / nStar;
    }

    function hydrogenic(n, ell, charge) {
        const coefficients = [1];
        for (let k = 0; k + 1 < n - ell; ++k) {
            coefficients.push(-2 * (1 - (ell + k + 1) / n) / (k + 1) / (2 * ell + k + 2) * coefficients[k]);
        }
        const r = [0], u = [0];
        const maxR = 12 * n * n / charge;
        // Fine logarithmic grid resolves compact cores and diffuse outer lobes.
        for (let i = 0; i <= 4096; ++i) {
            const radius = maxR * Math.exp(-18 + 18 * i / 4096);
            const x = charge * radius;
            let polynomial = coefficients[coefficients.length - 1];
            for (let k = coefficients.length - 2; k >= 0; --k) polynomial = polynomial * x + coefficients[k];
            r.push(radius);
            u.push(radius * polynomial * x ** ell * Math.exp(-x / n));
        }
        return distribution(r, u, charge === 1 && n === 1 ? 'hydrogen' : 'screened');
    }

    function source(z, n, ell) {
        const key = `${z}/${n}/${ell}`;
        if (!cache.has(key)) {
            if (z === 1) cache.set(key, hydrogenic(n, ell, 1));
            else if (z <= 92) {
                const row = tables?.get(key);
                if (!row) throw new Error(`Missing calculated radial data: ${key}`);
                cache.set(key, row);
            } else cache.set(key, hydrogenic(n, ell, effectiveCharge(z, n, ell)));
        }
        return cache.get(key);
    }

    async function load() {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch('../micropython/hfs_tables.bin', {signal: controller.signal});
            if (!response.ok) throw new Error(`Radial data: HTTP ${response.status}`);
            readTables(await response.arrayBuffer());
        } finally { clearTimeout(timeout); }
    }
    const api = {load, readTables, source, distribution, hydrogenic, effectiveCharge};
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.ShellFillingRadial = api;
})(globalThis);
