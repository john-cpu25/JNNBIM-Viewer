#ifndef JNN_GEOMETRY_CORE_H
#define JNN_GEOMETRY_CORE_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#ifdef _WIN32
  #ifdef JNN_GEO_EXPORTS
    #define JNN_GEO_API __declspec(dllexport)
  #else
    #define JNN_GEO_API __declspec(dllimport)
  #endif
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
    float overlap_distance;
    float contact_point[3];
} JnnClashPair;

// BVH Lifecycle & Queries
JNN_GEO_API void* Jnn_Bvh_Create();
JNN_GEO_API void Jnn_Bvh_Destroy(void* bvh_handle);
JNN_GEO_API int Jnn_Bvh_InsertAABB(void* bvh_handle, uint32_t element_id, const JnnAABB* aabb);
JNN_GEO_API int Jnn_Bvh_Build(void* bvh_handle);

// Broad-phase clash detection
JNN_GEO_API int Jnn_Clash_BroadPhase(
    const void* bvh_handle_a,
    const void* bvh_handle_b,
    float tolerance,
    JnnClashPair* out_pairs,
    uint32_t max_pairs,
    uint32_t* out_pair_count
);

#ifdef __cplusplus
}
#endif

#endif // JNN_GEOMETRY_CORE_H
