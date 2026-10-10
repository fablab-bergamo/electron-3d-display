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
const clouds=electronClouds();
assert.equal(clouds.length,118);
clouds.forEach(c=>assert(c.points.every(point=>point.every(Number.isFinite))));
console.log('All 118 configurations, every construction step, exceptions and s/p/d/f angular sampling passed.');
