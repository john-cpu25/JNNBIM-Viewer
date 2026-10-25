#include <gtest/gtest.h>

#include <string>
#include <thread>

#include "jnn/geometry.h"
#include "jnn_version.hpp"

TEST(CApi, VersionIsConsistent) {
  const uint32_t v = jnn_version();
  EXPECT_EQ(v >> 16, static_cast<uint32_t>(JNN_VERSION_MAJOR));
  EXPECT_EQ((v >> 8) & 0xFFu, static_cast<uint32_t>(JNN_VERSION_MINOR));
  EXPECT_EQ(v & 0xFFu, static_cast<uint32_t>(JNN_VERSION_PATCH));
  EXPECT_STREQ(jnn_version_string(), JNN_VERSION_STRING);
  EXPECT_EQ(jnn_abi_version(), JNN_ABI_VERSION);
}

TEST(CApi, StatusStringsAreNeverNull) {
  for (int s : {0, 1, 2, 3, 4, 5, 99, 12345}) {
    const char* str = jnn_status_string(static_cast<jnn_status>(s));
    ASSERT_NE(str, nullptr);
    EXPECT_GT(std::string(str).size(), 0u);
  }
  EXPECT_STREQ(jnn_status_string(JNN_CANCELLED), "cancelled");
}

TEST(CApi, LastErrorIsSetOnFailureAndClearedOnSuccess) {
  jnn_aabb a = jnn_aabb_empty();
  int hit = 0;
  EXPECT_EQ(jnn_aabb_overlaps(&a, &a, -0.5, &hit), JNN_INVALID_ARGUMENT);
  EXPECT_NE(std::string(jnn_last_error_message()).find("tolerance"), std::string::npos);
  EXPECT_EQ(jnn_aabb_overlaps(&a, &a, 0.0, &hit), JNN_OK);
  EXPECT_STREQ(jnn_last_error_message(), "");
}

TEST(CApi, LastErrorIsThreadLocal) {
  jnn_aabb a = jnn_aabb_empty();
  int hit = 0;
  ASSERT_EQ(jnn_aabb_overlaps(&a, &a, -1.0, &hit), JNN_INVALID_ARGUMENT);
  std::string other;
  std::thread([&] { other = jnn_last_error_message(); }).join();
  EXPECT_EQ(other, "");
  EXPECT_NE(std::string(jnn_last_error_message()), "");
}

TEST(CApi, NullArgumentsAreRejected) {
  jnn_aabb a = jnn_aabb_empty();
  int hit = 0;
  double d = 0;
  EXPECT_EQ(jnn_aabb_overlaps(nullptr, &a, 0.0, &hit), JNN_INVALID_ARGUMENT);
  EXPECT_EQ(jnn_aabb_overlaps(&a, &a, 0.0, nullptr), JNN_INVALID_ARGUMENT);
  EXPECT_EQ(jnn_aabb_distance(&a, nullptr, &d), JNN_INVALID_ARGUMENT);
  EXPECT_EQ(jnn_aabb_from_triangles(nullptr, 0, nullptr, 0, nullptr), JNN_INVALID_ARGUMENT);
  EXPECT_EQ(jnn_aabb_is_empty(nullptr), 1);
}
