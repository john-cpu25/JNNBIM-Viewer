#include "aabb.hpp"

#include <cmath>
#include <string>

#include "status.hpp"

namespace jnn {

double distance(const Aabb& a, const Aabb& b) {
  auto gap = [](double aMin, double aMax, double bMin, double bMax) {
    if (aMax < bMin) return bMin - aMax;
    if (bMax < aMin) return aMin - bMax;
    return 0.0;
  };
  const double dx = gap(a.min.x, a.max.x, b.min.x, b.max.x);
  const double dy = gap(a.min.y, a.max.y, b.min.y, b.max.y);
  const double dz = gap(a.min.z, a.max.z, b.min.z, b.max.z);
  return std::sqrt(dx * dx + dy * dy + dz * dz);
}

jnn_status checkTolerance(double tolerance) {
  if (std::isnan(tolerance) || tolerance < 0.0 || std::isinf(tolerance)) {
    return fail(JNN_INVALID_ARGUMENT, "tolerance must be a finite value >= 0, got " + std::to_string(tolerance));
  }
  return JNN_OK;
}

jnn_status aabbFromTriangles(std::span<const float> positions, std::span<const std::uint32_t> indices, Aabb& out) {
  out = Aabb::empty();
  if (positions.size() % 3 != 0) {
    return fail(JNN_INVALID_ARGUMENT, "positions length must be a multiple of 3");
  }
  if (indices.size() % 3 != 0) {
    return fail(JNN_INVALID_ARGUMENT, "index count must be a multiple of 3, got " + std::to_string(indices.size()));
  }
  const std::size_t vertexCount = positions.size() / 3;
  Aabb box;
  for (std::size_t i = 0; i < indices.size(); ++i) {
    const std::uint32_t v = indices[i];
    if (v >= vertexCount) {
      return fail(JNN_OUT_OF_RANGE, "index " + std::to_string(i) + " = " + std::to_string(v) +
                                        " is out of range (vertex count " + std::to_string(vertexCount) + ")");
    }
    const std::size_t o = static_cast<std::size_t>(v) * 3;
    const Vec3d p{positions[o], positions[o + 1], positions[o + 2]};
    if (!p.isFinite()) {
      return fail(JNN_INVALID_ARGUMENT, "vertex " + std::to_string(v) + " has a non-finite coordinate");
    }
    box.expand(p);
  }
  out = box;
  return JNN_OK;
}

}  // namespace jnn
