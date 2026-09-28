"""Generated data must match its sources, and the size calibration must do
what it claims.

data/hfs_tables.bin, micropython/hfs_tables.bin, src/physics/hfs_tables.h,
src/physics/atom_size_calib.h and micropython/hfs_atom_size_calib.py are all
generated from pc/hfs_tables_reduced.npz by tools/hfs_table_gen.py and
tools/atom_size_calib_gen.py (AGENTS.md: never hand-edited). Regenerating
in memory and comparing catches a table fix that wasn't propagated to the
devices, or a hand edit.
"""

import os
import re

import pytest

import atom_size_calib_gen
import clementi_radii
import hfs_atom_size_calib
import hfs_table_gen

from conftest import PM_PER_BOHR, ROOT, valence_subshell


def read_text(relpath):
    with open(os.path.join(ROOT, relpath), 'rb') as f:
        return f.read().decode('utf-8').replace('\r\n', '\n')


def read_bytes(relpath):
    with open(os.path.join(ROOT, relpath), 'rb') as f:
        return f.read()


@pytest.fixture(scope='module')
def table_factors(tables):
    return atom_size_calib_gen.compute_table_factors(tables)


def test_hfs_binary_blobs_in_sync(tables):
    r, elements, subshells, u_rows = hfs_table_gen.build_flat(tables)
    blob = hfs_table_gen.emit_binary(r, elements, subshells, u_rows)
    assert read_bytes('data/hfs_tables.bin') == blob, "rerun tools/hfs_table_gen.py"
    assert read_bytes('micropython/hfs_tables.bin') == blob, "rerun tools/hfs_table_gen.py"
    assert read_text('src/physics/hfs_tables.h') == hfs_table_gen.emit_header(len(r), len(elements), len(subshells))


def test_size_calibration_tables_in_sync(table_factors):
    assert read_text('src/physics/atom_size_calib.h') == atom_size_calib_gen.emit_header(table_factors), \
        "rerun tools/atom_size_calib_gen.py"
    header_values = [float(v) for v in re.findall(r'orb_real_t\(([0-9.]+)\)', read_text('src/physics/atom_size_calib.h'))]
    assert header_values == pytest.approx(list(hfs_atom_size_calib.FACTOR), abs=1e-4)


def test_calibrated_valence_peak_equals_clementi_raimondi(tables, table_factors):
    """factor * valence peak radius == literature radius -- what the drawn
    bounding circle shows on every port."""
    for z in tables.z_list:
        lit = clementi_radii.CLEMENTI_RADIUS_PM.get(z)
        if not lit:
            continue
        n, ell = valence_subshell(tables.config(z))
        shown = tables.source(z, n, ell).mode_radius() * PM_PER_BOHR * table_factors[z - 1]
        assert shown == pytest.approx(lit, rel=5e-3), "Z=%d" % z
