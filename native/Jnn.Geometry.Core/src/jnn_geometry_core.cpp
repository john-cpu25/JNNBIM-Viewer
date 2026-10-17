#include "bvh.h"
#include "../include/jnn_geometry_core.h"

void* Jnn_Bvh_Create() {
    return new BvhTree();
}

void Jnn_Bvh_Destroy(void* bvh_handle) {
    if (bvh_handle) {
        delete static_cast<BvhTree*>(bvh_handle);
    }
}

int Jnn_Bvh_InsertAABB(void* bvh_handle, uint32_t element_id, const JnnAABB* aabb) {
    if (!bvh_handle || !aabb) return -1;
    auto* tree = static_cast<BvhTree*>(bvh_handle);
    tree->Insert(element_id, *aabb);
    return 0;
}

int Jnn_Bvh_Build(void* bvh_handle) {
    if (!bvh_handle) return -1;
    auto* tree = static_cast<BvhTree*>(bvh_handle);
    tree->Build();
    return 0;
}
