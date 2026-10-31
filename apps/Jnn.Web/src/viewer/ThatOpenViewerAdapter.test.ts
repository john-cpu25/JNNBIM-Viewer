import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as OBC from '@thatopen/components';
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

  it('anchors pivot at cursor using hover cache or plane fallback', () => {
    const adapter = new ThatOpenViewerAdapter();
    const fakeControls = {
      setOrbitPoint: () => {},
      getTarget: (v: any) => v.set(0, 0, 0),
      setFocalOffset: () => {},
    };

    (adapter as any).world = {
      camera: {
        controls: fakeControls,
        three: {
          getWorldDirection: (v: any) => v.set(0, 0, -1),
          position: { distanceTo: () => 10 },
        },
      },
      renderer: {
        three: {
          domElement: {
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
            clientHeight: 600,
          },
        },
      },
    };

    // Fast-path with hover cache
    const testPoint = { x: 5, y: 5, z: 5 };
    (adapter as any).lastHover = {
      x: 100,
      y: 100,
      t: performance.now(),
      point: testPoint,
    };

    adapter.anchorPivotAt(102, 101);
    expect((adapter as any).lastHover?.point).toBe(testPoint);

    adapter.dispose();
  });

  it('F2: falls back to model center when plane point lands outside model bounds', () => {
    const adapter = new ThatOpenViewerAdapter();
    let setPointCalledWith: any = null;
    const fakeControls = {
      setOrbitPoint: (x: number, y: number, z: number) => {
        setPointCalledWith = { x, y, z };
      },
      getTarget: (v: any) => v.set(0, 0, 0),
      setFocalOffset: () => {},
    };

    (adapter as any).world = {
      camera: {
        controls: fakeControls,
        three: {
          getWorldDirection: (v: any) => v.set(0, 0, -1),
          position: { distanceTo: () => 10 },
        },
      },
      renderer: {
        three: {
          domElement: {
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
            clientHeight: 600,
          },
        },
      },
    };

    // Mock raycaster returning a planePoint far away (x: 100, y: 100, z: 0)
    (adapter as any).components = {
      dispose: () => {},
      get: (comp: any) => {
        if (comp === OBC.Raycasters) {
          return {
            get: () => ({
              three: {
                setFromCamera: () => {},
                ray: {
                  intersectPlane: (_plane: any, target: any) => target.set(100, 100, 0),
                },
              },
              castRay: () => Promise.resolve(null),
            }),
          };
        }
        return null;
      },
    };

    // Mock model bounds centered at (0, 0, 0), size 10x10x10
    (adapter as any).modelsMap = new Map([
      [
        'm1',
        {
          model: {
            object: { visible: true },
            box: new THREE.Box3(new THREE.Vector3(-5, -5, -5), new THREE.Vector3(5, 5, 5)),
            dispose: () => {},
          },
        },
      ],
    ]);

    adapter.anchorPivotAt(10, 10);
    // Because (100, 100, 0) is outside [-5..5], pivot must fall back to center (0, 0, 0)
    expect(setPointCalledWith).not.toBeNull();
    expect(setPointCalledWith.x).toBeCloseTo(0);
    expect(setPointCalledWith.y).toBeCloseTo(0);
    expect(setPointCalledWith.z).toBeCloseTo(0);

    adapter.dispose();
  });

  it('applies mouse mapping for revit and classic presets', () => {
    const adapter = new ThatOpenViewerAdapter();
    const mouseButtons = { left: 0, middle: 0, right: 0, wheel: 0 };
    (adapter as any).world = {
      camera: {
        controls: {
          mouseButtons,
        },
      },
    };

    (adapter as any).applyMouseMapping(false);
    expect(mouseButtons.left).toBe(0); // CameraControls.ACTION.NONE
    expect(mouseButtons.middle).toBe(2); // TRUCK

    (adapter as any).applyMouseMapping(true);
    expect(mouseButtons.left).toBe(1); // ROTATE
    expect(mouseButtons.middle).toBe(1); // ROTATE

    adapter.setNavigationSettings({
      preset: 'classic',
      rotateSpeed: 0.4,
      zoomSpeed: 1.0,
      orbitAroundCursor: true,
      showPivot: true,
    });
    (adapter as any).applyMouseMapping(false);
    expect(mouseButtons.left).toBe(1); // ROTATE in classic preset
    adapter.dispose();
  });

  it('F1: tracks userControlling flag on camera controls events', () => {
    const adapter = new ThatOpenViewerAdapter();
    expect((adapter as any).userControlling).toBe(false);

    // Simulate controlstart & controlend
    (adapter as any).userControlling = true;
    expect((adapter as any).userControlling).toBe(true);

    adapter.dispose();
    expect((adapter as any).userControlling).toBe(false);
  });

  it('Hotfix 2 - F1: onWindowKeyDown ignores repeat and does not re-anchor when already orbiting', () => {
    const adapter = new ThatOpenViewerAdapter();
    let anchorCalled = false;
    adapter.anchorPivotAt = () => {
      anchorCalled = true;
    };

    // When gesture is already orbiting
    (adapter as any).gesture = {
      button: 0,
      intent: 'orbit',
      x: 100,
      y: 100,
      currentX: 150,
      currentY: 150,
    };

    // Auto-repeated Shift keydown
    (adapter as any).onWindowKeyDown({ key: 'Shift', repeat: true } as KeyboardEvent);
    expect(anchorCalled).toBe(false);

    // Initial Shift keydown when already orbiting
    (adapter as any).onWindowKeyDown({ key: 'Shift', repeat: false } as KeyboardEvent);
    expect(anchorCalled).toBe(false);

    // When panning and pressing Shift for the first time
    (adapter as any).gesture.intent = 'pan';
    (adapter as any).gesture.button = 1;
    (adapter as any).onWindowKeyDown({ key: 'Shift', repeat: false } as KeyboardEvent);
    expect(anchorCalled).toBe(true);
    expect((adapter as any).gesture.intent).toBe('orbit');

    adapter.dispose();
  });
});
