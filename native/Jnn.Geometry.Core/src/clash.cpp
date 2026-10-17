#include "bvh.h"
#include "../include/jnn_geometry_core.h"
#include <algorithm>
#include <cmath>

namespace {

float ComputePenetrationDepth(const JnnAABB& a, const JnnAABB& b) {
    float overlap_x = std::min(a.max_x, b.max_x) - std::max(a.min_x, b.min_x);
    float overlap_y = std::min(a.max_y, b.max_y) - std::max(a.min_y, b.min_y);
    float overlap_z = std::min(a.max_z, b.max_z) - std::max(a.min_z, b.min_z);
    return std::min({ overlap_x, overlap_y, overlap_z });
}

void TraverseBvhPair(
    const BvhTree& tree_a,
    int32_t idx_a,
    const BvhTree& tree_b,
    int32_t idx_b,
    float tolerance,
    JnnClashPair* out_pairs,
    uint32_t max_pairs,
    uint32_t& count
) {
    if (idx_a < 0 || idx_b < 0 || count >= max_pairs) return;

    const BvhNode& node_a = tree_a.nodes[idx_a];
    const BvhNode& node_b = tree_b.nodes[idx_b];

    if (!BvhTree::IntersectAABB(node_a.aabb, node_b.aabb, tolerance)) {
        return;
    }

    if (node_a.is_leaf && node_b.is_leaf) {
        if (&tree_a == &tree_b && node_a.element_id >= node_b.element_id) {
            return;
        }
        out_pairs[count].element_id_a = node_a.element_id;
        out_pairs[count].element_id_b = node_b.element_id;
        out_pairs[count].overlap_distance = ComputePenetrationDepth(node_a.aabb, node_b.aabb);

        out_pairs[count].contact_point[0] = (std::max(node_a.aabb.min_x, node_b.aabb.min_x) + std::min(node_a.aabb.max_x, node_b.aabb.max_x)) * 0.5f;
        out_pairs[count].contact_point[1] = (std::max(node_a.aabb.min_y, node_b.aabb.min_y) + std::min(node_a.aabb.max_y, node_b.aabb.max_y)) * 0.5f;
        out_pairs[count].contact_point[2] = (std::max(node_a.aabb.min_z, node_b.aabb.min_z) + std::min(node_a.aabb.max_z, node_b.aabb.max_z)) * 0.5f;

        count++;
        return;
    }

    if (node_a.is_leaf) {
        TraverseBvhPair(tree_a, idx_a, tree_b, node_b.left_child, tolerance, out_pairs, max_pairs, count);
        TraverseBvhPair(tree_a, idx_a, tree_b, node_b.right_child, tolerance, out_pairs, max_pairs, count);
    } else if (node_b.is_leaf) {
        TraverseBvhPair(tree_a, node_a.left_child, tree_b, idx_b, tolerance, out_pairs, max_pairs, count);
        TraverseBvhPair(tree_a, node_a.right_child, tree_b, idx_b, tolerance, out_pairs, max_pairs, count);
    } else {
        TraverseBvhPair(tree_a, node_a.left_child, tree_b, node_b.left_child, tolerance, out_pairs, max_pairs, count);
        TraverseBvhPair(tree_a, node_a.left_child, tree_b, node_b.right_child, tolerance, out_pairs, max_pairs, count);
        TraverseBvhPair(tree_a, node_a.right_child, tree_b, node_b.left_child, tolerance, out_pairs, max_pairs, count);
        TraverseBvhPair(tree_a, node_a.right_child, tree_b, node_b.right_child, tolerance, out_pairs, max_pairs, count);
    }
}

} // namespace

int Jnn_Clash_BroadPhase(
    const void* bvh_handle_a,
    const void* bvh_handle_b,
    float tolerance,
    JnnClashPair* out_pairs,
    uint32_t max_pairs,
    uint32_t* out_pair_count
) {
    if (!bvh_handle_a || !bvh_handle_b || !out_pairs || !out_pair_count) {
        return -1;
    }

    const auto* tree_a = static_cast<const BvhTree*>(bvh_handle_a);
    const auto* tree_b = static_cast<const BvhTree*>(bvh_handle_b);

    uint32_t count = 0;

    if (tree_a->root_index >= 0 && tree_b->root_index >= 0) {
        TraverseBvhPair(*tree_a, tree_a->root_index, *tree_b, tree_b->root_index, tolerance, out_pairs, max_pairs, count);
    } else {
        for (const auto& item_a : tree_a->items) {
            for (const auto& item_b : tree_b->items) {
                if (BvhTree::IntersectAABB(item_a.second, item_b.second, tolerance)) {
                    if (count < max_pairs) {
                        out_pairs[count].element_id_a = item_a.first;
                        out_pairs[count].element_id_b = item_b.first;
                        out_pairs[count].overlap_distance = ComputePenetrationDepth(item_a.second, item_b.second);

                        out_pairs[count].contact_point[0] = (std::max(item_a.second.min_x, item_b.second.min_x) + std::min(item_a.second.max_x, item_b.second.max_x)) * 0.5f;
                        out_pairs[count].contact_point[1] = (std::max(item_a.second.min_y, item_b.second.min_y) + std::min(item_a.second.max_y, item_b.second.max_y)) * 0.5f;
                        out_pairs[count].contact_point[2] = (std::max(item_a.second.min_z, item_b.second.min_z) + std::min(item_a.second.max_z, item_b.second.max_z)) * 0.5f;

                        count++;
                    }
                }
            }
        }
    }

    *out_pair_count = count;
    return 0;
}
