// Host stub for tests/physics/host -- see ../README.md.
#pragma once
#include <cstdio>
#define ESP_LOGI(tag, fmt, ...) std::fprintf(stderr, "[%s] " fmt "\n", tag, ##__VA_ARGS__)
#define ESP_LOGW ESP_LOGI
#define ESP_LOGE ESP_LOGI
