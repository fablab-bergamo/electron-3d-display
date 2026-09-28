"""Invariants of the screened-potential (atomSFE LDA) radial tables
(pc/hfs_tables_reduced.npz -- the source of data/hfs_tables.bin and
micropython/hfs_tables.bin).

Written after an export bug stored r^2*R instead of u = r*R: eigenvalues
stayed NIST-exact and every row stayed normalized, yet every density was
pushed outward (H 1s peak 2.3 a0 instead of ~1.05). The checks below look at
the orbital SHAPE against physics that doesn't depend on this project's own
code, so that class of mistake fails loudly.
"""

import math

import numpy as np
import pytest

import atom_cloud
import clementi_radii
import slater

from conftest import PM_PER_BOHR, valence_subshell

# Documented exception (pc/validate_atoms.py's KNOWN_RADIUS_EXCEPTIONS): Pd is
# 4d10 5s0, and the 169 pm literature value is a 5s-type radius.
RADIUS_EXCEPTIONS = {46}
# Raw LDA valence peak radius / Clementi-Raimondi. The fixed tables span
# ~0.79-1.23 (LDA vs HF, no relativistic contraction past Z~55); the r^2 bug
# gave up to 2.3.
VALENCE_RATIO_BAND = (0.7, 1.4)


def all_rows(tables):
    for z in tables.z_list:
        for n, ell, _occ in tables.config(z):
            yield z, n, ell, tables.source(z, n, ell)


def test_rows_normalized(tables):
    r = tables.r
    worst = max(abs(np.trapezoid(src.u.astype(float) ** 2, r) - 1.0) for _z, _n, _l, src in all_rows(tables))
    assert worst < 1e-3


def test_eigenvalues_ordered_within_each_ell(tables):
    """E(1s) < E(2s) < ..., E(2p) < E(3p) < ... -- a mislabelled row breaks this."""
    for z in tables.z_list:
        by_ell = {}
        for n, ell, _occ in tables.config(z):
            by_ell.setdefault(ell, []).append((n, tables.source(z, n, ell).energy))
        for ell, levels in by_ell.items():
            energies = [e for _n, e in sorted(levels)]
            assert energies == sorted(energies), "Z=%d ell=%d: %r" % (z, ell, levels)


def test_1s_peak_near_one_over_z(tables):
    """The 1s electrons barely feel screening, so their radial density peaks
    at ~1/Z a0 for every element (exactly 1/Z for a bare nucleus). The fixed
    tables give Z*peak = 1.00-1.14; the r^2*R export gave 2.0-2.6."""
    bad = []
    for z in tables.z_list:
        zr = z * tables.source(z, 1, 0).mode_radius()
        if not 0.95 <= zr <= 1.25:
            bad.append((z, round(zr, 3)))
    assert not bad, "Z * r_peak(1s) outside [0.95, 1.25]: %r" % bad


def test_valence_peak_radius_vs_clementi_raimondi(tables):
    lo, hi = VALENCE_RATIO_BAND
    bad = []
    for z in tables.z_list:
        lit = clementi_radii.CLEMENTI_RADIUS_PM.get(z)
        if not lit or z in RADIUS_EXCEPTIONS:
            continue
        n, ell = valence_subshell(tables.config(z))
        ratio = tables.source(z, n, ell).mode_radius() * PM_PER_BOHR / lit
        if not lo <= ratio <= hi:
            bad.append((slater.element_symbol(z), round(ratio, 2)))
    assert not bad, "raw valence radius / Clementi-Raimondi outside %r: %r" % (VALENCE_RATIO_BAND, bad)


# --- Independent LDA reference for H and He ------------------------------------

def solve_lda_1s(z, electrons, r_max=40.0, points=8000, iterations=120):
    """Minimal spin-unpolarized LDA (Slater exchange + Perdew-Zunger 81
    correlation) for a 1s^N atom, finite differences on a uniform grid --
    deliberately nothing shared with the atomSFE pipeline. Returns
    (r, u, eigenvalue) with u = r*R normalized to int u^2 dr = 1."""
    from scipy.linalg import eigh_tridiagonal

    h = r_max / points
    r = np.arange(1, points + 1) * h
    potential = -z / r
    off_diag = -0.5 / h ** 2 * np.ones(points - 1)
    for _ in range(iterations):
        energies, vectors = eigh_tridiagonal(1.0 / h ** 2 + potential, off_diag, select='i', select_range=(0, 0))
        u = vectors[:, 0] / math.sqrt(h)
        u *= np.sign(u[np.argmax(np.abs(u))])
        shell = electrons * u * u
        density = shell / (4 * math.pi * r * r)
        enclosed = np.cumsum(shell) * h
        hartree = enclosed / r + (np.cumsum((shell / r)[::-1])[::-1] - shell / r) * h
        rs = (3 / (4 * math.pi * np.maximum(density, 1e-30))) ** (1 / 3)
        vx = -(3 / math.pi * density) ** (1 / 3)
        g, b1, b2 = -0.1423, 1.0529, 0.3334
        a, b, c, d = 0.0311, -0.048, 0.0020, -0.0116
        sq = np.sqrt(rs)
        ec_high = g / (1 + b1 * sq + b2 * rs)
        vc = np.where(rs >= 1,
                      ec_high * (1 + 7 / 6 * b1 * sq + 4 / 3 * b2 * rs) / (1 + b1 * sq + b2 * rs),
                      a * np.log(rs) + (b - a / 3) + 2 / 3 * c * rs * np.log(rs) + (2 * d - c) * rs / 3)
        potential = 0.5 * potential + 0.5 * (-z / r + hartree + vx + vc)
    return r, u, float(energies[0])


@pytest.mark.parametrize('z', [1, 2])
def test_h_he_orbital_matches_independent_lda(tables, z):
    r, u, energy = solve_lda_1s(z, z)
    src = tables.source(z, 1, 0)
    grid = tables.r
    mask = (grid > 0.05 / z) & (grid < 10.0 / z)
    table_u = src.u.astype(float)[mask]
    reference_u = np.interp(grid[mask], r, u)
    # VWN (table) vs PZ81 (here) correlation: ~1e-3 on u and eigenvalue. The
    # r^2*R export differed by ~0.4 on u.
    assert np.max(np.abs(table_u - reference_u)) < 0.01
    assert src.energy == pytest.approx(energy, abs=3e-3)


# --- Sampled point clouds follow the tables -------------------------------------

def table_quantile(tables, z, n, ell, p):
    """Radius below which a fraction p of subshell (n, ell)'s density lies,
    from u interpolated onto a fine log grid (density per dr is u^2)."""
    grid = tables.r
    fine = np.exp(np.linspace(np.log(grid[0]), np.log(grid[-1]), 200000))
    mass = np.interp(fine, grid, tables.source(z, n, ell).u.astype(float)) ** 2 * np.gradient(fine)
    cdf = np.cumsum(mass)
    return float(np.interp(p, cdf / cdf[-1], fine))


@pytest.mark.parametrize('z', [10, 26])
def test_sampled_subshell_radii_match_table(tables, z):
    """build_atom_point_cloud() (shared by the PC, web and MicroPython
    viewers) must sample u^2: each subshell's sampled median and p90 radii
    match the table's. Covers both the isotropic (full subshell) and the
    Hund's-rule oriented (Fe 3d6) samplers. An r^2 weighting error shifts
    these by 30%+; the tolerance covers sampling noise and the 128-point
    grid. (Means are not compared: the table sampler's last quantile bin
    spreads a thin halo far out, inflating the mean by ~5% without moving
    the bulk.)"""
    xs, ys, zs, _colors, shells, ells, _signs, config = atom_cloud.build_atom_point_cloud(
        z, count=30000, radial_tables=tables)
    for n, ell, _occ in config:
        radii = np.array([math.sqrt(xs[i] ** 2 + ys[i] ** 2 + zs[i] ** 2)
                          for i in range(len(shells)) if shells[i] == n and ells[i] == ell])
        for p in (0.5, 0.9):
            assert np.quantile(radii, p) == pytest.approx(table_quantile(tables, z, n, ell, p), rel=0.06), \
                "Z=%d %d%s p%d" % (z, n, 'spdf'[ell], int(100 * p))
