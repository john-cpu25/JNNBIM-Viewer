# JNN Geometry Core — Architecture & C API Specification
**Document ID:** JNN-DOC-GEO-001  
**Version:** 1.0.0  
**Language Standard:** C++20  
**Build System:** CMake 3.25+  
**Location:** `native/Jnn.Geometry.Core/`  

---

## 1. Engine Responsibilities

The native geometry engine `Jnn.Geometry.Core` provides deterministic, high-throughput spatial algorithms required for large-scale structural models:
1. **AABB (Axis-Aligned Bounding Box):** Fast 6-float min/max bounding volumes for all structural elements.
2. **BVH (Bounding Volume Hierarchy):** Radix-sorted SAH (Surface Area Heuristic) tree construction for O(log N) raycasts and broad-phase intersection.
3. **Broad-Phase Collision Detection:** Identifies candidate overlapping bounding volume pairs between Selection A and Selection B with clearance expansion.
4. **Narrow-Phase Triangle Intersection:** Möller-Trumbore based triangle-to-triangle exact intersection algorithms.
5. **Section Plane Slicing:** Computes exact 2D planar polygon segments resulting from slicing 3D triangular meshes with arbitrary cut planes.

---

## 2. Exported C API (`jnn_geometry_core.h`)

To enable seamless P/Invoke from C# (.NET 10) without C++ name mangling, the core exports a clean C interface:

```c
#ifdef _WIN32
  #define JNN_GEO_API __declspec(dllexport)
#else
  #define JNN_GEO_API __attribute__((visibility("default")))
#endif

typedef struct {
    float min_x, min_y, min_z;
    float max_x, max_y, max_z;
} JnnAABB;

typedef struct {
    uint32_t element_id_a;
    uint32_t element_id_b;
    float penetration_depth;
    float contact_point[3];
} JnnClashPair;

// Lifecycle
JNN_GEO_API void* Jnn_Bvh_Create();
JNN_GEO_API void Jnn_Bvh_Destroy(void* bvh_handle);
JNN_GEO_API int Jnn_Bvh_InsertAABB(void* bvh_handle, uint32_t element_id, const JnnAABB* aabb);
JNN_GEO_API int Jnn_Bvh_Build(void* bvh_handle);

// Clash Queries
JNN_GEO_API int Jnn_Clash_BroadPhase(
    const void* bvh_handle_a,
    const void* bvh_handle_b,
    float tolerance,
    JnnClashPair* out_pairs,
    uint32_t max_pairs,
    uint32_t* out_pair_count
);

// Section Slicing
JNN_GEO_API int Jnn_Mesh_SlicePlane(
    const float* vertices,
    uint32_t vertex_count,
    const uint32_t* indices,
    uint32_t index_count,
    const float plane_equation[4], // Ax + By + Cz + D = 0
    float** out_segments,
    uint32_t* out_segment_count
);
```
