// Force-included (-include) into src/physics/hfs_radial.cpp's host build: redirects its
// fopen("/storage/hfs_tables.bin") to $HFS_TABLES_BIN, so the device source compiles unmodified.
#pragma once
#include <cstdio>
#include <cstdlib>
#include <cstring>

inline FILE *hostFopen(const char *path, const char *mode)
{
    const char *override = std::getenv("HFS_TABLES_BIN");
    if (override != nullptr && std::strcmp(path, "/storage/hfs_tables.bin") == 0)
        return std::fopen(override, mode);
    return std::fopen(path, mode);
}
#define fopen hostFopen
