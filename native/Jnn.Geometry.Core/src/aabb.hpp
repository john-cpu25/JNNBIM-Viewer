#pragma once
// Axis-aligned bounding box (internal C++ API).
#include <cstddef>
#include <cstdint>
#include <limits>
#include <span>

#include "jnn/geometry.h"
#include "math.hpp"

namespace jnn {

struct Aabb {
  Vec3d min{std::numeric_limits<double>::infinity(), std::numeric_limits<double>::infinity(),
            std::numeric_limits<double>::infinity()};
  Vec3d max{-std::numeric_limits<double>::infinity(), -std::numeric_limits<double>::infinity(),
            -std::numeric_limits<double>::infinity()};

  static constexpr Aabb empty() { return {}; }
  static constexpr Aabb fromMinMax(const Vec3d& lo, const Vec3d& hi) {
    Aabb b;
    b.min = lo;
    b.max = hi;
    return b;
  }

  [[nodiscard]] constexpr bool isEmpty() const { return min.x > max.x || min.y > max.y || min.z > max.z; }

  constexpr void expand(const Vec3d& p) {
    min = jnn::min(min, p);
    max = jnn::max(max, p);
  }
  constexpr void expand(const Aabb& o) {
    if (o.isEmpty()) return;
    min = jnn::min(min, o.min);
    max = jnn::max(max, o.max);
  }

  [[nodiscard]] constexpr Vec3d center() const { return (min + max) * 0.5; }
  [[nodiscard]] constexpr Vec3d extent() const { return max - min; }
  /// Surface area; 0 for empty boxes. Used by the SAH BVH builder.
  [[nodiscard]] constexpr double surfaceArea() const {
    if (isEmpty()) return 0.0;
    const Vec3d e = extent();
    return 2.0 * (e.x * e.y + e.y * e.z + e.z * e.x);
  }
};

[[nodiscard]] constexpr Aabb merge(Aabb a, const Aabb& b) {
  a.expand(b);
  return a;
}

/// Unchecked overlap test. Precondition: tolerance >= 0 (validate first).
/// Touching boxes overlap; empty boxes never overlap.
[[nodiscard]] constexpr bool overlaps(const Aabb& a, const Aabb& b, double tolerance = 0.0) {
  if (a.isEmpty() || b.isEmpty()) return false;
  return a.min.x <= b.max.x + tolerance && b.min.x <= a.max.x + tolerance &&  //
         a.min.y <= b.max.y + tolerance && b.min.y <= a.max.y + tolerance &&  //
         a.min.z <= b.max.z + tolerance && b.min.z <= a.max.z + tolerance;
}

/// Gap between boxes along the separating axes (0 if overlapping/touching).
/// Precondition: neither box is empty.
[[nodiscard]] double distance(const Aabb& a, const Aabb& b);

/// Validates a tolerance value; returns JNN_OK or JNN_INVALID_ARGUMENT.
[[nodiscard]] jnn_status checkTolerance(double tolerance);

/// Bounds of an indexed triangle soup. Validates indices and coordinates.
[[nodiscard]] jnn_status aabbFromTriangles(std::span<const float> positions,
                                           std::span<const std::uint32_t> indices, Aabb& out);

inline jnn_aabb toC(const Aabb& b) { return {{b.min.x, b.min.y, b.min.z}, {b.max.x, b.max.y, b.max.z}}; }
inline Aabb fromC(const jnn_aabb& b) {
  return Aabb::fromMinMax({b.min.x, b.min.y, b.min.z}, {b.max.x, b.max.y, b.max.z});
}

}  // namespace jnn
