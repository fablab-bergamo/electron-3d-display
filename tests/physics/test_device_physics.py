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
import numpy as np

import clementi_radii
import slater
import pointcloud
import atom_size_calib
import hfs_atom_size_calib

from conftest import ROOT, valence_subshell

HOST_DIR = os.path.join(os.path.dirname(__file__), 'host')
SOURCES = ['src/physics/atom_cloud.cpp', 'src/physics/hfs_radial.cpp', 'src/physics/pointcloud.cpp']


@pytest.fixture(scope='module')
def device_executable(tmp_path_factory):
    cxx = os.environ.get('CXX') or shutil.which('g++') or shutil.which('clang++')
    if cxx is None:
        pytest.skip('no C++ compiler')
    exe = str(tmp_path_factory.mktemp('host') / 'device_physics')
    cmd = [cxx, '-std=gnu++23', '-O2', '-Wall', '-Wextra', '-Werror', '-fconstexpr-ops-limit=100000000',
           '-I', os.path.join(HOST_DIR, 'stubs'), '-I', os.path.join(ROOT, 'src'),
           '-include', os.path.join(HOST_DIR, 'stubs', 'host_fopen.h'),
           os.path.join(HOST_DIR, 'device_physics.cpp')] + [os.path.join(ROOT, s) for s in SOURCES] + ['-o', exe]
    subprocess.run(cmd, check=True)
    return exe


def run_device(exe, asset, *args):
    env = dict(os.environ, HFS_TABLES_BIN=str(asset))
    return subprocess.run([exe, *args], check=True, capture_output=True, text=True, env=env)


@pytest.fixture(scope='module')
def device_output(device_executable):
    result = run_device(device_executable, os.path.join(ROOT, 'data', 'hfs_tables.bin'))
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


def test_device_uniform_density_quantiles(device_executable):
    result = run_device(device_executable, os.path.join(ROOT, 'data', 'hfs_tables.bin'), 'sampling')
    uniform = [float(line.split()[2]) for line in result.stdout.splitlines() if line.startswith('uniform ')]
    assert uniform == pytest.approx([0, 0.25, 0.5, 0.75, 1], abs=1e-7)


def test_device_contracted_open_shell_cdf(device_executable, tables):
    result = run_device(device_executable, os.path.join(ROOT, 'data', 'hfs_tables.bin'), 'sampling')
    for z, n, ell in [(1, 1, 0), (26, 3, 2), (69, 4, 3)]:
        rows = [line.split() for line in result.stdout.splitlines()
                if line.startswith('quantile %d %d %d ' % (z, n, ell))]
        assert len(rows) == 999
        q = np.array([float(r[6]) for r in rows])
        # Occupancy must not change the radial marginal.
        assert q == pytest.approx([float(r[5]) for r in rows], abs=1e-7)
        src = tables.source(z, n, ell)
        fine = np.geomspace(src.r[0], src.r[-1], 200000)
        w = np.interp(fine, src.r, src.u.astype(float)) ** 2
        cdf = np.r_[0, np.cumsum(0.5 * (w[:-1] + w[1:]) * np.diff(fine))]
        cdf /= cdf[-1]
        # <1 percentage point across the bulk; old Tm 4f discrepancy was 6.74 points.
        assert np.max(np.abs(np.interp(q, fine, cdf) - np.arange(1, 1000) / 1000)) < 0.01
        assert q[499] == pytest.approx(np.interp(0.5, cdf, fine), rel=0.01)


def test_device_tm_cloud_median(device_output, tables):
    from test_hfs_tables import table_quantile
    row = next(r for r in device_output if r[:4] == ['subshell', '69', '4', '3'])
    expected_pm = table_quantile(tables, 69, 4, 3, 0.5) * 52.9177210903 * hfs_atom_size_calib.FACTOR[68]
    assert float(row[5]) == pytest.approx(expected_pm, rel=0.03)


@pytest.fixture(scope='module')
def missing_asset_output(device_executable, tmp_path_factory):
    result = run_device(device_executable, tmp_path_factory.mktemp('missing') / 'absent.bin')
    assert 'fallback' in result.stderr and 'hfs tables ready' not in result.stderr
    return [line.split() for line in result.stdout.splitlines()]


def test_device_missing_asset_calibration(missing_asset_output):
    rows = [r for r in missing_asset_output if r[0] == 'subshell']
    assert len(rows) == 915
    for _tag, z, n, ell, peak_pm, _median_pm in rows:
        z, n, ell = int(z), int(n), int(ell)
        config = slater.electron_configuration(z)
        zeff = slater.z_eff_radial(z, config, n, ell)
        expected_pm = (pointcloud.radial_mode_radius(n, ell, zeff, resolution=20001)
                       * 52.9177210903 * atom_size_calib.FACTOR[z - 1])
        assert float(peak_pm) == pytest.approx(expected_pm, rel=0.01), (z, n, ell)
        if (n, ell) == valence_subshell(config) and z in clementi_radii.CLEMENTI_RADIUS_PM:
            assert float(peak_pm) == pytest.approx(clementi_radii.CLEMENTI_RADIUS_PM[z], rel=0.01)


def test_device_missing_asset_point_scale(missing_asset_output):
    # Independent analytic 1s CDF: 1-exp(-2r)*(1+2r+2r^2).
    r = np.linspace(0, 10, 100001)
    cdf = 1 - np.exp(-2 * r) * (1 + 2 * r + 2 * r * r)
    median_pm = np.interp(0.5, cdf, r) * 52.9177210903 * atom_size_calib.FACTOR[0]
    row = next(r for r in missing_asset_output if r[:4] == ['subshell', '1', '1', '0'])
    assert float(row[5]) == pytest.approx(median_pm, rel=0.03)


def test_device_partial_read_uses_one_model(device_executable, missing_asset_output, device_output, tmp_path):
    # Keep every header/index entry and all rows except U's last occupied subshell.
    # A failure after earlier U groups were sampled must restart the whole atom.
    import struct
    with open(os.path.join(ROOT, 'data', 'hfs_tables.bin'), 'rb') as f:
        blob = f.read()
    grid_size = struct.unpack_from('<H', blob)[0]
    damaged = tmp_path / 'truncated.bin'
    damaged.write_bytes(blob[:-4 * grid_size])
    result = run_device(device_executable, damaged)
    rows = [line.split() for line in result.stdout.splitlines()]
    assert [r for r in rows if r[1] == '92'] == [r for r in missing_asset_output if r[1] == '92']
    assert [r for r in rows if r[1] == '26'] == [r for r in device_output if r[1] == '26']
