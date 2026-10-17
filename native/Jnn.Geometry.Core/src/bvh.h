#pragma once

#include <vector>
#include <cstdint>
#include <algorithm>
#include "../include/jnn_geometry_core.h"

struct BvhNode {
    JnnAABB aabb;
    uint32_t element_id;
    int32_t left_child;
    int32_t right_child;
    bool is_leaf;
};

class BvhTree {
public:
    std::vector<BvhNode> nodes;
    std::vector<std::pair<uint32_t, JnnAABB>> items;

    void Insert(uint32_t id, const JnnAABB& aabb);
    void Build();
    static bool IntersectAABB(const JnnAABB& a, const JnnAABB& b, float tolerance);
};
