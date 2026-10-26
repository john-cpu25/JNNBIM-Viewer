import { describe, expect, it } from 'vitest';
import fixture from './__fixtures__/building-arch-fixture.json';
import {
  mapIfcToJnnModel,
  parseItemPropertiesAndQuantities,
  parseSpatialStructure,
  toEnglishCategory,
  toIfcClassName,
} from './mapToJnn';

describe('mapToJnn module', () => {
  it('normalizes IFC class names and English category names correctly', () => {
    expect(toIfcClassName('IFCWALL')).toBe('IfcWall');
    expect(toIfcClassName('IFCSLAB')).toBe('IfcSlab');
    expect(toIfcClassName('IFCBUILDINGELEMENTPROXY')).toBe('IfcBuildingElementProxy');
    expect(toIfcClassName(null)).toBe('IfcProduct');

    expect(toEnglishCategory('IfcWall')).toBe('Walls');
    expect(toEnglishCategory('IfcSlab')).toBe('Slabs');
    expect(toEnglishCategory('IfcRoof')).toBe('Roofs');
    expect(toEnglishCategory('IfcBuildingElementProxy')).toBe('Generic Models');
  });

  it('parses spatial structure tree extracting project, storeys and element mapping', () => {
    const res = parseSpatialStructure(fixture.spatialStructure);
    expect(res.projectLocalId).toBe(13);
    expect(res.siteLocalId).toBe(18);
    expect(res.buildingLocalId).toBe(25);
    expect(res.storeyLocalIds).toContain(36);

    // Wall 319 should be in Storey #36
    expect(res.elementStoreyMap.get(319)).toBe('Storey #36');
    // Slab 44 should be in Storey #36
    expect(res.elementStoreyMap.get(44)).toBe('Storey #36');
    // Roof 546 is under building
    expect(res.elementStoreyMap.has(546)).toBe(true);
  });

  it('maps fixture into a valid JnnModel with correct metadata and elements', () => {
    const model = mapIfcToJnnModel({
      modelId: 'test-arch',
      filename: 'Building-Architecture.ifc',
      metadata: fixture.metadata,
      spatialRoot: fixture.spatialStructure,
      spatialHeadersData: fixture.spatialHeaders,
      itemsBasicData: fixture.itemsBasic,
      fileSize: 92542,
    });

    expect(model.name).toBe('Building-Architecture.ifc');
    expect(model.projectName).toBe('ifc silly sample scene - project');
    expect(model.buildingName).toBe('Single-family house');
    expect(model.ifcSchema).toBe('IFC2X3');
    expect(model.application).toContain('Sketchup-IFC-manager');
    expect(model.fileSize).toBe(92542);
    expect(model.storeys.length).toBe(1);
    expect(model.storeys[0]!.name).toBe('00 groundfloor');

    // 3 basic elements mapped
    expect(model.elements.length).toBe(3);
    const wall = model.elements.find((e) => e.sourceElementId === '319')!;
    expect(wall).toBeDefined();
    expect(wall.id).toBe('test-arch:319');
    expect(wall.category).toBe('IfcWall');
    expect(wall.globalId).toBe('1AQAupaRP1txwK1AGiN61V');
    expect(wall.storey).toBe('00 groundfloor');
  });

  it('parses item properties and quantities from IsDefinedBy relations', () => {
    const res = parseItemPropertiesAndQuantities(fixture.wall319Full);

    // Should extract IFC Attributes, Pset_WallCommon
    expect(res.properties.length).toBeGreaterThanOrEqual(2);

    const ifcAttrs = res.properties.find((p) => p.name === 'IFC Attributes')!;
    expect(ifcAttrs).toBeDefined();
    expect(ifcAttrs.properties['GlobalId']).toBe('1AQAupaRP1txwK1AGiN61V');
    expect(ifcAttrs.properties['Tag']).toBe('454425');

    const wallCommon = res.properties.find((p) => p.name === 'Pset_WallCommon')!;
    expect(wallCommon).toBeDefined();
    expect(wallCommon.properties['LoadBearing']).toBe(true);
    expect(wallCommon.properties['FireRating']).toBe('REI 60');

    // Quantities (Qto_WallBaseQuantities)
    expect(res.quantities.length).toBe(4);
    const vol = res.quantities.find((q) => q.name === 'NetVolume')!;
    expect(vol).toBeDefined();
    expect(vol.value).toBe(1.269);
    expect(vol.unit).toBe('m³');
    expect(vol.origin).toBe('native');

    const width = res.quantities.find((q) => q.name === 'Width')!;
    expect(width.value).toBe(0.2);
    expect(width.unit).toBe('m');

    // Type
    expect(res.type).toBe('Basic Wall: Timber 200mm');
  });
});
