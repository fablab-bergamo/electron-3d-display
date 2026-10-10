"""Quantile regressions against independent densities, not another port."""

import numpy as np
import pytest

import pointcloud


@pytest.mark.parametrize('count', [2, 5, 1001])
def test_uniform_density_quantiles(count):
    quantiles = pointcloud._build_inverse_cdf([1.0] * count, 1.0)
    assert list(quantiles) == pytest.approx(np.linspace(0, 1, count), abs=1e-12)


def test_nonuniform_grid_uniform_density():
    grid = [0.0, 0.01, 0.2, 1.0]
    quantiles = pointcloud._build_inverse_cdf_from_grid([1.0] * len(grid), grid, 1001)
    assert list(quantiles) == pytest.approx(np.linspace(0, 1, 1001), abs=1e-12)


def test_table_radial_marginal_is_independent_of_occupancy(tables):
    src = tables.source(69, 4, 3)
    radial = pointcloud.init_radial_sampler_from_table(src.r, src.u.astype(float) ** 2)
    assert len(radial[0]) == 1001
    fine = np.geomspace(src.r[0], src.r[-1], 200000)
    w = np.interp(fine, src.r, src.u.astype(float)) ** 2
    cdf = np.r_[0, np.cumsum(0.5 * (w[:-1] + w[1:]) * np.diff(fine))]
    cdf /= cdf[-1]
    for m in range(-3, 4):
        sampler = pointcloud.init_orbital_sampler(4, 3, m, radial_table=radial)
        assert sampler.inv_r_table is radial[0]
        quantiles = np.asarray(sampler.inv_r_table)[1:-1]
        assert np.max(np.abs(np.interp(quantiles, fine, cdf) - np.arange(1, 1000) / 1000)) < 0.01
        assert quantiles[499] == pytest.approx(np.interp(0.5, cdf, fine), rel=0.01)
