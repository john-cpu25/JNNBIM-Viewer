/* Compiled as C11 and linked against the shared library. */
#include <stdio.h>
#include <string.h>

#include "jnn/geometry.h"

#define CHECK(cond)                                              \
  do {                                                           \
    if (!(cond)) {                                               \
      fprintf(stderr, "%s:%d CHECK failed: %s\n", __FILE__, __LINE__, #cond); \
      return 1;                                                  \
    }                                                            \
  } while (0)

int main(void) {
  const float pos[] = {0.f, 0.f, 0.f, 1.f, 2.f, 3.f, -1.f, 0.5f, 0.f};
  const uint32_t idx[] = {0, 1, 2};
  jnn_aabb box;
  int hit = 0;
  double d = -1.0;

  CHECK(jnn_abi_version() == JNN_ABI_VERSION);
  CHECK(strlen(jnn_version_string()) > 0);
  CHECK(jnn_aabb_from_triangles(pos, 3, idx, 3, &box) == JNN_OK);
  CHECK(box.min.x == -1.0 && box.max.z == 3.0);
  CHECK(jnn_aabb_overlaps(&box, &box, 0.0, &hit) == JNN_OK && hit == 1);
  CHECK(jnn_aabb_overlaps(&box, &box, -1.0, &hit) == JNN_INVALID_ARGUMENT);
  CHECK(strlen(jnn_last_error_message()) > 0);
  CHECK(jnn_aabb_distance(&box, &box, &d) == JNN_OK && d == 0.0);
  printf("jnn_geometry %s C API smoke test passed\n", jnn_version_string());
  return 0;
}
