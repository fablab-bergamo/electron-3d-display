// Run with: node web/shell_filling_model.test.js
const assert = require('node:assert/strict');
const {configuration} = require('./shell_filling_model.js');
const model = require('./shell_filling_model.js');
const {spawnSync} = require('node:child_process');
const path = require('node:path');
const result = spawnSync('python3', ['-c', "import sys,json;sys.path.insert(0,'micropython');import slater;print(json.dumps([slater.electron_configuration(z) for z in range(1,119)]))"], {cwd: path.resolve(__dirname, '..'), encoding: 'utf8'});
assert.equal(result.status, 0, result.stderr);
const references = JSON.parse(result.stdout);
globalThis.ShellFilling = model;
const backend = require('./shell_filling_backend.js');
const source = require('node:fs').readFileSync(path.resolve(__dirname, '../micropython/slater.py'), 'utf8');
const shared = backend.fromSource(source);
for (let z = 1; z <= 118; ++z) assert.deepEqual(shared.configuration(z), references[z - 1]);
assert.equal(shared.symbol(118), 'Og');
assert.equal(shared.nameItalian(118), 'Oganesson');
assert.throws(() => backend.fromSource(source.replace('_CONFIG_EXCEPTIONS = {', '_CONFIG_EXCEPTIONS = {alert(1),')));
assert.throws(() => backend.fromSource(source.replace('_ELEMENT_SYMBOLS = (', '_ELEMENT_SYMBOLS = (unknown,')));
model.useReference(shared);

for (let count = 0; count <= 20; ++count) {
    const state = configuration(count);
    assert.equal(state.reduce((sum, s) => sum + s.occupancy, 0), count);
    for (const subshell of state) {
        assert.equal(subshell.boxes.join('').length, subshell.occupancy);
        assert(subshell.boxes.every(box => ['', '↑', '↑↓'].includes(box)));
        if (subshell.boxes.some(box => box === '↑↓')) {
            assert(subshell.boxes.every(box => box.length >= 1), 'Hund: no pairing with empty orbitals');
        }
    }
    if (count > 0) {
        const before = configuration(count - 1);
        assert.equal(state.filter((s, i) => s.occupancy !== before[i].occupancy).length, 1);
    }
}
assert.deepEqual(configuration(7)[2].boxes, ['↑', '↑', '↑']);
assert.deepEqual(configuration(8)[2].boxes, ['↑↓', '↑', '↑']);
assert.deepEqual(configuration(10)[2].boxes, ['↑↓', '↑↓', '↑↓']);
assert.deepEqual(configuration(20).filter(s => s.occupancy).map(s => s.occupancy), [2, 2, 6, 2, 6, 2]);
for (let target = 1; target <= 118; ++target) {
    const final = configuration(target, target).filter(s => s.occupancy).map(s => [s.n, s.ell, s.occupancy]);
    const expected = references[target - 1].slice().sort((a,b) => a[0]+a[1]-b[0]-b[1] || a[0]-b[0]);
    assert.deepEqual(final, expected, `Shared neutral configuration Z=${target}`);
    for (let count = 0; count <= target; ++count) {
        const state = configuration(count, target);
        assert.equal(state.reduce((sum,s) => sum+s.occupancy,0),count);
        state.forEach(s => {
            assert(s.occupancy <= s.finalOccupancy);
            assert.equal(s.boxes.join('').length,s.occupancy);
            assert(s.boxes.every(box => ['', '↑', '↑↓'].includes(box)));
            if (s.boxes.some(box => box.length === 2)) assert(s.boxes.every(box => box.length >= 1));
        });
    }
}
assert.equal(configuration(24,24).find(s=>s.label==='4s').occupancy,1);
assert.equal(configuration(24,24).find(s=>s.label==='3d').occupancy,5);
assert.equal(configuration(46,46).find(s=>s.label==='5s').occupancy,0);
assert.equal(configuration(103,103).find(s=>s.label==='7p').occupancy,1);
for (const invalid of [-1, 119, 1.5, NaN, '8']) {
    assert.throws(() => configuration(invalid), RangeError);
}
const {angularWeight, electronClouds} = require('./shell_filling_atom.js');
for (let ell = 0; ell <= 3; ++ell) {
    for (let z = -1; z <= 1; z += 0.1) {
        for (let phi=0;phi<6.28;phi+=0.3) {
            let sum=0;
            for(let m=-ell;m<=ell;++m) {
                const weight=angularWeight(ell,m,z,phi);
                assert(weight>=0 && weight<=1+1e-12);
                sum+=weight;
            }
            assert(Math.abs(sum-1)<1e-10, 'Normalized real harmonics obey the addition theorem');
        }
    }
}
const radial = require('./shell_filling_radial.js');
const bytes = require('node:fs').readFileSync(path.resolve(__dirname, '../micropython/hfs_tables.bin'));
radial.readTables(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
for (let z = 1; z <= 118; ++z) {
    for (const s of configuration(z, z).filter(s => s.occupancy)) {
        const row = radial.source(z, s.n, s.ell);
        assert.equal(row.nodes.length, s.n - s.ell - 1, `Radial node count Z=${z} ${s.label}`);
        row.nodes.forEach(r => assert(row.density(r) < 1e-16, 'A node has zero radial probability'));
        let before = 0;
        for (let i = 0; i <= 100; ++i) {
            const r = row.quantile(i / 100);
            assert(Number.isFinite(r) && r >= before);
            before = r;
        }
    }
}
const hydrogen = radial.source(1, 1, 0);
const exactGridNode = radial.distribution([0, 1, 2], [1, 0, -1], 'test');
assert.deepEqual(exactGridNode.nodes, [1]);
assert.equal(exactGridNode.density(1), 0);
assert(Math.abs(exactGridNode.norm - 2 / 3) < 1e-12);
let mean = 0;
for (let i = 0; i < 10000; ++i) mean += hydrogen.quantile((i + 0.5) / 10000) / 10000;
assert(Math.abs(mean - 1.5) < 0.001, 'Hydrogen 1s mean radius is 1.5 Bohr');
for (const p of [0.1, 0.5, 0.9, 0.99]) {
    const r = hydrogen.quantile(p);
    const exact = 1 - Math.exp(-2 * r) * (1 + 2 * r + 2 * r * r);
    assert(Math.abs(exact - p) < 0.00002, 'Hydrogen radial quantiles match the analytic CDF');
}
const twoS = radial.hydrogenic(2, 0, 1);
assert(Math.abs(twoS.nodes[0] - 2) < 0.0001, 'Hydrogen 2s node is at 2 Bohr');
const charges = spawnSync('python3', ['-c', "import sys,json;sys.path.insert(0,'micropython');import slater;print(json.dumps([[z,n,l,slater.z_eff_radial(z,slater.electron_configuration(z),n,l)] for z in range(93,119) for n,l,occ in slater.electron_configuration(z)]))"], {cwd: path.resolve(__dirname, '..'), encoding: 'utf8'});
assert.equal(charges.status, 0, charges.stderr);
for (const [z, n, ell, expected] of JSON.parse(charges.stdout)) {
    assert(Math.abs(radial.effectiveCharge(z, n, ell) - expected) < 1e-10, 'Heavy-element screening matches Python');
}
assert.throws(() => radial.readTables(new ArrayBuffer(6)));
assert.throws(() => radial.distribution([0, 1], [0, NaN], 'test'));
const clouds=electronClouds(118);
assert.equal(clouds.length,118);
clouds.forEach(c=>assert(c.points.every(point=>point.every(Number.isFinite))));
console.log('All 118 configurations, construction steps, radial nodes, hydrogen quantiles, screening and angular sampling passed.');
