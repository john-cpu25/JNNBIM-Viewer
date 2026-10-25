# Jnn.Geometry.Core (C++20)

Native geometry library for JNN. **The public boundary is the C API in `include/jnn/geometry.h`**,
consumed from C# via P/Invoke. Internal C++ (`src/*.hpp`) is not exported.

Status: M3-01 (skeleton, C API, error model) and M3-02 (AABB) are done. BVH, broad-phase and benchmark
come in M3-04…M3-07 (see `TODO/M3-geometry-core.md`).

## Build & test

Requirements: CMake ≥ 3.24, a C++20 compiler, and Git (GoogleTest v1.17.0 is fetched by commit hash at configure time).

**Linux** (GCC 13 / Clang 18 tested; uses Ninja):
```bash
cmake --preset linux-release
cmake --build --preset linux-release
ctest --preset linux-release
# Debug + AddressSanitizer/UBSan:
cmake --preset linux-debug && cmake --build --preset linux-debug && ctest --preset linux-debug
```

**Windows x64** (Visual Studio 2022 with "Desktop development with C++"), from a Developer PowerShell:
```powershell
cmake --preset windows-msvc
cmake --build --preset windows-msvc-release
ctest --preset windows-msvc-release
```
Output: `build\windows-msvc\Release\jnn_geometry.dll`. Copy it next to the desktop/.NET executable
(full rebuild/deploy guide arrives in M3-09). *The Windows preset has not been run yet: it is pending a
Windows machine.*

Options: `-DJNN_BUILD_TESTS=OFF`, `-DJNN_WARNINGS_AS_ERRORS=OFF`, `-DJNN_USE_SYSTEM_GTEST=ON` (offline builds).

## Layout

```
include/jnn/geometry.h   Public C API (C11, stable ABI, JNN_ABI_VERSION)
src/math.hpp             Vec3d
src/aabb.hpp/.cpp        Aabb, overlaps (with tolerance), distance, bounds of triangle soup
src/status.hpp/.cpp      Thread-local last-error message
src/c_api.cpp            C entry points (noexcept, exceptions → jnn_status)
../../tests/Jnn.Geometry.Tests/   GoogleTest suite + pure-C smoke test against the shared library
```

## Error model

- Every fallible function returns `jnn_status`; `jnn_last_error_message()` gives a human-readable reason
  for the last failure **on the calling thread** (cleared on the next successful call).
- No C++ exception crosses the C boundary (`std::bad_alloc` → `JNN_OUT_OF_MEMORY`, others → `JNN_INTERNAL_ERROR`).
- Tolerances must be finite and ≥ 0; otherwise `JNN_INVALID_ARGUMENT`.
- Empty boxes (min > max) never overlap; distance to an empty box returns `JNN_EMPTY_INPUT`.
