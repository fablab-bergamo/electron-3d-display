# Physics regression checks

Run on every push/PR touching the physics, data or viewers by
`.github/workflows/physics.yml`; run locally with

```bash
pip install numpy scipy pytest
python3 -m pytest tests/physics -v
python3 pc/validate_atoms.py --model hfs --all --strict --ratio 0.7 1.4 --tables pc/hfs_tables_reduced.npz
```

The checks compare against physics that doesn't depend on this project's
own code (closed-form hydrogen, an independent LDA solve, the 1/Z scaling of
1s orbitals, literature radii), so a self-consistent mistake -- like the
r²·R export that kept eigenvalues exact and every row normalized while
doubling the 1s radius -- still fails.

| File | What it checks |
|---|---|
| `test_hydrogenic.py` | Shared hydrogenic radial code: peak radii (n²/Z, (3+√5)/Z) and ⟨r⟩ = (3n²−ℓ(ℓ+1))/2Z exactly; the isotropic sampler reproduces ⟨r⟩. |
| `test_hfs_tables.py` | `pc/hfs_tables_reduced.npz`: rows normalized, eigenvalues ordered, Z·r_peak(1s) ≈ 1, raw valence radius within 0.7–1.4× Clementi-Raimondi, H/He orbitals match an independent LDA solve, sampled point clouds (PC/web/MicroPython path) follow the tables. |
| `test_generated_in_sync.py` | `data/` + `micropython/` binaries, `src/physics/hfs_tables.h`, `atom_size_calib.h` regenerate identically from the npz; calibrated valence peak = Clementi-Raimondi radius. |
| `test_device_physics.py` | `src/physics/{atom_cloud,hfs_radial,pointcloud}.cpp` built for the host (stubs in `host/stubs/`, `data/hfs_tables.bin` via `$HFS_TABLES_BIN`): the device's bounding circle is the Clementi-Raimondi radius for all 92 elements, on the valence subshell. |

When a check fails after an intentional model change, fix the data or code
first; widen a tolerance only with the physical reason written next to it.
