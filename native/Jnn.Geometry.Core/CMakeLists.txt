cmake_minimum_required(VERSION 3.24)

project(JnnGeometryCore
  VERSION 0.1.0
  DESCRIPTION "JNN native geometry core (AABB, BVH, broad-phase clash)"
  LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_C_STANDARD 11)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)
# Only the C API is exported from the shared library.
set(CMAKE_CXX_VISIBILITY_PRESET hidden)
set(CMAKE_VISIBILITY_INLINES_HIDDEN ON)

option(JNN_BUILD_TESTS "Build unit tests" ON)
option(JNN_WARNINGS_AS_ERRORS "Treat compiler warnings as errors" ON)
option(JNN_USE_SYSTEM_GTEST "Use an installed GoogleTest instead of FetchContent" OFF)

configure_file(src/version.hpp.in ${CMAKE_CURRENT_BINARY_DIR}/generated/jnn_version.hpp @ONLY)

function(jnn_set_warnings target)
  if(MSVC)
    target_compile_options(${target} PRIVATE /W4 /permissive- /utf-8)
    if(JNN_WARNINGS_AS_ERRORS)
      target_compile_options(${target} PRIVATE /WX)
    endif()
  else()
    target_compile_options(${target} PRIVATE -Wall -Wextra -Wpedantic -Wshadow -Wconversion -Wsign-conversion)
    if(JNN_WARNINGS_AS_ERRORS)
      target_compile_options(${target} PRIVATE -Werror)
    endif()
  endif()
endfunction()

set(JNN_SOURCES
  src/c_api.cpp
  src/aabb.cpp
  src/status.cpp)

# Compiled once, linked into both the shared library and the tests.
add_library(jnn_geometry_obj OBJECT ${JNN_SOURCES})
target_include_directories(jnn_geometry_obj
  PUBLIC  ${CMAKE_CURRENT_SOURCE_DIR}/include
  PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src ${CMAKE_CURRENT_BINARY_DIR}/generated)
target_compile_definitions(jnn_geometry_obj PRIVATE JNN_BUILDING_LIBRARY)
jnn_set_warnings(jnn_geometry_obj)

# Public shared library (jnn_geometry.dll / libjnn_geometry.so) consumed via P/Invoke.
add_library(jnn_geometry SHARED $<TARGET_OBJECTS:jnn_geometry_obj>)
target_include_directories(jnn_geometry PUBLIC
  $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
  $<INSTALL_INTERFACE:include>)
set_target_properties(jnn_geometry PROPERTIES
  VERSION ${PROJECT_VERSION}
  SOVERSION ${PROJECT_VERSION_MAJOR}
  WINDOWS_EXPORT_ALL_SYMBOLS OFF)

# Static variant gives tests access to the internal C++ API.
add_library(jnn_geometry_static STATIC $<TARGET_OBJECTS:jnn_geometry_obj>)
target_include_directories(jnn_geometry_static PUBLIC
  ${CMAKE_CURRENT_SOURCE_DIR}/include ${CMAKE_CURRENT_SOURCE_DIR}/src ${CMAKE_CURRENT_BINARY_DIR}/generated)
target_compile_definitions(jnn_geometry_static PUBLIC JNN_STATIC)

install(TARGETS jnn_geometry RUNTIME DESTINATION bin LIBRARY DESTINATION lib ARCHIVE DESTINATION lib)
install(DIRECTORY include/ DESTINATION include)

if(JNN_BUILD_TESTS)
  enable_testing()
  if(JNN_USE_SYSTEM_GTEST)
    find_package(GTest REQUIRED)
  else()
    include(FetchContent)
    # Pinned to the v1.17.0 release commit. Git is used because archive
    # downloads are blocked on some build networks.
    FetchContent_Declare(googletest
      GIT_REPOSITORY https://github.com/google/googletest.git
      GIT_TAG        52eb8108c5bdec04579160ae17225d66034bd723 # v1.17.0
      GIT_SHALLOW    FALSE
      EXCLUDE_FROM_ALL)
    set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
    set(INSTALL_GTEST OFF CACHE BOOL "" FORCE)
    FetchContent_MakeAvailable(googletest)
  endif()
  add_subdirectory(${CMAKE_CURRENT_SOURCE_DIR}/../../tests/Jnn.Geometry.Tests
                   ${CMAKE_CURRENT_BINARY_DIR}/tests)
endif()
