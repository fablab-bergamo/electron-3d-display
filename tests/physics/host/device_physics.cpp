// Host harness for the device's radial physics (src/physics/): builds every element's point
// cloud exactly as the firmware does and prints what the atom view draws, for
// tests/physics/test_device_physics.py to check against the literature. See ../README.md.
#include <cstdio>

#include "physics/atom_cloud.h"
#include "physics/atom_size_calib.h" // kAtomSizeCalibCount
#include "physics/pointcloud.h"
#include "render/overlay.h" // kPmPerBohr

static AtomPoint sPoints[kAtomNumPoints];

int main()
{
    // Hydrogenic sampler peak radii (bohr) for Z=1: exact values are n^2 for ell=n-1, 3+sqrt(5) for 2s.
    const int hydrogenic[][2] = {{1, 0}, {2, 1}, {3, 2}, {2, 0}};
    for (const auto &nl : hydrogenic)
        std::printf("hydrogenic %d %d %.6f\n", nl[0], nl[1],
                    double(buildRadialSamplerRuntime(nl[0], nl[1], orb_real_t(1)).peakR));

    for (int z = 1; z <= kAtomSizeCalibCount; z++)
    {
        AtomSubshellRange ranges[kMaxConfigSubshells];
        int rangeCount = 0;
        (void)buildAtomPointCloud(z, sPoints, kAtomNumPoints, kAtomCloudSeed, ranges, &rangeCount);
        OuterSubshell outer = outerSubshellRRef(sPoints, ranges, rangeCount);
        // What atom_view.cpp draws: bounding circle at outer.peakR, framing at outer.rRef (p90).
        std::printf("atom %d %d %d %.3f %.3f\n", z, outer.n, outer.ell, double(outer.peakR * kPmPerBohr),
                    double(outer.rRef * kPmPerBohr));
    }
    return 0;
}
