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

void BvhTree::Build() {
    nodes.clear();
    if (items.empty()) return;

    nodes.reserve(items.size() * 2);

    for (const auto& item : items) {
        BvhNode node;
        node.aabb = item.second;
        node.element_id = item.first;
        node.left_child = -1;
        node.right_child = -1;
        node.is_leaf = true;
        nodes.push_back(node);
    }
}
