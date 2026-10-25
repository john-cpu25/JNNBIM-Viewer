# Unit tests for Jnn.Geometry.Core. Included from native/Jnn.Geometry.Core/CMakeLists.txt.
include(GoogleTest)

add_executable(jnn_geometry_tests
  test_c_api.cpp
  test_aabb.cpp)
target_link_libraries(jnn_geometry_tests PRIVATE jnn_geometry_static GTest::gtest_main)
jnn_set_warnings(jnn_geometry_tests)
gtest_discover_tests(jnn_geometry_tests DISCOVERY_MODE PRE_TEST)

# Pure-C smoke test linked against the SHARED library: proves the header is
# valid C and that the C API symbols are actually exported.
add_executable(jnn_c_smoke c_smoke.c)
target_link_libraries(jnn_c_smoke PRIVATE jnn_geometry)
jnn_set_warnings(jnn_c_smoke)
add_test(NAME c_api_smoke COMMAND jnn_c_smoke)
if(WIN32)
  # Make the DLL discoverable next to the test executable.
  add_custom_command(TARGET jnn_c_smoke POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_if_different $<TARGET_FILE:jnn_geometry> $<TARGET_FILE_DIR:jnn_c_smoke>)
endif()
