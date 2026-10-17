#include "bvh.h"
#include "../include/jnn_geometry_core.h"
#include <algorithm>
#include <cmath>

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

    for (const auto& item_a : tree_a->items) {
        for (const auto& item_b : tree_b->items) {
            if (BvhTree::IntersectAABB(item_a.second, item_b.second, tolerance)) {
                if (count < max_pairs) {
                    out_pairs[count].element_id_a = item_a.first;
                    out_pairs[count].element_id_b = item_b.first;
                    out_pairs[count].overlap_distance = tolerance;

                    // Approximate contact center
                    out_pairs[count].contact_point[0] = (std::max(item_a.second.min_x, item_b.second.min_x) + std::min(item_a.second.max_x, item_b.second.max_x)) * 0.5f;
                    out_pairs[count].contact_point[1] = (std::max(item_a.second.min_y, item_b.second.min_y) + std::min(item_a.second.max_y, item_b.second.max_y)) * 0.5f;
                    out_pairs[count].contact_point[2] = (std::max(item_a.second.min_z, item_b.second.min_z) + std::min(item_a.second.max_z, item_b.second.max_z)) * 0.5f;

                    count++;
                }
            }
        }
    }

    *out_pair_count = count;
    return 0;
}
