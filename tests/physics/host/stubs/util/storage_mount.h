// Host stub: no SPIFFS on the host, the tables are read from a plain file (see host_fopen.h).
#pragma once
inline bool ensureStorageMounted()
{
    return true;
}
