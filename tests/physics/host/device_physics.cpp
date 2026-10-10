// Host harness for the device's radial physics (src/physics/): builds every element's point
// cloud exactly as the firmware does and prints what the atom view draws, for
// tests/physics/test_device_physics.py to check against the literature. See ../README.md.
#include <cstdio>
#include <algorithm>
#include <cmath>
#include <cstring>
#include <cstdlib>

#include "physics/atom_cloud.h"
#include "physics/atom_size_calib.h" // kAtomSizeCalibCount
#include "physics/pointcloud.h"
#include "physics/hfs_radial.h"
#include "render/overlay.h" // kPmPerBohr

static AtomPoint sPoints[kAtomNumPoints];
static orb_real_t sRadii[kAtomNumPoints];

static void printSamplingQuantiles()
{
    orb_real_t weight[] = {1, 1, 1, 1, 1};
    orb_real_t inverse[5];
    buildInverseCdf(weight, 5, orb_real_t(1), inverse);
    for (int i = 0; i < 5; i++)
        std::printf("uniform %d %.9g\n", i, double(inverse[i]));

    const int subshells[][3] = {{1, 1, 0}, {26, 3, 2}, {69, 4, 3}};
    for (const auto &s : subshells)
    {
        const orb_real_t *u = hfsFindU(s[0], s[1], s[2]);
        if (u == nullptr)
            std::exit(1);
        const RadialTable &isotropic = buildHfsRadialSamplerIsotropic(u);
        orb_real_t saved[kOrbitalTableSize];
        std::copy(isotropic.invRTable, isotropic.invRTable + kOrbitalTableSize, saved);
        const RadialTable &oriented = buildHfsRadialSamplerOriented(u);
        for (int k = 1; k < kOrbitalTableSize - 1; k++)
            std::printf("quantile %d %d %d %d %.9g %.9g\n", s[0], s[1], s[2], k,
                        double(saved[k]), double(oriented.invRTable[k]));
    }
}

int main(int argc, char **argv)
{
    if (argc > 1 && std::strcmp(argv[1], "sampling") == 0)
    {
        printSamplingQuantiles();
        return 0;
    }
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
        for (int s = 0; s < rangeCount; s++)
        {
            const auto &range = ranges[s];
            for (int i = 0; i < range.count; i++)
            {
                const auto &p = sPoints[range.startIndex + i];
                sRadii[i] = std::sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
            }
            const int mid = range.count / 2;
            std::nth_element(sRadii, sRadii + mid, sRadii + range.count);
            std::printf("subshell %d %d %d %.6f %.6f\n", z, range.n, range.ell,
                        double(range.peakR * kPmPerBohr), double(sRadii[mid] * kPmPerBohr));
        }
    }
    return 0;
}
