"""Hydrogenic model vs closed-form results.

The hydrogen atom is exactly solvable, so the shared radial code
(micropython/orbitals.py + pointcloud.py, also used by the PC and web
viewers) must reproduce textbook values. A wrong power of r anywhere in the
radial density (r^2 R^2) moves these by a large factor, not a few percent.
"""

import math

import pytest

import orbitals
import pointcloud

# (n, ell): closed-form radius of maximum radial density r^2 R^2 for Z = 1.
EXACT_MODE = {
    (1, 0): 1.0,
    (2, 1): 4.0,
    (3, 2): 9.0,
    (4, 3): 16.0,
    (2, 0): 3.0 + math.sqrt(5.0),
}
SUBSHELLS = [(1, 0), (2, 0), (2, 1), (3, 0), (3, 1), (3, 2), (4, 0), (4, 3)]


def mean_r_exact(n, ell, z):
    return (3 * n * n - ell * (ell + 1)) / (2.0 * z)


def numeric_moments(n, ell, z, steps=40000):
    coeff = orbitals.laguerre_coeffs(n, ell)
    max_r = 8.0 * n * n / z
    dr = max_r / steps
    norm = mean = 0.0
    for i in range(1, steps + 1):
        r = i * dr
        radial = orbitals.hydrogen_radial_function(z * r, n, ell, coeff)
        w = (r * radial) ** 2
        norm += w
        mean += r * w
    return mean / norm


@pytest.mark.parametrize('z', [1.0, 3.0])
@pytest.mark.parametrize('n,ell', sorted(EXACT_MODE))
def test_mode_radius_exact(n, ell, z):
    got = pointcloud.radial_mode_radius(n, ell, z, resolution=20001)
    assert got == pytest.approx(EXACT_MODE[(n, ell)] / z, rel=2e-3)


@pytest.mark.parametrize('z', [1.0, 2.5])
@pytest.mark.parametrize('n,ell', SUBSHELLS)
def test_mean_radius_exact(n, ell, z):
    assert numeric_moments(n, ell, z) == pytest.approx(mean_r_exact(n, ell, z), rel=2e-3)


@pytest.mark.parametrize('n,ell', [(1, 0), (2, 1), (3, 0), (3, 2)])
def test_isotropic_sampler_mean_radius(n, ell):
    """Sampled points must follow r^2 R^2: their mean radius is <r>."""
    z = 2.0
    inv_r_table, _max_r = pointcloud.init_radial_sampler(n, ell, z)
    rng = pointcloud.XorShift32(12345)
    count = 20000
    total = 0.0
    for _ in range(count):
        x, y, pz = pointcloud.sample_isotropic_point(inv_r_table, rng)
        total += math.sqrt(x * x + y * y + pz * pz)
    assert total / count == pytest.approx(mean_r_exact(n, ell, z), rel=0.02)
