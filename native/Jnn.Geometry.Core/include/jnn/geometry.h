/*
 * JNN Geometry Core — public C API.
 *
 * This header is the ONLY integration boundary of the native library
 * (consumed from C# via P/Invoke). Rules:
 *   - Plain C (C11). No C++ types, no exceptions cross this boundary.
 *   - Every fallible function returns jnn_status. Details of the last failure
 *     on the calling thread are available from jnn_last_error_message().
 *   - Coordinates are model units (as delivered by the source adapter), +Z up.
 *   - All structs are plain data with fixed layout (doubles, no padding issues).
 */
#ifndef JNN_GEOMETRY_H
#define JNN_GEOMETRY_H

#include <stddef.h>
#include <stdint.h>

#if defined(JNN_STATIC)
#  define JNN_API
#elif defined(_WIN32)
#  if defined(JNN_BUILDING_LIBRARY)
#    define JNN_API __declspec(dllexport)
#  else
#    define JNN_API __declspec(dllimport)
#  endif
#else
#  define JNN_API __attribute__((visibility("default")))
#endif

#ifdef __cplusplus
extern "C" {
#endif

/* Bumped on any breaking change to structs or signatures in this header. */
#define JNN_ABI_VERSION 1

typedef enum jnn_status {
  JNN_OK = 0,
  JNN_INVALID_ARGUMENT = 1, /* null pointer, NaN, negative tolerance, ... */
  JNN_OUT_OF_RANGE = 2,     /* index outside the provided buffer */
  JNN_CANCELLED = 3,        /* caller requested cancellation */
  JNN_OUT_OF_MEMORY = 4,
  JNN_EMPTY_INPUT = 5,      /* operation undefined for empty geometry */
  JNN_INTERNAL_ERROR = 99
} jnn_status;

typedef struct jnn_vec3 {
  double x, y, z;
} jnn_vec3;

/* Axis-aligned bounding box. Empty when min > max on any axis. */
typedef struct jnn_aabb {
  jnn_vec3 min;
  jnn_vec3 max;
} jnn_aabb;

/* ---- Library info ------------------------------------------------------ */

/* (major << 16) | (minor << 8) | patch */
JNN_API uint32_t jnn_version(void);
JNN_API const char* jnn_version_string(void);
JNN_API int jnn_abi_version(void);
/* Static, never NULL. */
JNN_API const char* jnn_status_string(jnn_status status);
/* Message for the last failing call on this thread; "" if none. Valid until
 * the next jnn_* call on the same thread. */
JNN_API const char* jnn_last_error_message(void);

/* ---- AABB ---------------------------------------------------------------- */

JNN_API jnn_aabb jnn_aabb_empty(void);
JNN_API int jnn_aabb_is_empty(const jnn_aabb* box);

/*
 * Bounds of the triangles referenced by `indices` (3 per triangle).
 * positions: xyz float triplets, `vertex_count` vertices.
 * Empty input (index_count == 0) yields an empty box and JNN_OK.
 * Errors: JNN_INVALID_ARGUMENT (null, index_count % 3 != 0, non-finite
 * coordinate), JNN_OUT_OF_RANGE (index >= vertex_count).
 */
JNN_API jnn_status jnn_aabb_from_triangles(const float* positions, size_t vertex_count,
                                           const uint32_t* indices, size_t index_count,
                                           jnn_aabb* out_box);

/*
 * Overlap test with tolerance (>= 0, model units). Boxes that touch or are
 * closer than `tolerance` overlap. Empty boxes never overlap.
 * Errors: JNN_INVALID_ARGUMENT for null pointers or tolerance < 0 / NaN.
 */
JNN_API jnn_status jnn_aabb_overlaps(const jnn_aabb* a, const jnn_aabb* b, double tolerance,
                                     int* out_overlaps);

/*
 * Euclidean gap between two boxes (0 when they overlap or touch).
 * Errors: JNN_INVALID_ARGUMENT (null), JNN_EMPTY_INPUT (either box empty).
 */
JNN_API jnn_status jnn_aabb_distance(const jnn_aabb* a, const jnn_aabb* b, double* out_distance);

#ifdef __cplusplus
} /* extern "C" */
#endif

#endif /* JNN_GEOMETRY_H */
