"""The firmware's own radial physics (src/physics/*.cpp), built for the host.

Compiles src/physics/atom_cloud.cpp + hfs_radial.cpp + pointcloud.cpp
unmodified against the stubs in host/stubs/, feeding it the committed
data/hfs_tables.bin, and checks what atom_view.cpp would draw for every
element: the bounding circle (outer subshell's peak radius) must be the
Clementi-Raimondi radius, the outer subshell must be the valence one, and
the framing radius (p90) must enclose the circle. Skipped when no C++
compiler is available.
"""

import math
import os
import shutil
import subprocess

import pytest

import clementi_radii
import slater

from conftest import ROOT, valence_subshell

HOST_DIR = os.path.join(os.path.dirname(__file__), 'host')
SOURCES = ['src/physics/atom_cloud.cpp', 'src/physics/hfs_radial.cpp', 'src/physics/pointcloud.cpp']


@pytest.fixture(scope='module')
def device_output(tmp_path_factory):
    cxx = os.environ.get('CXX') or shutil.which('g++') or shutil.which('clang++')
    if cxx is None:
        pytest.skip('no C++ compiler')
    exe = str(tmp_path_factory.mktemp('host') / 'device_physics')
    cmd = [cxx, '-std=gnu++23', '-O2', '-Wall', '-Wextra', '-Werror', '-fconstexpr-ops-limit=100000000',
           '-I', os.path.join(HOST_DIR, 'stubs'), '-I', os.path.join(ROOT, 'src'),
           '-include', os.path.join(HOST_DIR, 'stubs', 'host_fopen.h'),
           os.path.join(HOST_DIR, 'device_physics.cpp')] + [os.path.join(ROOT, s) for s in SOURCES] + ['-o', exe]
    subprocess.run(cmd, check=True)
    env = dict(os.environ, HFS_TABLES_BIN=os.path.join(ROOT, 'data', 'hfs_tables.bin'))
    result = subprocess.run([exe], check=True, capture_output=True, text=True, env=env)
    assert 'hfs tables ready' in result.stderr, "device code fell back to the hydrogenic model:\n" + result.stderr
    return [line.split() for line in result.stdout.splitlines()]


def test_hydrogenic_peak_radius_exact(device_output):
    exact = {(1, 0): 1.0, (2, 1): 4.0, (3, 2): 9.0, (2, 0): 3.0 + math.sqrt(5.0)}
    rows = [r for r in device_output if r[0] == 'hydrogenic']
    assert len(rows) == len(exact)
    for _tag, n, ell, peak in rows:
        assert float(peak) == pytest.approx(exact[(int(n), int(ell))], rel=2e-3)


def test_bounding_circle_is_clementi_raimondi_radius(device_output):
    rows = [r for r in device_output if r[0] == 'atom']
    assert len(rows) == 92
    for _tag, z, n, ell, peak_pm, p90_pm in rows:
        z, n, ell, peak_pm, p90_pm = int(z), int(n), int(ell), float(peak_pm), float(p90_pm)
        symbol = slater.element_symbol(z)
        assert (n, ell) == valence_subshell(slater.electron_configuration(z)), \
            "%s: device's outer subshell %d%s is not the valence one" % (symbol, n, 'spdf'[ell])
        lit = clementi_radii.CLEMENTI_RADIUS_PM.get(z)
        if lit:
            assert peak_pm == pytest.approx(lit, rel=1e-2), symbol
        assert 1.2 * peak_pm < p90_pm < 4.0 * peak_pm, symbol
