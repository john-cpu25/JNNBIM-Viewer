import json
import logging
from pathlib import Path
from ifcclash.ifcclash import Clasher, ClashSettings
import ifcopenshell

repo_root = Path(__file__).resolve().parents[3]
arch_path = str(repo_root / "samples-local" / "building-arch-2x3.ifc")
struct_path = str(repo_root / "samples-local" / "building-struct-2x3.ifc")

# Run 1: Allow touching = True (Standard ifcclash)
settings = ClashSettings()
settings.logger = logging.getLogger("ifcclash")
clasher = Clasher(settings)
clasher.clash_sets = [
    {
        "name": "Arch_x_Struct_Touching",
        "a": [{"file": arch_path, "mode": "i"}],
        "b": [{"file": struct_path, "mode": "i"}],
        "mode": "collision",
        "tolerance": 0.0,
        "allow_touching": True,
    },
    {
        "name": "Arch_x_Struct_Penetration",
        "a": [{"file": arch_path, "mode": "i"}],
        "b": [{"file": struct_path, "mode": "i"}],
        "mode": "collision",
        "tolerance": 0.0,
        "allow_touching": False,
    }
]

clasher.clash()

touching_clashes = clasher.clash_sets[0].get("clashes", {})
penetration_clashes = clasher.clash_sets[1].get("clashes", {})

def format_clashes(clashes_dict):
    out = []
    for k, v in clashes_dict.items():
        out.append({
            "key": k,
            "a_guid": v.get("a_global_id"),
            "b_guid": v.get("b_global_id"),
            "a_class": v.get("a_ifc_class"),
            "b_class": v.get("b_ifc_class"),
            "a_name": v.get("a_name"),
            "b_name": v.get("b_name"),
            "type": str(v.get("type")),
            "distance": float(v.get("distance", 0.0)),
        })
    return out

result = {
    "touching_collisions": format_clashes(touching_clashes),
    "strict_penetrations": format_clashes(penetration_clashes),
}

print(json.dumps(result))
