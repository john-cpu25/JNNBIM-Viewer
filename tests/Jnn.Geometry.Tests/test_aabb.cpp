#include <gtest/gtest.h>

#include <cmath>
#include <limits>
#include <vector>

#include "aabb.hpp"
#include "jnn/geometry.h"

using jnn::Aabb;
using jnn::Vec3d;

namespace {
Aabb box(double x0, double y0, double z0, double x1, double y1, double z1) {
  return Aabb::fromMinMax({x0, y0, z0}, {x1, y1, z1});
}
}  // namespace

TEST(Aabb, EmptyByDefaultAndExpands) {
  Aabb b;
  EXPECT_TRUE(b.isEmpty());
  EXPECT_EQ(b.surfaceArea(), 0.0);
  b.expand(Vec3d{1, 2, 3});
  EXPECT_FALSE(b.isEmpty());  // a single point is a degenerate but valid box
  EXPECT_EQ(b.min, (Vec3d{1, 2, 3}));
  EXPECT_EQ(b.max, (Vec3d{1, 2, 3}));
  b.expand(Vec3d{-1, 5, 0});
  EXPECT_EQ(b.min, (Vec3d{-1, 2, 0}));
  EXPECT_EQ(b.max, (Vec3d{1, 5, 3}));
}

TEST(Aabb, MergeIgnoresEmpty) {
  const Aabb a = box(0, 0, 0, 1, 1, 1);
  EXPECT_EQ(jnn::merge(a, Aabb::empty()).max, a.max);
  EXPECT_EQ(jnn::merge(Aabb::empty(), a).min, a.min);
  EXPECT_TRUE(jnn::merge(Aabb::empty(), Aabb::empty()).isEmpty());
  const Aabb m = jnn::merge(a, box(2, -1, 0, 3, 0, 4));
  EXPECT_EQ(m.min, (Vec3d{0, -1, 0}));
  EXPECT_EQ(m.max, (Vec3d{3, 1, 4}));
}

TEST(Aabb, CenterExtentSurfaceArea) {
  const Aabb a = box(0, 0, 0, 2, 4, 6);
  EXPECT_EQ(a.center(), (Vec3d{1, 2, 3}));
  EXPECT_EQ(a.extent(), (Vec3d{2, 4, 6}));
  EXPECT_DOUBLE_EQ(a.surfaceArea(), 2.0 * (8 + 24 + 12));
}

TEST(Aabb, OverlapCases) {
  const Aabb a = box(0, 0, 0, 1, 1, 1);
  EXPECT_TRUE(jnn::overlaps(a, box(0.5, 0.5, 0.5, 2, 2, 2)));  // partial
  EXPECT_TRUE(jnn::overlaps(a, box(0.2, 0.2, 0.2, 0.8, 0.8, 0.8)));  // contained
  EXPECT_TRUE(jnn::overlaps(a, box(1, 0, 0, 2, 1, 1)));  // touching face counts
  EXPECT_TRUE(jnn::overlaps(a, box(1, 1, 1, 2, 2, 2)));  // touching corner counts
  EXPECT_FALSE(jnn::overlaps(a, box(1.01, 0, 0, 2, 1, 1)));  // gap on x
  EXPECT_FALSE(jnn::overlaps(a, box(0, 0, 1.5, 1, 1, 2)));  // gap on z only
  EXPECT_FALSE(jnn::overlaps(a, Aabb::empty()));
  EXPECT_FALSE(jnn::overlaps(Aabb::empty(), Aabb::empty()));
}

TEST(Aabb, ToleranceTurnsNearMissIntoOverlap) {
  const Aabb a = box(0, 0, 0, 1, 1, 1);
  const Aabb b = box(1.05, 0, 0, 2, 1, 1);
  EXPECT_FALSE(jnn::overlaps(a, b, 0.0));
  EXPECT_FALSE(jnn::overlaps(a, b, 0.04));
  EXPECT_TRUE(jnn::overlaps(a, b, 0.05));
  EXPECT_TRUE(jnn::overlaps(b, a, 0.1));  // symmetric
}

TEST(Aabb, ToleranceValidation) {
  EXPECT_EQ(jnn::checkTolerance(0.0), JNN_OK);
  EXPECT_EQ(jnn::checkTolerance(0.025), JNN_OK);
  EXPECT_EQ(jnn::checkTolerance(-1e-9), JNN_INVALID_ARGUMENT);
  EXPECT_EQ(jnn::checkTolerance(std::numeric_limits<double>::quiet_NaN()), JNN_INVALID_ARGUMENT);
  EXPECT_EQ(jnn::checkTolerance(std::numeric_limits<double>::infinity()), JNN_INVALID_ARGUMENT);
}

TEST(Aabb, Distance) {
  const Aabb a = box(0, 0, 0, 1, 1, 1);
  EXPECT_DOUBLE_EQ(jnn::distance(a, box(0.5, 0.5, 0.5, 3, 3, 3)), 0.0);
  EXPECT_DOUBLE_EQ(jnn::distance(a, box(1, 0, 0, 2, 1, 1)), 0.0);
  EXPECT_DOUBLE_EQ(jnn::distance(a, box(3, 0, 0, 4, 1, 1)), 2.0);
  EXPECT_DOUBLE_EQ(jnn::distance(a, box(4, 5, 0, 5, 6, 1)), 5.0);  // 3-4-5 diagonal gap
  EXPECT_DOUBLE_EQ(jnn::distance(box(4, 5, 0, 5, 6, 1), a), 5.0);
}

TEST(Aabb, FromTriangles) {
  const std::vector<float> pos = {0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, -4, 99, 99, 99};
  const std::vector<std::uint32_t> idx = {0, 1, 2, 0, 2, 3};  // vertex 4 is unreferenced
  Aabb b;
  ASSERT_EQ(jnn::aabbFromTriangles(pos, idx, b), JNN_OK);
  EXPECT_EQ(b.min, (Vec3d{0, 0, -4}));
  EXPECT_EQ(b.max, (Vec3d{2, 3, 0}));  // unreferenced vertex ignored
}

TEST(Aabb, FromTrianglesRejectsBadInput) {
  const std::vector<float> pos = {0, 0, 0, 1, 1, 1, 2, 2, 2};
  Aabb b;
  EXPECT_EQ(jnn::aabbFromTriangles(pos, std::vector<std::uint32_t>{0, 1}, b), JNN_INVALID_ARGUMENT);
  EXPECT_EQ(jnn::aabbFromTriangles(pos, std::vector<std::uint32_t>{0, 1, 3}, b), JNN_OUT_OF_RANGE);
  EXPECT_TRUE(b.isEmpty());  // output reset on failure
  const std::vector<float> nan = {0, 0, 0, std::numeric_limits<float>::quiet_NaN(), 0, 0, 1, 1, 1};
  EXPECT_EQ(jnn::aabbFromTriangles(nan, std::vector<std::uint32_t>{0, 1, 2}, b), JNN_INVALID_ARGUMENT);
  const std::vector<float> ragged = {0, 0, 0, 1};
  EXPECT_EQ(jnn::aabbFromTriangles(ragged, std::vector<std::uint32_t>{}, b), JNN_INVALID_ARGUMENT);
}

TEST(Aabb, CApiRoundTrip) {
  const float pos[] = {0, 0, 0, 1, 2, 3, -1, 0, 0};
  const std::uint32_t idx[] = {0, 1, 2};
  jnn_aabb out;
  ASSERT_EQ(jnn_aabb_from_triangles(pos, 3, idx, 3, &out), JNN_OK);
  EXPECT_EQ(out.min.x, -1.0);
  EXPECT_EQ(out.max.z, 3.0);
  // Empty input is OK and yields an empty box.
  ASSERT_EQ(jnn_aabb_from_triangles(pos, 3, idx, 0, &out), JNN_OK);
  EXPECT_EQ(jnn_aabb_is_empty(&out), 1);
  // Distance of an empty box is reported, not computed.
  jnn_aabb e = jnn_aabb_empty();
  jnn_aabb full = {{0, 0, 0}, {1, 1, 1}};
  double d = 0;
  EXPECT_EQ(jnn_aabb_distance(&e, &full, &d), JNN_EMPTY_INPUT);
}
