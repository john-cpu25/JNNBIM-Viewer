import { describe, expect, it, vi } from 'vitest';
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
      orbitAroundSelection: false,
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
      orbitAroundSelection: true,
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

  it('Hotfix 2 - F2: skip forced fragments update on rest while user is still dragging', () => {
    const adapter = new ThatOpenViewerAdapter();
    const updateSpy = vi.fn();
    (adapter as any).fragments = {
      core: {
        update: updateSpy,
      },
    };

    // User is dragging (userControlling is true)
    (adapter as any).userControlling = true;
    (adapter as any).onControlsRest();
    expect(updateSpy).not.toHaveBeenCalled();

    // User releases control (userControlling becomes false)
    (adapter as any).userControlling = false;
    (adapter as any).onControlsRest();
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledWith(true);

    adapter.dispose();
  });

  it('Hotfix 2 - F3: avoids overlapping raycasts and buffers latest pending request', async () => {
    const adapter = new ThatOpenViewerAdapter();
    let resolveFirstRaycast!: (value: any) => void;
    const firstPromise = new Promise((resolve) => {
      resolveFirstRaycast = resolve;
    });

    const castRaySpy = vi
      .fn()
      .mockImplementationOnce(() => firstPromise)
      .mockResolvedValueOnce({ point: new THREE.Vector3(1, 2, 3) });

    const mockCaster = {
      three: {
        setFromCamera: vi.fn(),
        ray: {
          intersectPlane: vi.fn().mockReturnValue(new THREE.Vector3(0, 0, 0)),
        },
      },
      castRay: castRaySpy,
    };

    const mockRaycasters = {
      get: vi.fn().mockReturnValue(mockCaster),
    };

    (adapter as any).components = {
      get: vi.fn().mockReturnValue(mockRaycasters),
      dispose: vi.fn(),
    };

    (adapter as any).world = {
      camera: {
        controls: {
          setOrbitPoint: vi.fn(),
          getTarget: vi.fn().mockReturnValue(new THREE.Vector3()),
        },
        three: {
          getWorldDirection: vi.fn().mockReturnValue(new THREE.Vector3(0, 0, -1)),
        },
      },
      renderer: {
        three: {
          domElement: {
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
          },
        },
      },
    };

    // First call initiates raycast
    adapter.anchorPivotAt(100, 100);
    expect(castRaySpy).toHaveBeenCalledTimes(1);
    expect((adapter as any).raycastInFlight).toBe(true);

    // Concurrent second call while first is in-flight: should NOT call castRay immediately
    adapter.anchorPivotAt(200, 200);
    expect(castRaySpy).toHaveBeenCalledTimes(1);
    expect((adapter as any).pendingRaycast).not.toBeNull();

    // Resolving first raycast should flush the pending raycast
    resolveFirstRaycast({ point: new THREE.Vector3(0, 0, 0) });
    await new Promise((r) => setTimeout(r, 10));

    expect(castRaySpy).toHaveBeenCalledTimes(2);
    expect((adapter as any).raycastInFlight).toBe(false);

    adapter.dispose();
  });

  it('Hotfix 2 - M1: late raycast from request 1 does not overwrite pivot of request 2', async () => {
    const adapter = new ThatOpenViewerAdapter();
    let resolveFirstRaycast!: (value: any) => void;
    const firstPromise = new Promise((resolve) => {
      resolveFirstRaycast = resolve;
    });

    const setOrbitPointSpy = vi.fn();
    const castRaySpy = vi.fn().mockReturnValue(firstPromise);

    const mockCaster = {
      three: {
        setFromCamera: vi.fn(),
        ray: {
          intersectPlane: vi.fn().mockReturnValue(new THREE.Vector3(0, 0, 0)),
        },
      },
      castRay: castRaySpy,
    };

    (adapter as any).components = {
      get: vi.fn().mockReturnValue({ get: vi.fn().mockReturnValue(mockCaster) }),
      dispose: vi.fn(),
    };

    (adapter as any).world = {
      camera: {
        controls: {
          setOrbitPoint: setOrbitPointSpy,
          getTarget: vi.fn().mockReturnValue(new THREE.Vector3()),
        },
        three: {
          getWorldDirection: vi.fn().mockReturnValue(new THREE.Vector3(0, 0, -1)),
        },
      },
      renderer: {
        three: {
          domElement: {
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
          },
        },
      },
    };

    // First anchor request initiates raycast 1
    adapter.anchorPivotAt(100, 100);
    expect((adapter as any).anchorRequestId).toBe(1);

    // Second anchor request immediately (e.g. user drags elsewhere)
    adapter.anchorPivotAt(400, 400);
    expect((adapter as any).anchorRequestId).toBe(2);

    // Now late raycast 1 resolves with point (1, 1, 1)
    setOrbitPointSpy.mockClear();
    resolveFirstRaycast({ point: new THREE.Vector3(1, 1, 1) });
    await new Promise((r) => setTimeout(r, 10));

    // setOrbitPoint should NOT be called with raycast 1 point
    const calledWithPoint1 = setOrbitPointSpy.mock.calls.some(
      (args) => args[1]?.x === 1 && args[1]?.y === 1 && args[1]?.z === 1,
    );
    expect(calledWithPoint1).toBe(false);

    adapter.dispose();
  });

  it('beginOrbit sets orbit point to selectionCenter when orbitAroundSelection is true', () => {
    const adapter = new ThatOpenViewerAdapter();
    const setOrbitPointSpy = vi.fn();
    const target = new THREE.Vector3(0, 0, 0);

    (adapter as any).world = {
      camera: {
        controls: {
          setOrbitPoint: setOrbitPointSpy,
          getTarget: vi.fn().mockReturnValue(target),
        },
      },
    };

    const mockCenter = new THREE.Vector3(12, 34, 56);
    (adapter as any).selectionCenter = mockCenter;
    (adapter as any).nav.orbitAroundSelection = true;

    const res = adapter.beginOrbit();
    expect(res.ok).toBe(true);
    expect(setOrbitPointSpy).toHaveBeenCalledWith(12, 34, 56);

    // When orbitAroundSelection is false, beginOrbit does not change orbit point
    setOrbitPointSpy.mockClear();
    (adapter as any).nav.orbitAroundSelection = false;
    adapter.beginOrbit();
    expect(setOrbitPointSpy).not.toHaveBeenCalled();

    adapter.dispose();
  });

  describe('Selection center caching & pivot priority', () => {
    it('refreshSelectionCenter: computes centre for 1 element using getMergedBox', async () => {
      const adapter = new ThatOpenViewerAdapter();
      const mockBox = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 20, 30));
      const getMergedBoxSpy = vi.fn().mockResolvedValue(mockBox);

      (adapter as any).modelsMap.set('modelA', {
        id: 'modelA',
        model: {
          object: { visible: true },
          getMergedBox: getMergedBoxSpy,
        },
      });

      (adapter as any).selection = new Set(['modelA:42']);
      await (adapter as any).refreshSelectionCenter();

      expect(getMergedBoxSpy).toHaveBeenCalledWith([42]);
      expect((adapter as any).selectionCenter).toEqual(new THREE.Vector3(5, 10, 15));

      adapter.dispose();
    });

    it('refreshSelectionCenter: computes union centre for multiple elements across models', async () => {
      const adapter = new ThatOpenViewerAdapter();
      const box1 = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 10, 10)); // center (5, 5, 5)
      const box2 = new THREE.Box3(new THREE.Vector3(10, 10, 10), new THREE.Vector3(20, 20, 20)); // union: (0,0,0) to (20,20,20) -> center (10, 10, 10)

      (adapter as any).modelsMap.set('modelA', {
        id: 'modelA',
        model: {
          object: { visible: true },
          getMergedBox: vi.fn().mockResolvedValue(box1),
        },
      });
      (adapter as any).modelsMap.set('modelB', {
        id: 'modelB',
        model: {
          object: { visible: true },
          getMergedBox: vi.fn().mockResolvedValue(box2),
        },
      });

      (adapter as any).selection = new Set(['modelA:1', 'modelB:2']);
      await (adapter as any).refreshSelectionCenter();

      expect((adapter as any).selectionCenter).toEqual(new THREE.Vector3(10, 10, 10));

      adapter.dispose();
    });

    it('refreshSelectionCenter: excludes hidden elements and sets selectionCenter null if empty/all hidden', async () => {
      const adapter = new ThatOpenViewerAdapter();
      const getMergedBoxSpy = vi.fn();

      (adapter as any).modelsMap.set('modelA', {
        id: 'modelA',
        model: {
          object: { visible: true },
          getMergedBox: getMergedBoxSpy,
        },
      });

      // Empty selection
      (adapter as any).selection = new Set();
      await (adapter as any).refreshSelectionCenter();
      expect((adapter as any).selectionCenter).toBeNull();
      expect(getMergedBoxSpy).not.toHaveBeenCalled();

      // Selected element is hidden
      (adapter as any).selection = new Set(['modelA:10']);
      (adapter as any).visibility = { hidden: new Set(['modelA:10']), isolated: new Set() };
      await (adapter as any).refreshSelectionCenter();
      expect((adapter as any).selectionCenter).toBeNull();
      expect(getMergedBoxSpy).not.toHaveBeenCalled();

      adapter.dispose();
    });

    it('refreshSelectionCenter: discards stale async responses when selection changes rapidly', async () => {
      const adapter = new ThatOpenViewerAdapter();
      let resolveFirst!: (val: any) => void;
      const firstPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });

      const fastBox = new THREE.Box3(new THREE.Vector3(100, 100, 100), new THREE.Vector3(100, 100, 100));

      (adapter as any).modelsMap.set('modelA', {
        id: 'modelA',
        model: {
          object: { visible: true },
          getMergedBox: vi.fn().mockImplementation((ids: number[]) => {
            if (ids.includes(1)) return firstPromise;
            return Promise.resolve(fastBox);
          }),
        },
      });

      // Request 1: slow
      (adapter as any).selection = new Set(['modelA:1']);
      const p1 = (adapter as any).refreshSelectionCenter();

      // Request 2: fast
      (adapter as any).selection = new Set(['modelA:2']);
      const p2 = (adapter as any).refreshSelectionCenter();
      await p2;

      expect((adapter as any).selectionCenter).toEqual(new THREE.Vector3(100, 100, 100));

      // Now resolve request 1 late with (0, 0, 0)
      const slowBox = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0));
      resolveFirst(slowBox);
      await p1;

      // Selection center must remain (100, 100, 100)
      expect((adapter as any).selectionCenter).toEqual(new THREE.Vector3(100, 100, 100));

      adapter.dispose();
    });

    it('priority order: selectionCenter > hover cache > plane fallback', () => {
      const adapter = new ThatOpenViewerAdapter();
      const setOrbitPointSpy = vi.fn();

      const mockCaster = {
        three: {
          setFromCamera: vi.fn(),
          ray: {
            intersectPlane: vi.fn().mockImplementation((_plane: any, out: THREE.Vector3) => out.set(0, 0, 0)),
          },
        },
        castRay: vi.fn().mockResolvedValue(null),
      };

      (adapter as any).components = {
        get: vi.fn().mockReturnValue({ get: vi.fn().mockReturnValue(mockCaster) }),
        dispose: vi.fn(),
      };

      (adapter as any).world = {
        camera: {
          controls: {
            setOrbitPoint: setOrbitPointSpy,
            getTarget: vi.fn().mockReturnValue(new THREE.Vector3(0, 0, 0)),
          },
          three: {
            getWorldDirection: vi.fn().mockReturnValue(new THREE.Vector3(0, 0, -1)),
          },
        },
        renderer: {
          three: {
            domElement: {
              getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
            },
          },
        },
      };

      const selCenter = new THREE.Vector3(1, 2, 3);
      const hoverPoint = new THREE.Vector3(4, 5, 6);

      // (1) Selection active and setting true -> uses selCenter
      (adapter as any).selectionCenter = selCenter;
      (adapter as any).nav.orbitAroundSelection = true;
      (adapter as any).lastHover = { point: hoverPoint, x: 100, y: 100, t: performance.now() };

      adapter.anchorPivotAt(100, 100);
      expect(setOrbitPointSpy).toHaveBeenLastCalledWith(1, 2, 3);

      // (2) orbitAroundSelection is false -> skips selection, uses hover cache
      (adapter as any).nav.orbitAroundSelection = false;
      adapter.anchorPivotAt(100, 100);
      expect(setOrbitPointSpy).toHaveBeenLastCalledWith(4, 5, 6);

      // (3) Hover cache empty -> falls back to plane/model fallback
      (adapter as any).lastHover = null;
      adapter.anchorPivotAt(100, 100);
      expect(setOrbitPointSpy).toHaveBeenLastCalledWith(0, 0, 0);

      adapter.dispose();
    });

    it('getMeasureItems calculates correct values and converts units even when Line has default units "m"', () => {
      const adapter = new ThatOpenViewerAdapter();
      // Set measure settings to mm and precision 1
      adapter.setMeasureSettings({
        unit: 'mm',
        precision: 1,
        snap: { vertex: true, edge: true, face: false },
      });

      // Mock a Line3 object with ThatOpen default properties (_units = "m", distance = 8.1206)
      const mockLine = {
        id: 'test-line-1',
        _mode: 'length',
        units: 'm', // ThatOpen default from Line3.clone()
        value: 8.12, // Old raw value in meters
        distance: () => 8.1206,
        start: new THREE.Vector3(0, 0, 0),
        end: new THREE.Vector3(8.1206, 0, 0),
      };

      (adapter as any).lengthMeasurer = {
        list: [mockLine],
        dispose: vi.fn(),
      };

      const items = (adapter as any).getMeasureItems();
      expect(items.length).toBe(1);
      expect(items[0].unit).toBe('mm');
      expect(items[0].value).toBe(8120.6); // Converted to mm with precision 1

      // Test changing settings to cm with precision 2
      adapter.setMeasureSettings({
        unit: 'cm',
        precision: 2,
        snap: { vertex: true, edge: true, face: false },
      });
      const itemsCm = (adapter as any).getMeasureItems();
      expect(itemsCm[0].unit).toBe('cm');
      expect(itemsCm[0].value).toBe(812.06);

      adapter.dispose();
    });
  });
});
