cmake_minimum_required(VERSION 3.25)
project(JnnGeometryCore VERSION 1.0.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(include src)

set(SOURCES
    src/jnn_geometry_core.cpp
    src/bvh.cpp
    src/clash.cpp
)

set(HEADERS
    include/jnn_geometry_core.h
    src/bvh.h
)

add_library(JnnGeometryCore SHARED ${SOURCES} ${HEADERS})

target_compile_definitions(JnnGeometryCore PRIVATE JNN_GEO_EXPORTS)

target_include_directories(JnnGeometryCore PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
    $<INSTALL_INTERFACE:include>
)

if (MSVC)
    target_compile_options(JnnGeometryCore PRIVATE /W4 /O2 /permissive-)
else()
    target_compile_options(JnnGeometryCore PRIVATE -Wall -Wextra -O3)
endif()
