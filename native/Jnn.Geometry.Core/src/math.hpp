#pragma once
// Internal C++ math types. Not part of the public ABI.
#include <cmath>

namespace jnn {

struct Vec3d {
  double x = 0, y = 0, z = 0;

  constexpr Vec3d() = default;
  constexpr Vec3d(double x_, double y_, double z_) : x(x_), y(y_), z(z_) {}

  constexpr double operator[](int i) const { return i == 0 ? x : i == 1 ? y : z; }
  constexpr Vec3d operator+(const Vec3d& o) const { return {x + o.x, y + o.y, z + o.z}; }
  constexpr Vec3d operator-(const Vec3d& o) const { return {x - o.x, y - o.y, z - o.z}; }
  constexpr Vec3d operator*(double s) const { return {x * s, y * s, z * s}; }
  constexpr bool operator==(const Vec3d&) const = default;

  [[nodiscard]] constexpr double dot(const Vec3d& o) const { return x * o.x + y * o.y + z * o.z; }
  [[nodiscard]] constexpr Vec3d cross(const Vec3d& o) const {
    return {y * o.z - z * o.y, z * o.x - x * o.z, x * o.y - y * o.x};
  }
  [[nodiscard]] double length() const { return std::sqrt(dot(*this)); }
  [[nodiscard]] bool isFinite() const { return std::isfinite(x) && std::isfinite(y) && std::isfinite(z); }
};

[[nodiscard]] constexpr Vec3d min(const Vec3d& a, const Vec3d& b) {
  return {a.x < b.x ? a.x : b.x, a.y < b.y ? a.y : b.y, a.z < b.z ? a.z : b.z};
}
[[nodiscard]] constexpr Vec3d max(const Vec3d& a, const Vec3d& b) {
  return {a.x > b.x ? a.x : b.x, a.y > b.y ? a.y : b.y, a.z > b.z ? a.z : b.z};
}

}  // namespace jnn
