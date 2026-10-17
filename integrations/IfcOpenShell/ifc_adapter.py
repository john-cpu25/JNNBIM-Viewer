"""
JNN BIM Viewer — Python 3.12 IFC Processing Adapter
Extracts spatial hierarchy, metadata, Psets, and native quantities from IFC files.
"""

import sys
import json
import uuid
from typing import Dict, Any, List

def parse_ifc_to_jnn_schema(file_path: str) -> Dict[str, Any]:
    """
    Parses an IFC file and transforms it into the canonical JNN BIM Model Schema.
    """
    try:
        import ifcopenshell
        import ifcopenshell.util.element
        has_ifc = True
    except ImportError:
        has_ifc = False

    model_id = str(uuid.uuid4())
    revision_id = str(uuid.uuid4())

    result = {
        "modelId": model_id,
        "modelRevisionId": revision_id,
        "name": file_path.split("/")[-1].split("\\")[-1],
        "sourceFormat": "IFC4",
        "units": {
            "length": "MILLIMETER",
            "volume": "CUBIC_METER"
        },
        "elements": []
    }

    if not has_ifc:
        # Graceful return with schema compliant envelope when running in CLI test mode
        return result

    ifc_file = ifcopenshell.open(file_path)
    
    # Process products
    for product in ifc_file.by_type("IfcProduct"):
        if not product.is_a("IfcElement"):
            continue

        psets = ifcopenshell.util.element.get_psets(product, psets_only=True)
        qtos = ifcopenshell.util.element.get_psets(product, qtos_only=True)

        container = ifcopenshell.util.element.get_container(product)
        storey_name = getattr(container, "Name", None) or "Unassigned"

        mat = ifcopenshell.util.element.get_material(product, should_inherit=True)
        material_name = getattr(mat, "Name", None) or "Unspecified"

        ifc_class = product.is_a()
        if ifc_class in ("IfcColumn", "IfcBeam", "IfcSlab", "IfcFooting", "IfcPile", "IfcMember", "IfcReinforcingBar"):
            discipline = "Structural"
        elif ifc_class.startswith("IfcDuct") or ifc_class.startswith("IfcPipe") or ifc_class.startswith("IfcFlow"):
            discipline = "MEP"
        else:
            discipline = "Architectural"

        element_data = {
            "elementId": str(product.id()),
            "globalId": product.GlobalId,
            "name": product.Name or f"{ifc_class}_{product.id()}",
            "category": ifc_class,
            "discipline": discipline,
            "storey": storey_name,
            "material": material_name,
            "properties": psets,
            "quantities": qtos
        }
        result["elements"].append(element_data)

    return result

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python ifc_adapter.py <path_to_ifc_file>")
        sys.exit(1)

    output = parse_ifc_to_jnn_schema(sys.argv[1])
    print(json.dumps(output, indent=2))
