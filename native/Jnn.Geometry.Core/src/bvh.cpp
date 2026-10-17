#include "bvh.h"
#include <cmath>

void BvhTree::Insert(uint32_t id, const JnnAABB& aabb) {
    items.push_back({ id, aabb });
}

bool BvhTree::IntersectAABB(const JnnAABB& a, const JnnAABB& b, float tolerance) {
    if (a.max_x + tolerance < b.min_x || a.min_x - tolerance > b.max_x) return false;
    if (a.max_y + tolerance < b.min_y || a.min_y - tolerance > b.max_y) return false;
    if (a.max_z + tolerance < b.min_z || a.min_z - tolerance > b.max_z) return false;
    return true;
}

JnnAABB BvhTree::MergeAABB(const JnnAABB& a, const JnnAABB& b) {
    JnnAABB merged;
    merged.min_x = std::min(a.min_x, b.min_x);
    merged.min_y = std::min(a.min_y, b.min_y);
    merged.min_z = std::min(a.min_z, b.min_z);
    merged.max_x = std::max(a.max_x, b.max_x);
    merged.max_y = std::max(a.max_y, b.max_y);
    merged.max_z = std::max(a.max_z, b.max_z);
    return merged;
}

int32_t BvhTree::BuildRecursive(size_t start, size_t end) {
    size_t count = end - start;
    if (count == 0) return -1;

    if (count == 1) {
        int32_t idx = static_cast<int32_t>(nodes.size());
        BvhNode leaf;
        leaf.aabb = items[start].second;
        leaf.element_id = items[start].first;
        leaf.left_child = -1;
        leaf.right_child = -1;
        leaf.is_leaf = true;
        nodes.push_back(leaf);
        return idx;
    }

    JnnAABB bounds = items[start].second;
    for (size_t i = start + 1; i < end; ++i) {
        bounds = MergeAABB(bounds, items[i].second);
    }

    float extent_x = bounds.max_x - bounds.min_x;
    float extent_y = bounds.max_y - bounds.min_y;
    float extent_z = bounds.max_z - bounds.min_z;

    int axis = 0;
    if (extent_y > extent_x && extent_y >= extent_z) axis = 1;
    else if (extent_z > extent_x && extent_z > extent_y) axis = 2;

    size_t mid = start + count / 2;
    std::nth_element(
        items.begin() + static_cast<std::ptrdiff_t>(start),
        items.begin() + static_cast<std::ptrdiff_t>(mid),
        items.begin() + static_cast<std::ptrdiff_t>(end),
        [axis](const auto& lhs, const auto& rhs) {
            if (axis == 0) return (lhs.second.min_x + lhs.second.max_x) < (rhs.second.min_x + rhs.second.max_x);
            if (axis == 1) return (lhs.second.min_y + lhs.second.max_y) < (rhs.second.min_y + rhs.second.max_y);
            return (lhs.second.min_z + lhs.second.max_z) < (rhs.second.min_z + rhs.second.max_z);
        }
    );

    int32_t node_index = static_cast<int32_t>(nodes.size());
    nodes.push_back(BvhNode{ bounds, 0, -1, -1, false });

    int32_t left = BuildRecursive(start, mid);
    int32_t right = BuildRecursive(mid, end);

    nodes[node_index].left_child = left;
    nodes[node_index].right_child = right;
    return node_index;
}

void BvhTree::Build() {
    nodes.clear();
    root_index = -1;
    if (items.empty()) return;

    nodes.reserve(items.size() * 2);
    root_index = BuildRecursive(0, items.size());
}
