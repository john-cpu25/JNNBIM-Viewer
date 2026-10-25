// C API implementation. No exception may escape: every entry point is noexcept
// and converts failures into jnn_status + thread-local message.
#include <new>
#include <span>

#include "aabb.hpp"
#include "jnn/geometry.h"
#include "jnn_version.hpp"
#include "status.hpp"

namespace {

template <typename F>
jnn_status guarded(F&& f) noexcept {
  try {
    jnn::clearLastError();
    return f();
  } catch (const std::bad_alloc&) {
    return jnn::fail(JNN_OUT_OF_MEMORY, "out of memory");
  } catch (const std::exception& e) {
    return jnn::fail(JNN_INTERNAL_ERROR, e.what());
  } catch (...) {
    return jnn::fail(JNN_INTERNAL_ERROR, "unknown internal error");
  }
}

}  // namespace

extern "C" {

JNN_API uint32_t jnn_version(void) {
  return (static_cast<uint32_t>(JNN_VERSION_MAJOR) << 16) | (static_cast<uint32_t>(JNN_VERSION_MINOR) << 8) |
         static_cast<uint32_t>(JNN_VERSION_PATCH);
}

JNN_API const char* jnn_version_string(void) { return JNN_VERSION_STRING; }

JNN_API int jnn_abi_version(void) { return JNN_ABI_VERSION; }

JNN_API const char* jnn_status_string(jnn_status status) {
  switch (status) {
    case JNN_OK: return "ok";
    case JNN_INVALID_ARGUMENT: return "invalid argument";
    case JNN_OUT_OF_RANGE: return "out of range";
    case JNN_CANCELLED: return "cancelled";
    case JNN_OUT_OF_MEMORY: return "out of memory";
    case JNN_EMPTY_INPUT: return "empty input";
    case JNN_INTERNAL_ERROR: return "internal error";
  }
  return "unknown status";
}

JNN_API const char* jnn_last_error_message(void) { return jnn::lastErrorMessage(); }

JNN_API jnn_aabb jnn_aabb_empty(void) { return jnn::toC(jnn::Aabb::empty()); }

JNN_API int jnn_aabb_is_empty(const jnn_aabb* box) { return box == nullptr || jnn::fromC(*box).isEmpty() ? 1 : 0; }

JNN_API jnn_status jnn_aabb_from_triangles(const float* positions, size_t vertex_count, const uint32_t* indices,
                                           size_t index_count, jnn_aabb* out_box) {
  return guarded([&] {
    if (!out_box) return jnn::fail(JNN_INVALID_ARGUMENT, "out_box is null");
    *out_box = jnn_aabb_empty();
    if (index_count == 0) return JNN_OK;
    if (!positions || !indices) return jnn::fail(JNN_INVALID_ARGUMENT, "positions or indices is null");
    jnn::Aabb box;
    const jnn_status s = jnn::aabbFromTriangles(std::span<const float>(positions, vertex_count * 3),
                                                std::span<const uint32_t>(indices, index_count), box);
    if (s == JNN_OK) *out_box = jnn::toC(box);
    return s;
  });
}

JNN_API jnn_status jnn_aabb_overlaps(const jnn_aabb* a, const jnn_aabb* b, double tolerance, int* out_overlaps) {
  return guarded([&] {
    if (!a || !b || !out_overlaps) return jnn::fail(JNN_INVALID_ARGUMENT, "null argument");
    if (const jnn_status s = jnn::checkTolerance(tolerance); s != JNN_OK) return s;
    *out_overlaps = jnn::overlaps(jnn::fromC(*a), jnn::fromC(*b), tolerance) ? 1 : 0;
    return JNN_OK;
  });
}

JNN_API jnn_status jnn_aabb_distance(const jnn_aabb* a, const jnn_aabb* b, double* out_distance) {
  return guarded([&] {
    if (!a || !b || !out_distance) return jnn::fail(JNN_INVALID_ARGUMENT, "null argument");
    const jnn::Aabb ba = jnn::fromC(*a);
    const jnn::Aabb bb = jnn::fromC(*b);
    if (ba.isEmpty() || bb.isEmpty()) return jnn::fail(JNN_EMPTY_INPUT, "distance is undefined for an empty box");
    *out_distance = jnn::distance(ba, bb);
    return JNN_OK;
  });
}

}  // extern "C"
