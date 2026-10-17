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
    int32_t root_index = -1;

    void Insert(uint32_t id, const JnnAABB& aabb);
    void Build();
    static bool IntersectAABB(const JnnAABB& a, const JnnAABB& b, float tolerance);
    static JnnAABB MergeAABB(const JnnAABB& a, const JnnAABB& b);

private:
    int32_t BuildRecursive(size_t start, size_t end);
};
