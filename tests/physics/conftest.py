"""Shared setup for the physics regression suite (see README.md here).

Puts pc/, micropython/ and tools/ on sys.path the same way the pc/ scripts
do, installs the CPython micropython shim, and loads the committed reduced
HFS tables once per session.
"""

import os
import sys

import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
for sub in ('pc', 'micropython', 'tools'):
    path = os.path.join(ROOT, sub)
    if path not in sys.path:
        sys.path.insert(0, path)

import micropython_shim  # noqa: E402,F401 -- CPython shim for @micropython.native

import hfs_tables  # noqa: E402

PM_PER_BOHR = 52.9177210903
REDUCED_NPZ = os.path.join(ROOT, 'pc', 'hfs_tables_reduced.npz')


@pytest.fixture(scope='session')
def tables():
    return hfs_tables.load(REDUCED_NPZ)


def valence_subshell(config):
    """Highest-ell subshell among the highest-n occupied ones -- the
    Clementi-Raimondi radius definition (same rule as
    tools/atom_size_calib_gen.py and pc/validate_atoms.py)."""
    n_max = max(n for n, _ell, _occ in config)
    return max(((n, ell) for n, ell, _occ in config if n == n_max), key=lambda t: t[1])
