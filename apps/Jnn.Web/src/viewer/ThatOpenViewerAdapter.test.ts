import { describe, expect, it } from 'vitest';
import { ThatOpenViewerAdapter } from './ThatOpenViewerAdapter';
import type { JnnModel } from '../domain/model';

function createMockJnnModel(elementCount: number): JnnModel {
  return {
    schemaVersion: '0.1.0',
    modelId: 'test-model.ifc',
    modelRevisionId: 'rev-001',
    sourceFormat: 'IFC',
    name: 'test-model.ifc',
    ifcSchema: 'IFC2X3',
    fileSize: 1024,
    projectName: 'Test Project',
    siteName: 'Test Site',
    buildingName: 'Test Building',
    units: 'm',
    upAxis: 'Z',
    storeys: [{ id: 's1', name: 'Level 1', elevation: 0 }],
    elements: Array.from({ length: elementCount }, (_, i) => ({
      modelId: 'test-model.ifc',
      modelRevisionId: 'rev-001',
      sourceFormat: 'IFC',
      sourceElementId: String(i + 1),
      globalId: `guid-${i + 1}`,
      id: `test-model.ifc:${i + 1}`,
      name: `Element #${i + 1}`,
      category: 'IfcBeam',
      type: 'BeamType',
      material: 'Concrete',
      storey: 'Level 1',
      transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      properties: [],
      quantities: [],
      meshRefs: [],
      geometryStatus: 'ok',
      importWarnings: [],
    })),
  };
}

describe('ThatOpenViewerAdapter unit & performance', () => {
  it('declares all required capabilities for T07', () => {
    const adapter = new ThatOpenViewerAdapter();
    for (const cap of ['select', 'visibility', 'isolate', 'highlight', 'xray', 'fitToView', 'camera', 'getProperties'] as const) {
      expect(adapter.capabilities.has(cap)).toBe(true);
    }
  });

  it('handles selection, hide, isolate, and debugState', () => {
    const adapter = new ThatOpenViewerAdapter();
    const model = createMockJnnModel(50);
    // Directly inject model into modelsMap for unit testing adapter logic
    (adapter as any).modelsMap.set(model.modelId, {
      model: {
        modelId: model.modelId,
        object: { visible: true },
        box: null,
        setVisible: async () => {},
        setGhostItems: async () => {},
        clearGhost: () => {},
        dispose: () => {},
      },
      jnnModel: model,
    });

    // Initial debug state
    expect(adapter.debugState().elementCount).toBe(50);
    expect(adapter.debugState().visibleCount).toBe(50);
    expect(adapter.debugState().selected).toEqual([]);

    // Select element
    const selectRes = adapter.select(['test-model.ifc:5']);
    expect(selectRes.ok).toBe(true);
    expect(adapter.debugState().selected).toEqual(['test-model.ifc:5']);

    // Hide 3 elements
    adapter.setHidden(['test-model.ifc:1', 'test-model.ifc:2', 'test-model.ifc:3']);
    expect(adapter.debugState().visibleCount).toBe(47);

    // Isolate 5 elements
    adapter.isolate([
      'test-model.ifc:10',
      'test-model.ifc:11',
      'test-model.ifc:12',
      'test-model.ifc:13',
      'test-model.ifc:14',
    ]);
    expect(adapter.debugState().visibleCount).toBe(5);

    // Clear isolation and hidden
    adapter.isolate([]);
    adapter.setHidden([]);
    expect(adapter.debugState().visibleCount).toBe(50);

    // X-ray toggle
    adapter.setXray(true);
    expect(adapter.debugState().xray).toBe(true);
    adapter.setXray(false);
    expect(adapter.debugState().xray).toBe(false);

    // Multiple highlight colors coexist
    expect(adapter.highlight(['test-model.ifc:1'], '#ff0000').ok).toBe(true);
    expect(adapter.highlight(['test-model.ifc:2'], '#00ff00').ok).toBe(true);
    expect(adapter.highlight(null).ok).toBe(true);

    adapter.dispose();
  });

  it('performance: isolates 1,000 elements in < 15ms without UI freeze', () => {
    const adapter = new ThatOpenViewerAdapter();
    const model = createMockJnnModel(2000);
    (adapter as any).modelsMap.set(model.modelId, {
      model: {
        modelId: model.modelId,
        object: { visible: true },
        box: null,
        setVisible: async () => {},
        dispose: () => {},
      },
      jnnModel: model,
    });

    const target1000 = Array.from({ length: 1000 }, (_, i) => `test-model.ifc:${i + 1}`);

    const t0 = performance.now();
    const res = adapter.isolate(target1000);
    const durationMs = performance.now() - t0;

    expect(res.ok).toBe(true);
    expect(adapter.debugState().visibleCount).toBe(1000);
    expect(durationMs).toBeLessThan(15);
    console.log(`[Benchmark T07] Time to isolate 1,000 elements: ${durationMs.toFixed(3)} ms`);

    adapter.dispose();
  });

  it('applies section planes and boxes in model coordinates (+Z up)', () => {
    const adapter = new ThatOpenViewerAdapter();
    for (const cap of ['sectionPlane', 'sectionBox'] as const) {
      expect(adapter.capabilities.has(cap)).toBe(true);
    }

    const model = createMockJnnModel(10);
    (adapter as any).modelsMap.set(model.modelId, {
      model: {
        modelId: model.modelId,
        object: { visible: true },
        box: null,
        useClippingPlanes: () => {},
        setVisible: async () => {},
        dispose: () => {},
      },
      jnnModel: model,
    });
    (adapter as any).modelBounds = { min: [0, 0, 0], max: [10, 10, 10] };

    // Plan cut along Z
    const planeRes = adapter.setSection({ kind: 'plane', axis: 'z', offset: 1.25, flipped: false });
    expect(planeRes.ok).toBe(true);
    expect(adapter.debugState().clipPlaneCount).toBe(1);
    expect(adapter.isPointClipped([5, 5, 0.5])).toBe(false);
    expect(adapter.isPointClipped([5, 5, 2.0])).toBe(true);

    // Flipped Z cut
    adapter.setSection({ kind: 'plane', axis: 'z', offset: 1.25, flipped: true });
    expect(adapter.isPointClipped([5, 5, 2.0])).toBe(false);
    expect(adapter.isPointClipped([5, 5, 0.5])).toBe(true);

    // Cut along Y
    adapter.setSection({ kind: 'plane', axis: 'y', offset: 7, flipped: false });
    expect(adapter.isPointClipped([0, 6, 0])).toBe(false);
    expect(adapter.isPointClipped([0, 8, 0])).toBe(true);

    // Section box
    const boxRes = adapter.setSection({ kind: 'box', min: [0, 0, 0], max: [6, 5, 3.6] });
    expect(boxRes.ok).toBe(true);
    expect(adapter.debugState().clipPlaneCount).toBe(6);
    expect(adapter.isPointClipped([3, 2, 1])).toBe(false);
    expect(adapter.isPointClipped([7, 2, 1])).toBe(true);
    expect(adapter.isPointClipped([3, -1, 1])).toBe(true);

    // Invalid section box
    const badBox = adapter.setSection({ kind: 'box', min: [1, 0, 0], max: [0, 1, 1] });
    expect(badBox.ok).toBe(false);

    // Remove section
    adapter.setSection(null);
    expect(adapter.debugState().clipPlaneCount).toBe(0);

    adapter.dispose();
  });

  it('manages navigation settings, orbitBy, and resets focal offset', () => {
    const adapter = new ThatOpenViewerAdapter();
    const setNavRes = adapter.setNavigationSettings({
      preset: 'classic',
      rotateSpeed: 0.6,
      zoomSpeed: 1.2,
      orbitAroundCursor: false,
      showPivot: false,
    });
    expect(setNavRes.ok).toBe(true);

    let focalOffsetCalled = false;
    let rotateCalled = false;
    (adapter as any).world = {
      camera: {
        controls: {
          setFocalOffset: (x: number, y: number, z: number, enableTransition: boolean) => {
            focalOffsetCalled = true;
            expect(x).toBe(0);
            expect(y).toBe(0);
            expect(z).toBe(0);
            expect(enableTransition).toBe(false);
          },
          rotate: (az: number, pol: number, anim: boolean) => {
            rotateCalled = true;
            expect(az).toBe(0.5);
            expect(pol).toBe(0.2);
            expect(anim).toBe(true);
          },
          setLookAt: () => {},
        },
      },
    };

    const orbitRes = adapter.orbitBy(0.5, 0.2, true);
    expect(orbitRes.ok).toBe(true);
    expect(rotateCalled).toBe(true);

    (adapter as any).resetPivotOffset();
    expect(focalOffsetCalled).toBe(true);

    adapter.dispose();
  });
});
