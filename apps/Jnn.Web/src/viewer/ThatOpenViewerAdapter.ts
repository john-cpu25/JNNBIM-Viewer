/**
 * ThatOpenViewerAdapter — implementation of ViewerAdapter using That Open Engine
 * (@thatopen/components, @thatopen/fragments, web-ifc) for high-performance IFC rendering.
 *
 * Coordinates:
 * - Model coordinates in JNN/IFC use +Z up.
 * - That Open / Three.js scene uses +Y up.
 * - Transformation:
 *     toThree: (x, y, z) -> (x, z, -y)
 *     toModel: (x, y, z) -> (x, -z, y)
 */
import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as OBCF from '@thatopen/components-front';
import * as WebIFC from 'web-ifc';
import * as FRAGS from '@thatopen/fragments';
import type { FragmentsModel } from '@thatopen/fragments';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { IDENTITY_TRANSFORM, type JnnElement, type JnnModel, type PropertySet } from '../domain/model';
import { boundsOf, center as boundsCenter, isEmpty, size as boundsSize } from '../domain/bounds';
import { isVisible, type VisibilityState } from '../domain/visibility';
import {
  mapIfcToJnnModel,
  parseItemPropertiesAndQuantities,
  parseSpatialStructure,
  type SpatialNode,
} from '../ifc/mapToJnn';
import { computeSha256, getCachedIfcModel, getIfcCacheStats, saveCachedIfcModel } from '../lib/ifcCache';
import {
  Emitter,
  fail,
  ok,
  okVoid,
  type AdapterResult,
  type Bounds,
  type CameraState,
  type PickResult,
  type SectionSpec,
  type Vec3,
  type ViewerAdapter,
  type ViewerCapability,
  type ViewerEvents,
  type ViewPreset,
  type NavigationSettings,
  DEFAULT_NAV,
  DEFAULT_MEASURE_SETTINGS,
  type MeasureItem,
  type MeasureSettings,
  type MeasureTool,
} from './ViewerAdapter';
import {
  baseMapping,
  boxSelectMode,
  choosePivot,
  DRAG_THRESHOLD_PX,
  intentOnDown,
  normalizeRect,
  orbitMapping,
  shouldReanchorOnShift,
  shouldUseHoverCache,
  worldUnitsPerPixel,
  type GestureIntent,
  type HoverCache,
} from './navigation';
import { SectionGizmo, type HandleId } from './sectionGizmo';
import { axisDragParam, clampBox, snapValue } from './sectionMath';

// Global patch for WebIFC 0.0.78 StreamMeshes signature mismatch
let webIfcPatched = false;
function patchWebIfcOnce() {
  if (webIfcPatched) return;
  webIfcPatched = true;
  const orig = WebIFC.IfcAPI.prototype.StreamMeshes;
  WebIFC.IfcAPI.prototype.StreamMeshes = function (
    modelID: number,
    expressIDs: number[],
    meshCallback: any,
    ...args: any[]
  ) {
    try {
      return (this as any).wasmModule.StreamMeshes(modelID, expressIDs, meshCallback);
    } catch {
      return orig.call(this, modelID, expressIDs, meshCallback, ...args);
    }
  };
}

const THEME_COLORS = {
  light: 0xeef0f2,
  dark: 0x15181c,
} as const;

const PRESET_DIRS: Record<ViewPreset, Vec3> = {
  iso: [1, -1, 0.8],
  top: [0, -0.0001, 1],
  bottom: [0, 0.0001, -1],
  front: [0, -1, 0],
  back: [0, 1, 0],
  left: [-1, 0, 0],
  right: [1, 0, 0],
  'top-front': [0, -1, 1],
  'top-back': [0, 1, 1],
  'top-left': [-1, 0, 1],
  'top-right': [1, 0, 1],
  'bottom-front': [0, -1, -1],
  'bottom-back': [0, 1, -1],
  'bottom-left': [-1, 0, -1],
  'bottom-right': [1, 0, -1],
  'front-left': [-1, -1, 0],
  'front-right': [1, -1, 0],
  'back-left': [-1, 1, 0],
  'back-right': [1, 1, 0],
  'top-front-left': [-1, -1, 1],
  'top-front-right': [1, -1, 1],
  'top-back-left': [-1, 1, 1],
  'top-back-right': [1, 1, 1],
  'bottom-front-left': [-1, -1, -1],
  'bottom-front-right': [1, -1, -1],
  'bottom-back-left': [-1, 1, -1],
  'bottom-back-right': [1, 1, -1],
};

const toThree = (p: Vec3): THREE.Vector3 => new THREE.Vector3(p[0], p[2], -p[1]);
const toModel = (v: THREE.Vector3): Vec3 => [v.x, -v.z, v.y];

export class ThatOpenViewerAdapter implements ViewerAdapter {
  readonly id = 'thatopen';
  readonly capabilities: ReadonlySet<ViewerCapability> = new Set<ViewerCapability>([
    'loadModel',
    'loadIfc',
    'fitToView',
    'camera',
    'getProperties',
    'select',
    'visibility',
    'isolate',
    'highlight',
    'xray',
    'sectionPlane',
    'sectionBox',
    'measure',
  ]);

  private readonly events = new Emitter<ViewerEvents>();
  private components: OBC.Components | null = null;
  private world: (OBC.SimpleWorld<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBC.SimpleRenderer>) | null = null;
  private fragments: OBC.FragmentsManager | null = null;
  private ifcLoader: OBC.IfcLoader | null = null;
  private activeModel: FragmentsModel | null = null;
  private modelsMap = new Map<string, { model: FragmentsModel; jnnModel: JnnModel }>();
  private modelBounds: Bounds | null = null;
  private parsedModel: JnnModel | null = null;
  private propertiesCache = new Map<string, { element: JnnElement; propertySets: PropertySet[] }>();
  private disposed = false;
  private initializedPromise: Promise<void> | null = null;
  private currentProjection: CameraState['projection'] = 'perspective';

  private currentMeasureTool: MeasureTool | null = null;
  private measureSettings: MeasureSettings = structuredClone(DEFAULT_MEASURE_SETTINGS);
  private lengthMeasurer: OBCF.LengthMeasurement | null = null;
  private angleMeasurer: OBCF.AngleMeasurement | null = null;
  private areaMeasurer: OBCF.AreaMeasurement | null = null;
  private volumeMeasurer: OBCF.VolumeMeasurement | null = null;
  private currentTheme: 'light' | 'dark' = 'dark';

  private selection = new Set<string>();
  private visibility: VisibilityState = { hidden: new Set(), isolated: new Set() };
  private activeHighlightStyles = new Set<string>();
  private xray = false;
  private highlighter: OBCF.Highlighter | null = null;
  private pointerDown: { x: number; y: number } | null = null;
  private lastHoverAt = 0;
  private hovered: string | null = null;
  private boundCanvas: HTMLCanvasElement | null = null;
  private boundContainer: HTMLElement | null = null;
  private gesture: {
    intent: GestureIntent;
    x: number;
    y: number;
    currentX: number;
    currentY: number;
    button: number;
    pointerId: number;
  } | null = null;
  private lastMiddleDown = 0;

  private clipPlanes: THREE.Plane[] = [];
  private gridHelper: THREE.GridHelper | null = null;
  private gridVisible = true;
  private nav: NavigationSettings = structuredClone(DEFAULT_NAV);
  private anchorRequestId = 0;
  private userControlling = false;
  private selectionCenter: THREE.Vector3 | null = null;
  private selectionCenterReq = 0;
  private raycastInFlight = false;
  private pendingRaycast: { ndc: THREE.Vector2; id: number } | null = null;
  public raycastCount = 0;
  public gestureRaycastCount = 0;
  private lastHover: HoverCache | null = null;
  private pivotMesh: THREE.Mesh | null = null;
  private readonly pivotMaterial = new THREE.MeshBasicMaterial({
    color: 0xf08c2e,
    depthTest: false,
    transparent: true,
    opacity: 0.9,
  });
  private pivotFadeRaf: number | null = null;
  private cameraChangeRaf: number | null = null;
  private fpsDeltas: number[] = [];
  private fpsRafId: number | null = null;
  private fpsLastTime = 0;
  private sectionHelper: THREE.Object3D | null = null;
  private sectionGizmo: SectionGizmo | null = null;
  private sectionFrameVisible = true;
  private currentSection: SectionSpec | null = null;
  private pendingFastSpec: SectionSpec | null = null;
  private sectionFastRafId: number | null = null;
  private lastPlaneClickTime = 0;
  private gizmoDrag: {
    handle: HandleId;
    pointerId: number;
    t0: number | null;
    v0: number;
    p0: THREE.Vector3;
    d: THREE.Vector3;
    axisIdx: 0 | 1 | 2;
    side: 'min' | 'max';
    startSpec: SectionSpec;
  } | null = null;
  private clipStyler: OBCF.ClipStyler | null = null;
  private activeClipEdges: any | null = null;
  private lastCachePromise: Promise<void> | null = null;

  async waitForCache(): Promise<void> {
    if (this.lastCachePromise) {
      await this.lastCachePromise;
    }
  }

  async getCacheStats(): Promise<any> {
    return getIfcCacheStats();
  }

  private resetPivotOffset() {
    this.world?.camera.controls.setFocalOffset(0, 0, 0, false);
  }

  private applyMouseMapping(orbiting: boolean) {
    if (!this.world) return;
    const c = this.world.camera.controls;
    const base = baseMapping(this.nav.preset, this.currentProjection === 'orthographic');
    const m = orbiting ? orbitMapping(base) : base;
    c.mouseButtons.left = m.left;
    c.mouseButtons.middle = m.middle;
    c.mouseButtons.right = m.right;
    c.mouseButtons.wheel = m.wheel;
  }

  private configureControls() {
    if (!this.world) return;
    const c = this.world.camera.controls;
    c.azimuthRotateSpeed = this.nav.rotateSpeed;
    c.polarRotateSpeed = this.nav.rotateSpeed;
    c.dollySpeed = this.nav.zoomSpeed;
    c.truckSpeed = 2.0;
    c.smoothTime = 0.2;
    c.draggingSmoothTime = 0.05;
    c.dollyToCursor = true;
    c.infinityDolly = true;
    c.maxDistance = Infinity;
    this.applyMouseMapping(false);
  }

  private onAuxClick = (e: MouseEvent) => {
    if (e.button === 1) e.preventDefault();
  };

  private onNavPointerDown = (ev: PointerEvent) => {
    if (ev.pointerType === 'touch') {
      this.anchorPivotAt(ev.clientX, ev.clientY);
      return;
    }

    // Gizmo handle interaction on section box or plane
    if (this.sectionGizmo?.visible && ev.button === 0 && this.world && this.currentSection) {
      const ndc = this.toNdc(ev.clientX, ev.clientY);
      const handle = this.sectionGizmo.hitTest(ndc, this.world.camera.three);
      if (handle) {
        if (handle === 'plane') {
          const now = performance.now();
          if (now - this.lastPlaneClickTime < 300) {
            this.lastPlaneClickTime = 0;
            if (this.currentSection.kind === 'plane') {
              const flippedSpec: SectionSpec = {
                ...this.currentSection,
                flipped: !this.currentSection.flipped,
              };
              this.setSection(flippedSpec);
              this.events.emit('sectionEdit', { spec: flippedSpec, phase: 'end' });
              ev.stopImmediatePropagation();
              ev.preventDefault();
              return;
            }
          }
          this.lastPlaneClickTime = now;
        }

        ev.stopImmediatePropagation();
        ev.preventDefault();
        try {
          this.boundContainer?.setPointerCapture(ev.pointerId);
        } catch {}
        this.world.camera.controls.enabled = false;
        this.pointerDown = null;
        this.sectionGizmo.setActive(handle);

        const cam = this.world.camera.three;
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(ndc, cam);

        if (this.currentSection.kind === 'box' && handle !== 'plane') {
          const [axisName, sideName] = handle.split('-') as ['x' | 'y' | 'z', 'min' | 'max'];
          const axisIdx = axisName === 'x' ? 0 : axisName === 'y' ? 1 : 2;
          const v0 = this.currentSection[sideName][axisIdx];
          const unitModel: Vec3 = axisName === 'x' ? [1, 0, 0] : axisName === 'y' ? [0, 1, 0] : [0, 0, 1];
          const d = toThree(unitModel).normalize();
          const min = this.currentSection.min;
          const max = this.currentSection.max;
          const midX = (min[0] + max[0]) / 2;
          const midY = (min[1] + max[1]) / 2;
          const midZ = (min[2] + max[2]) / 2;
          const posModel: Vec3 = [
            axisName === 'x' ? this.currentSection[sideName][0] : midX,
            axisName === 'y' ? this.currentSection[sideName][1] : midY,
            axisName === 'z' ? this.currentSection[sideName][2] : midZ,
          ];
          const p0 = toThree(posModel);
          const t0 = axisDragParam(raycaster.ray.origin, raycaster.ray.direction, p0, d);

          this.gizmoDrag = {
            handle,
            pointerId: ev.pointerId,
            t0,
            v0,
            p0,
            d,
            axisIdx,
            side: sideName,
            startSpec: structuredClone(this.currentSection),
          };
        } else if (this.currentSection.kind === 'plane' && handle === 'plane') {
          const axisName = this.currentSection.axis;
          const axisIdx = axisName === 'x' ? 0 : axisName === 'y' ? 1 : 2;
          const v0 = this.currentSection.offset;
          const unitModel: Vec3 = axisName === 'x' ? [1, 0, 0] : axisName === 'y' ? [0, 1, 0] : [0, 0, 1];
          const d = toThree(unitModel).normalize();
          const bounds = this.modelBounds ?? { min: [-25, -25, -10], max: [25, 25, 25] };
          const midX = (bounds.min[0] + bounds.max[0]) / 2;
          const midY = (bounds.min[1] + bounds.max[1]) / 2;
          const midZ = (bounds.min[2] + bounds.max[2]) / 2;
          const posModel: Vec3 =
            axisName === 'x' ? [v0, midY, midZ] : axisName === 'y' ? [midX, v0, midZ] : [midX, midY, v0];
          const p0 = toThree(posModel);
          const t0 = axisDragParam(raycaster.ray.origin, raycaster.ray.direction, p0, d);

          this.gizmoDrag = {
            handle,
            pointerId: ev.pointerId,
            t0,
            v0,
            p0,
            d,
            axisIdx,
            side: 'max',
            startSpec: structuredClone(this.currentSection),
          };
        }
        return;
      }
    }

    // Double-click middle mouse -> Fit All
    if (ev.button === 1) {
      const now = performance.now();
      if (now - this.lastMiddleDown < 300) {
        this.fitToView();
        this.lastMiddleDown = 0;
        ev.preventDefault();
        return;
      }
      this.lastMiddleDown = now;
      ev.preventDefault();
    }

    const intent =
      this.nav.preset === 'classic' && (ev.altKey || ev.ctrlKey) && ev.button === 0
        ? 'none'
        : intentOnDown(this.nav.preset, ev.button, ev.shiftKey);
    this.gesture = {
      intent,
      x: ev.clientX,
      y: ev.clientY,
      currentX: ev.clientX,
      currentY: ev.clientY,
      button: ev.button,
      pointerId: ev.pointerId,
    };
    this.applyMouseMapping(false);
    if (intent === 'orbit-pending') {
      this.anchorPivotAt(ev.clientX, ev.clientY);
    }
  };

  private onNavPointerMove = (ev: PointerEvent) => {
    if (this.gizmoDrag) {
      if (ev.pointerId !== this.gizmoDrag.pointerId) return;
      ev.stopImmediatePropagation();
      ev.preventDefault();

      if (!this.world) return;
      const ndc = this.toNdc(ev.clientX, ev.clientY);
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(ndc, this.world.camera.three);

      const t1 = axisDragParam(raycaster.ray.origin, raycaster.ray.direction, this.gizmoDrag.p0, this.gizmoDrag.d);
      if (t1 === null) return;
      if (this.gizmoDrag.t0 === null) {
        this.gizmoDrag.t0 = t1;
        return;
      }
      const deltaT = t1 - this.gizmoDrag.t0;
      const step = ev.altKey ? 0 : ev.shiftKey ? 0.01 : 0.1;
      const rawVal = this.gizmoDrag.v0 + deltaT;
      const newVal = snapValue(rawVal, step);

        if (this.gizmoDrag.startSpec.kind === 'box') {
          const min = [...this.gizmoDrag.startSpec.min] as Vec3;
          const max = [...this.gizmoDrag.startSpec.max] as Vec3;
          const limits = this.modelBounds ?? {
            min: [-50, -50, -20],
            max: [50, 50, 50],
          };
          const clampedVal = clampBox(
            min,
            max,
            this.gizmoDrag.axisIdx,
            this.gizmoDrag.side,
            newVal,
            limits,
            0.1,
          );
          if (this.gizmoDrag.side === 'min') {
            min[this.gizmoDrag.axisIdx] = clampedVal;
          } else {
            max[this.gizmoDrag.axisIdx] = clampedVal;
          }
          const nextSpec: SectionSpec = {
            kind: 'box',
            min,
            max,
          };
          this.applySectionPlanesFast(nextSpec);
          this.events.emit('sectionEdit', { spec: nextSpec, phase: 'drag', handle: this.gizmoDrag.handle });
        } else if (this.gizmoDrag.startSpec.kind === 'plane') {
          const nextSpec: SectionSpec = {
            ...this.gizmoDrag.startSpec,
            offset: newVal,
          };
          this.applySectionPlanesFast(nextSpec);
          this.events.emit('sectionEdit', { spec: nextSpec, phase: 'drag', handle: this.gizmoDrag.handle });
        }
      return;
    }

    if (this.sectionGizmo?.visible && ev.buttons === 0 && this.world) {
      const ndc = this.toNdc(ev.clientX, ev.clientY);
      const hoverHandle = this.sectionGizmo.hitTest(ndc, this.world.camera.three);
      this.sectionGizmo.setHover(hoverHandle);
      if (this.boundContainer) {
        this.boundContainer.style.cursor = hoverHandle ? 'pointer' : '';
      }
    }

    const g = this.gesture;
    if (!g || ev.pointerId !== g.pointerId) return;
    g.currentX = ev.clientX;
    g.currentY = ev.clientY;
    const moved = Math.hypot(ev.clientX - g.x, ev.clientY - g.y);
    if (g.intent === 'orbit-pending' && moved > DRAG_THRESHOLD_PX) {
      g.intent = 'orbit';
      this.applyMouseMapping(true);
    }
    if (this.currentMeasureTool) return;
    if (g.button === 0 && (g.intent === 'none' || g.intent === 'box-select') && moved > DRAG_THRESHOLD_PX) {
      g.intent = 'box-select';
      const mode = boxSelectMode({ x: g.x, y: g.y }, { x: ev.clientX, y: ev.clientY });
      this.events.emit('boxSelect', {
        phase: 'drag',
        start: { x: g.x, y: g.y },
        current: { x: ev.clientX, y: ev.clientY },
        mode,
      });
    }
  };

  private onNavPointerUp = (ev: PointerEvent) => {
    if (this.gizmoDrag && ev.pointerId === this.gizmoDrag.pointerId) {
      ev.stopImmediatePropagation();
      ev.preventDefault();
      try {
        this.boundContainer?.releasePointerCapture(ev.pointerId);
      } catch {}
      if (this.world) {
        this.world.camera.controls.enabled = true;
      }
      if (this.sectionFastRafId !== null) {
        cancelAnimationFrame(this.sectionFastRafId);
        this.sectionFastRafId = null;
      }
      this.pendingFastSpec = null;
      this.sectionGizmo?.setActive(null);
      const finalSpec = this.currentSection;
      this.gizmoDrag = null;
      if (finalSpec) {
        this.setSection(finalSpec, true);
        this.events.emit('sectionEdit', { spec: finalSpec, phase: 'end' });
      }
      return;
    }

    if (this.gesture?.pointerId !== ev.pointerId) return;
    const g = this.gesture;
    this.gesture = null;
    this.applyMouseMapping(false);

    if (g.intent === 'box-select') {
      const moved = Math.hypot(ev.clientX - g.x, ev.clientY - g.y);
      if (moved > DRAG_THRESHOLD_PX) {
        void this.handleBoxSelect(g.x, g.y, ev.clientX, ev.clientY, ev.ctrlKey || ev.metaKey);
        return;
      }
    }
  };

  private async handleBoxSelect(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    additive: boolean,
  ): Promise<void> {
    const { minX, minY, maxX, maxY, mode } = normalizeRect(
      { x: startX, y: startY },
      { x: endX, y: endY },
    );

    const allSelectedIds: string[] = [];
    if (this.world && this.world.camera && this.world.renderer) {
      const dom = this.world.renderer.three.domElement;
      const camera = this.world.camera.three as any;

      for (const entry of this.modelsMap.values()) {
        if (!entry.model || !entry.model.object.visible) continue;
        if (typeof (entry.model as any).rectangleRaycast === 'function') {
          try {
            const res = await (entry.model as any).rectangleRaycast({
              camera,
              dom,
              topLeft: new THREE.Vector2(minX, minY),
              bottomRight: new THREE.Vector2(maxX, maxY),
              fullyIncluded: mode === 'window',
            });
            if (res && res.localIds && Array.isArray(res.localIds)) {
              for (const localId of res.localIds) {
                const elementId = `${entry.jnnModel.modelId}:${localId}`;
                if (!isVisible(elementId, this.visibility)) continue;

                if (this.currentSection) {
                  const el = entry.jnnModel.elements.find((e) => e.id === elementId);
                  if (el) {
                    const b = boundsOf([el]);
                    if (!isEmpty(b)) {
                      if (this.currentSection.kind === 'box') {
                        const sec = this.currentSection;
                        if (
                          b.max[0] < sec.min[0] || b.min[0] > sec.max[0] ||
                          b.max[1] < sec.min[1] || b.min[1] > sec.max[1] ||
                          b.max[2] < sec.min[2] || b.min[2] > sec.max[2]
                        ) {
                          continue;
                        }
                      } else if (this.currentSection.kind === 'plane') {
                        const sec = this.currentSection;
                        const axisIdx = sec.axis === 'x' ? 0 : sec.axis === 'y' ? 1 : 2;
                        if (sec.flipped) {
                          if (b.min[axisIdx] > sec.offset) continue;
                        } else {
                          if (b.max[axisIdx] < sec.offset) continue;
                        }
                      }
                    }
                  }
                }

                allSelectedIds.push(elementId);
              }
            }
          } catch (err) {
            console.warn('rectangleRaycast failed:', err);
          }
        }
      }
    }

    this.events.emit('boxSelect', {
      phase: 'end',
      ids: allSelectedIds,
      additive,
    });
  }

  private onWindowKeyDown = (ev: KeyboardEvent) => {
    if (this.currentMeasureTool) {
      if (ev.key === 'Escape') {
        const m = this.currentMeasurer;
        if (m) {
          (m as any).cancelCreation?.();
          this.emitMeasureChange();
        }
        return;
      }
      if (ev.key === 'Enter') {
        if (this.currentMeasureTool === 'area') {
          this.areaMeasurer?.endCreation();
          this.emitMeasureChange();
        }
        return;
      }
      if (ev.key === 'Delete') {
        const m = this.currentMeasurer;
        if (m) {
          (m as any).delete?.();
          this.emitMeasureChange();
        }
        return;
      }
    }
    if (ev.key !== 'Shift') return;
    if (!shouldReanchorOnShift(ev.repeat, this.gesture)) return;
    const g = this.gesture!;
    g.intent = 'orbit';
    this.applyMouseMapping(true);
    const targetX = g.currentX ?? g.x;
    const targetY = g.currentY ?? g.y;
    this.anchorPivotAt(targetX, targetY);
  };

  private onWindowKeyUp = (ev: KeyboardEvent) => {
    if (ev.key !== 'Shift') return;
    const g = this.gesture;
    if (!g || (g.button !== 0 && g.button !== 1)) return;
    if (this.nav.preset === 'revit') {
      g.intent = g.button === 1 ? 'pan' : 'none';
      this.applyMouseMapping(false);
    } else if (g.button === 1) {
      g.intent = 'pan';
      this.applyMouseMapping(false);
    }
  };

  private onControlsStart = () => {
    this.userControlling = true;
  };

  private onControlsEnd = () => {
    this.userControlling = false;
  };

  private onControlsUpdate = () => {
    if (!this.userControlling && this.fragments) {
      this.fragments.core.update();
    }
  };

  private onControlsRest = () => {
    if (!this.userControlling && this.fragments) {
      this.fragments.core.update(true);
    }
  };

  private showPivot(point: THREE.Vector3) {
    if (!this.pivotMesh || !this.nav.showPivot) return;
    if (this.pivotFadeRaf) {
      cancelAnimationFrame(this.pivotFadeRaf);
      this.pivotFadeRaf = null;
    }
    this.pivotMesh.position.copy(point);
    this.updatePivotScale();
    this.pivotMaterial.opacity = 0.9;
    this.pivotMesh.visible = true;
  }

  private updatePivotScale() {
    if (!this.pivotMesh || !this.world) return;
    const dom = this.world.renderer?.three?.domElement;
    const h = dom?.clientHeight || window.innerHeight;
    const cam = this.world.camera.three;
    const dist = cam.position.distanceTo(this.pivotMesh.position);
    const wupp = worldUnitsPerPixel(cam, dist, h);
    const s = Math.max(1e-4, wupp * 4); // 8px diameter screen-space
    this.pivotMesh.scale.set(s, s, s);
  }

  private hidePivot() {
    if (this.pivotFadeRaf) {
      cancelAnimationFrame(this.pivotFadeRaf);
      this.pivotFadeRaf = null;
    }
    if (!this.pivotMesh || !this.pivotMesh.visible) return;
    const startTime = performance.now();
    const startOpacity = this.pivotMaterial.opacity;
    const duration = 300;
    const fade = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      this.pivotMaterial.opacity = startOpacity * (1 - progress);
      if (progress < 1) {
        this.pivotFadeRaf = requestAnimationFrame(fade);
      } else {
        if (this.pivotMesh) this.pivotMesh.visible = false;
        this.pivotFadeRaf = null;
      }
    };
    this.pivotFadeRaf = requestAnimationFrame(fade);
  }

  private toNdc(clientX: number, clientY: number): THREE.Vector2 {
    const dom = this.world?.renderer?.three?.domElement;
    if (!dom) return new THREE.Vector2();
    const rect = dom.getBoundingClientRect();
    return new THREE.Vector2(
      ((clientX - rect.left) / (rect.width || 1)) * 2 - 1,
      -((clientY - rect.top) / (rect.height || 1)) * 2 + 1,
    );
  }

  anchorPivotAt(clientX: number, clientY: number) {
    if (!this.world) return;
    const controls = this.world.camera.controls;
    const id = ++this.anchorRequestId;

    // (1) Selection center priority: if selection exists and orbitAroundSelection is enabled
    if (this.nav.orbitAroundSelection && this.selectionCenter) {
      this.pendingRaycast = null;
      OBC.setOrbitPoint(controls, this.selectionCenter);
      this.showPivot(this.selectionCenter);
      return;
    }

    if (!this.nav.orbitAroundCursor) return;

    // (a) Fast path: reuse recent hover if fresh (< 150ms) and close (< 4px)
    const now = performance.now();
    if (shouldUseHoverCache(this.lastHover, clientX, clientY, now)) {
      this.pendingRaycast = null;
      OBC.setOrbitPoint(controls, this.lastHover!.point);
      this.showPivot(this.lastHover!.point);
      return;
    }

    // (b) Plane anchor synchronous fallback
    const ndc = this.toNdc(clientX, clientY);
    const caster = this.components?.get(OBC.Raycasters)?.get(this.world);
    if (caster) {
      caster.three.setFromCamera(ndc, this.world.camera.three);
      const target = controls.getTarget(new THREE.Vector3());
      const normal = this.world.camera.three.getWorldDirection(new THREE.Vector3());
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, target);
      const planePoint = caster.three.ray.intersectPlane(plane, new THREE.Vector3());
      if (planePoint) {
        const bounds = this.getCombinedThreeBounds();
        const pivot = choosePivot(planePoint, bounds);
        OBC.setOrbitPoint(controls, pivot);
        this.showPivot(pivot);
      }

      // (c) Async raycast surface hit (avoid overlapping raycasts)
      if (this.raycastInFlight) {
        this.pendingRaycast = { ndc, id };
      } else {
        this.executeRaycast(ndc, id);
      }
    }
  }

  private executeRaycast(ndc: THREE.Vector2, id: number) {
    if (!this.world || this.disposed) return;
    const caster = this.components?.get(OBC.Raycasters)?.get(this.world);
    if (!caster) return;

    this.raycastInFlight = true;
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1') {
      this.raycastCount++;
      this.gestureRaycastCount++;
      (window as any).__jnn_raycast_count = this.gestureRaycastCount;
    }

    caster
      .castRay({ position: ndc })
      .then((hit: any) => {
        if (id !== this.anchorRequestId || this.disposed || !hit?.point) return;
        if (this.clipPlanes.some((p) => p.distanceToPoint(hit.point) < -1e-6)) return;
        if (this.world?.camera?.controls) {
          OBC.setOrbitPoint(this.world.camera.controls, hit.point);
          this.showPivot(hit.point);
        }
      })
      .catch(() => {})
      .finally(() => {
        this.raycastInFlight = false;
        if (this.pendingRaycast && !this.disposed) {
          const next = this.pendingRaycast;
          this.pendingRaycast = null;
          this.executeRaycast(next.ndc, next.id);
        }
      });
  }

  mount(container: HTMLElement): void {
    patchWebIfcOnce();

    const components = new OBC.Components();
    this.components = components;

    const worlds = components.get(OBC.Worlds);
    const world = worlds.create<
      OBC.SimpleScene,
      OBC.OrthoPerspectiveCamera,
      OBC.SimpleRenderer
    >();
    this.world = world;

    world.scene = new OBC.SimpleScene(components);
    world.renderer = new OBC.SimpleRenderer(components, container);
    world.camera = new OBC.OrthoPerspectiveCamera(components);

    components.init();

    world.scene.setup({
      backgroundColor: new THREE.Color(THEME_COLORS[this.currentTheme]),
    });

    world.camera.controls.setLookAt(15, 15, 15, 0, 0, 0);
    this.configureControls();

    // Subtle ground grid
    const gridHelper = new THREE.GridHelper(50, 50, 0xf97316, 0x2d333b);
    gridHelper.position.y = -0.01;
    gridHelper.visible = this.gridVisible;
    this.gridHelper = gridHelper;
    world.scene.three.add(gridHelper);

    // Pivot dot indicator
    const pivotGeom = new THREE.SphereGeometry(1, 16, 12);
    const pivotMesh = new THREE.Mesh(pivotGeom, this.pivotMaterial);
    pivotMesh.renderOrder = 999;
    pivotMesh.raycast = () => {};
    pivotMesh.visible = false;
    this.pivotMesh = pivotMesh;
    world.scene.three.add(pivotMesh);

    // Section 3D gizmo
    const sectionGizmo = new SectionGizmo();
    this.sectionGizmo = sectionGizmo;
    world.scene.three.add(sectionGizmo.group);

    // Single consolidated per-frame controls listener: pivot, section gizmo, throttled cameraChange
    world.camera.controls.addEventListener('update', () => {
      if (this.disposed) return;
      if (this.pivotMesh?.visible) {
        this.updatePivotScale();
      }
      if (this.sectionGizmo?.visible) {
        this.sectionGizmo.updateScale(world.camera.three, container.clientHeight);
      }
      if (this.cameraChangeRaf === null) {
        this.cameraChangeRaf = requestAnimationFrame(() => {
          this.cameraChangeRaf = null;
          if (this.disposed) return;
          const cam = this.getCamera();
          if (cam.ok) {
            this.events.emit('cameraChange', cam.value);
          }
        });
      }
    });
    world.camera.controls.addEventListener('controlstart', () => {
      const isDebug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';
      if (!isDebug) return;
      this.gestureRaycastCount = 0;
      if (typeof window !== 'undefined') {
        (window as any).__jnn_raycast_count = 0;
      }
      this.fpsDeltas = [];
      this.fpsLastTime = performance.now();
      const onRaf = (now: number) => {
        if (!this.userControlling && this.fpsRafId === null) return;
        const delta = now - this.fpsLastTime;
        this.fpsLastTime = now;
        this.fpsDeltas.push(delta);

        const total = this.fpsDeltas.reduce((a, b) => a + b, 0);
        const avgFps = this.fpsDeltas.length > 0 && total > 0 ? this.fpsDeltas.length / (total / 1000) : 0;
        const maxFrameMs = this.fpsDeltas.length > 0 ? Math.max(...this.fpsDeltas) : 0;
        const over100Count = this.fpsDeltas.filter((d) => d > 100).length;

        this.events.emit('fpsStats', {
          avgFps,
          maxFrameMs,
          over100Count,
          active: true,
          raycastCount: this.gestureRaycastCount,
        });
        this.fpsRafId = requestAnimationFrame(onRaf);
      };
      this.fpsRafId = requestAnimationFrame(onRaf);
    });

    world.camera.controls.addEventListener('controlend', () => {
      this.hidePivot();
      if (this.fpsRafId !== null) {
        cancelAnimationFrame(this.fpsRafId);
        this.fpsRafId = null;
      }
      const isDebug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';
      if (!isDebug) return;
      const total = this.fpsDeltas.reduce((a, b) => a + b, 0);
      const avgFps = this.fpsDeltas.length > 0 && total > 0 ? this.fpsDeltas.length / (total / 1000) : 0;
      const maxFrameMs = this.fpsDeltas.length > 0 ? Math.max(...this.fpsDeltas) : 0;
      const over100Count = this.fpsDeltas.filter((d) => d > 100).length;

      this.events.emit('fpsStats', {
        avgFps,
        maxFrameMs,
        over100Count,
        active: false,
        raycastCount: this.gestureRaycastCount,
      });
    });

    // Setup local worker & wasm
    this.initializedPromise = this.initEngine();

    // Canvas pointer event listeners (≤ 5px drag threshold separation)
    const canvas = world.renderer.three.domElement;
    this.boundCanvas = canvas;
    canvas.setAttribute('data-testid', 'viewer-canvas');
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerleave', this.onPointerLeave);

    this.boundContainer = container;
    container.addEventListener('pointerdown', this.onNavPointerDown, { capture: true });
    container.addEventListener('pointermove', this.onNavPointerMove, { capture: true });
    window.addEventListener('pointerup', this.onNavPointerUp, { capture: true });
    window.addEventListener('keydown', this.onWindowKeyDown);
    window.addEventListener('keyup', this.onWindowKeyUp);
    container.addEventListener('auxclick', this.onAuxClick);
  }

  private async initEngine(): Promise<void> {
    if (!this.components || !this.world) return;
    const fragments = this.components.get(OBC.FragmentsManager);
    this.fragments = fragments;

    const workerUrl = new URL('./thatopen/worker.mjs', window.location.href).href;
    await fragments.init(workerUrl);

    const controls = this.world.camera.controls;
    controls.addEventListener('controlstart', this.onControlsStart);
    controls.addEventListener('controlend', this.onControlsEnd);
    controls.addEventListener('update', this.onControlsUpdate);
    controls.addEventListener('rest', this.onControlsRest);

    fragments.list.onItemSet.add(({ value: model }) => {
      if (this.world) {
        model.useCamera(this.world.camera.three);
        this.world.scene.three.add(model.object);
        fragments.core.update(true);
      }
    });

    const ifcLoader = this.components.get(OBC.IfcLoader);
    this.ifcLoader = ifcLoader;

    const wasmDir = new URL('./thatopen/', window.location.href).href;
    await ifcLoader.setup({
      autoSetWasm: false,
      wasm: {
        path: wasmDir,
        absolute: true,
      },
    });

    // Highlighter setup with accent orange selection and lighter hover
    const highlighter = this.components.get(OBCF.Highlighter);
    this.highlighter = highlighter;
    await highlighter.setup({
      world: this.world,
      selectName: 'select',
      selectMaterialDefinition: {
        color: new THREE.Color(0xf08c2e),
        renderedFaces: 0,
        opacity: 1,
        transparent: false,
      },
    });
    (highlighter as any).setupEvents(false);

    highlighter.styles.set('hover', {
      color: new THREE.Color(0xf59f00),
      renderedFaces: 0,
      opacity: 0.8,
      transparent: true,
    });

    // ClipStyler setup for section edges and filled caps
    try {
      const clipStyler = this.components.get(OBCF.ClipStyler);
      this.clipStyler = clipStyler;
      clipStyler.world = this.world;
      clipStyler.styles.set('default', {
        linesMaterial: new LineMaterial({ color: 0x11161d, linewidth: 2 }),
        fillsMaterial: new THREE.MeshBasicMaterial({
          color: 0x4a5568,
          side: THREE.DoubleSide,
        }),
      });
    } catch (err) {
      console.warn('ClipStyler setup skipped or failed:', err);
    }

    if (this.selection.size > 0) {
      const modelIdMap = this.toModelIdMap([...this.selection]);
      highlighter.highlightByID('select', modelIdMap, true, false).catch(() => {});
    }
    if (this.visibility.hidden.size > 0 || this.visibility.isolated.size > 0) {
      this.applyVisibility();
    }
    if (this.xray) {
      this.applyXray();
    }
  }

  getCombinedThreeBounds(): THREE.Box3 | null {
    if (!this.world) return null;
    const combined = new THREE.Box3();
    for (const entry of this.modelsMap.values()) {
      if (entry.model.object.visible && entry.model.box && !entry.model.box.isEmpty()) {
        entry.model.object.updateMatrixWorld?.(true);
        combined.union(entry.model.box);
      }
    }
    return combined.isEmpty() ? null : combined;
  }

  private updateCombinedBoundsAndFit(fitCamera = false): Bounds | null {
    const combined = this.getCombinedThreeBounds();
    if (combined && !combined.isEmpty()) {
      this.modelBounds = {
        min: [combined.min.x, -combined.max.z, combined.min.y],
        max: [combined.max.x, -combined.min.z, combined.max.y],
      };
      if (fitCamera && this.world) {
        this.resetPivotOffset();
        this.world.camera.controls.fitToBox(combined, true);
      }
      return this.modelBounds;
    }
    return null;
  }

  dispose(): void {
    this.disposed = true;
    this.userControlling = false;
    if (this.cameraChangeRaf !== null) {
      cancelAnimationFrame(this.cameraChangeRaf);
      this.cameraChangeRaf = null;
    }
    if (this.fpsRafId !== null) {
      cancelAnimationFrame(this.fpsRafId);
      this.fpsRafId = null;
    }
    if (this.pivotFadeRaf) {
      cancelAnimationFrame(this.pivotFadeRaf);
      this.pivotFadeRaf = null;
    }
    if (this.pivotMesh) {
      if (this.world?.scene?.three) {
        this.world.scene.three.remove(this.pivotMesh);
      }
      this.pivotMesh.geometry?.dispose();
      this.pivotMaterial.dispose();
      this.pivotMesh = null;
    }
    if (this.gridHelper) {
      if (this.world?.scene?.three) {
        this.world.scene.three.remove(this.gridHelper);
      }
      this.gridHelper.geometry?.dispose();
      (this.gridHelper.material as THREE.Material | undefined)?.dispose?.();
      this.gridHelper = null;
    }
    if (this.sectionGizmo) {
      if (this.world?.scene?.three) {
        this.world.scene.three.remove(this.sectionGizmo.group);
      }
      this.sectionGizmo.dispose();
      this.sectionGizmo = null;
    }
    if (this.sectionHelper) {
      if (this.world?.scene?.three) {
        this.world.scene.three.remove(this.sectionHelper);
      }
      this.sectionHelper.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        (m.material as THREE.Material | undefined)?.dispose?.();
      });
      this.sectionHelper = null;
    }
    if (this.activeClipEdges) {
      try {
        this.activeClipEdges.dispose();
      } catch (err) {
        console.warn('ClipEdges dispose failed:', err);
      }
      this.activeClipEdges = null;
    }
    this.clipPlanes = [];
    if (this.boundCanvas) {
      this.boundCanvas.removeEventListener('pointerdown', this.onPointerDown);
      this.boundCanvas.removeEventListener('pointerup', this.onPointerUp);
      this.boundCanvas.removeEventListener('pointermove', this.onPointerMove);
      this.boundCanvas.removeEventListener('pointerleave', this.onPointerLeave);
      this.boundCanvas = null;
    }
    if (this.boundContainer) {
      this.boundContainer.removeEventListener('pointerdown', this.onNavPointerDown, { capture: true });
      this.boundContainer.removeEventListener('pointermove', this.onNavPointerMove, { capture: true });
      this.boundContainer.removeEventListener('auxclick', this.onAuxClick);
      this.boundContainer = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerup', this.onNavPointerUp, { capture: true });
      window.removeEventListener('keydown', this.onWindowKeyDown);
      window.removeEventListener('keyup', this.onWindowKeyUp);
    }
    if (this.highlighter) {
      this.highlighter.dispose();
      this.highlighter = null;
    }
    if (this.world) {
      if (typeof this.world.camera?.controls?.removeEventListener === 'function') {
        this.world.camera.controls.removeEventListener('controlstart', this.onControlsStart);
        this.world.camera.controls.removeEventListener('controlend', this.onControlsEnd);
        this.world.camera.controls.removeEventListener('update', this.onControlsUpdate);
        this.world.camera.controls.removeEventListener('rest', this.onControlsRest);
      }
      for (const [, entry] of this.modelsMap) {
        if (this.world.scene?.three) {
          this.world.scene.three.remove(entry.model.object);
        }
        entry.model.dispose();
      }
      this.modelsMap.clear();
      this.propertiesCache.clear();
    }
    this.lengthMeasurer?.dispose();
    this.angleMeasurer?.dispose();
    this.areaMeasurer?.dispose();
    this.volumeMeasurer?.dispose();
    this.lengthMeasurer = null;
    this.angleMeasurer = null;
    this.areaMeasurer = null;
    this.volumeMeasurer = null;
    if (this.fragments) {
      this.fragments.core.baseCoordinates = null;
      this.fragments.baseCoordinationModel = '';
      this.fragments.baseCoordinationMatrix = new THREE.Matrix4();
    }
    if (this.components) {
      if (typeof this.components.dispose === 'function') {
        this.components.dispose();
      }
      this.components = null;
    }
    this.world = null;
    this.selectionCenter = null;
    this.raycastInFlight = false;
    this.pendingRaycast = null;
    this.events.clear();
  }

  async loadModel(_model: JnnModel): Promise<AdapterResult<{ elementCount: number; bounds: Bounds }>> {
    if (this.modelBounds) {
      return ok({ elementCount: this.activeModel ? (await this.activeModel.getLocalIds()).length : 0, bounds: this.modelBounds });
    }
    return fail('unsupported', 'ThatOpenViewerAdapter is designed for loading IFC models via loadIfc.');
  }

  async loadIfc(
    file: ArrayBuffer | Uint8Array,
    name: string,
    onProgress?: (percent: number, status?: string) => void,
    options?: { append?: boolean; bypassCache?: boolean },
  ): Promise<AdapterResult<{ elementCount: number; bounds: Bounds; model?: JnnModel; fromCache?: boolean }>> {
    if (this.disposed) return fail('failed', 'Adapter has been disposed.');
    if (this.initializedPromise) {
      await this.initializedPromise;
    }
    if (!this.ifcLoader || !this.fragments || !this.world) {
      return fail('not-loaded', 'Viewer engine is not initialized.');
    }

    try {
      if (typeof performance !== 'undefined' && performance.mark) {
        performance.mark('jnn-load-start');
      }
      const buffer = file instanceof Uint8Array ? file : new Uint8Array(file);
      const sha256 = await computeSha256(buffer).catch(() => '');

      // 1. Check IndexedDB cache if not bypassed
      if (sha256 && !options?.bypassCache) {
        let cached = null;
        try {
          cached = await getCachedIfcModel(sha256);
        } catch (e) {
          console.warn('[ThatOpenViewerAdapter] Error reading cache:', e);
        }

        if (cached && cached.fragBuffer) {
          onProgress?.(25, 'Đang nạp nhanh từ bộ nhớ đệm (IndexedDB)...');
          if (!options?.append) {
            for (const [, entry] of this.modelsMap) {
              this.world.scene.three.remove(entry.model.object);
              entry.model.dispose();
            }
            this.modelsMap.clear();
            this.propertiesCache.clear();
            if (this.fragments) {
              this.fragments.core.baseCoordinates = null;
              this.fragments.baseCoordinationModel = '';
              this.fragments.baseCoordinationMatrix = new THREE.Matrix4();
            }
          }

          if (this.fragments) {
            this.fragments.core.settings.autoCoordinate = true;
          }

          const model = await this.fragments.core.load(new Uint8Array(cached.fragBuffer), {
            modelId: name,
            camera: this.world.camera.three,
          });

          // Model coordination: FragmentsModels with autoCoordinate = true coordinates relative to base model
          const coordMatrix = await model.getCoordinationMatrix().catch(() => new THREE.Matrix4());
          if (this.fragments && !this.fragments.baseCoordinationModel) {
            this.fragments.baseCoordinationModel = name;
            this.fragments.baseCoordinationMatrix = coordMatrix;
          }
          model.object.updateMatrixWorld?.(true);

          this.activeModel = model;
          if (this.clipPlanes.length > 0) {
            model.useClippingPlanes(this.clipPlanes);
          }
          this.world.scene.three.add(model.object);
          this.fragments.core.update(true);

          const jnnModel = cached.jnnModel;
          this.modelsMap.set(name, { model, jnnModel });
          this.parsedModel = jnnModel;
          this.updateCombinedBoundsAndFit(true);

          if (this.selection.size > 0) {
            this.select([...this.selection]);
          }
          if (this.visibility.hidden.size > 0 || this.visibility.isolated.size > 0) {
            this.applyVisibility();
          }
          if (this.xray) {
            this.applyXray();
          }
          onProgress?.(100, 'Đã mở mô hình từ cache.');

          if (typeof performance !== 'undefined' && performance.mark) {
            performance.mark('jnn-load-end');
            try {
              performance.measure('jnn-load-duration', 'jnn-load-start', 'jnn-load-end');
            } catch {
              // ignore
            }
          }

          return ok({
            elementCount: jnnModel.elements.length,
            bounds: this.modelBounds ?? { min: [-10, -10, 0], max: [10, 10, 10] },
            model: jnnModel,
            fromCache: true,
          });
        }
      }

      // 2. Cache miss or bypassed: full parse via That Open IFC loader
      if (!options?.append) {
        // Clear old models if not in append mode
        for (const [, entry] of this.modelsMap) {
          this.world.scene.three.remove(entry.model.object);
          entry.model.dispose();
        }
        this.modelsMap.clear();
        this.propertiesCache.clear();
        if (this.fragments) {
          this.fragments.core.baseCoordinates = null;
          this.fragments.baseCoordinationModel = '';
          this.fragments.baseCoordinationMatrix = new THREE.Matrix4();
        }
      }

      // Yield to event loop before the heavy WASM parse (see docs/DUNG_SOM_B2.md)
      await new Promise((r) => setTimeout(r, 0));

      const model = await this.ifcLoader.load(buffer, true, name, {
        processData: {
          progressCallback: (p: any) => {
            if (onProgress && p?.progress !== undefined) {
              onProgress(p.progress * 80, p.currentProcess);
            }
          },
        },
      });

      // Yield after WASM parse completes to let pending rAF / microtasks run
      await new Promise((r) => setTimeout(r, 0));

      // Model coordination: FragmentsModels with autoCoordinate = true coordinates relative to base model
      const coordMatrix = await model.getCoordinationMatrix().catch(() => new THREE.Matrix4());
      if (this.fragments && !this.fragments.baseCoordinationModel) {
        this.fragments.baseCoordinationModel = name;
        this.fragments.baseCoordinationMatrix = coordMatrix;
      }
      model.object.updateMatrixWorld?.(true);

      this.activeModel = model;
      if (this.clipPlanes.length > 0) {
        model.useClippingPlanes(this.clipPlanes);
      }
      this.world.scene.three.add(model.object);
      this.fragments.core.update(true);

      onProgress?.(85, 'Đang phân tích cây không gian...');
      const metadata = await model.getMetadata().catch(() => ({}));
      const spatial = (await model.getSpatialStructure().catch(() => null)) as SpatialNode | null;
      const geomIds = new Set(await model.getItemsIdsWithGeometry().catch(() => []));

      let headerData: any[] = [];
      let elementLocalIds: number[] = [];

      if (spatial) {
        const parsed = parseSpatialStructure(spatial);
        const headerIds = [
          ...(parsed.projectLocalId ? [parsed.projectLocalId] : []),
          ...(parsed.siteLocalId ? [parsed.siteLocalId] : []),
          ...(parsed.buildingLocalId ? [parsed.buildingLocalId] : []),
          ...parsed.storeyLocalIds,
        ];
        if (headerIds.length > 0) {
          headerData = await model.getItemsData(headerIds, { attributesDefault: true }).catch(() => []);
        }
        elementLocalIds = parsed.allElementLocalIds;
      }

      if (elementLocalIds.length === 0) {
        elementLocalIds = await model.getLocalIds();
      }

      onProgress?.(92, 'Đang đọc thuộc tính các cấu kiện...');
      // Chunk getItemsData in batches of 200 with yielding to prevent blocking the main thread (B2)
      const itemsBasicData: any[] = [];
      const CHUNK_SIZE = 200;
      for (let i = 0; i < elementLocalIds.length; i += CHUNK_SIZE) {
        const chunk = elementLocalIds.slice(i, i + CHUNK_SIZE);
        const chunkData = await model.getItemsData(chunk, { attributesDefault: true }).catch(() => []);
        itemsBasicData.push(...chunkData);
        if (i + CHUNK_SIZE < elementLocalIds.length) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      // Yield before domain mapping
      await new Promise((r) => setTimeout(r, 0));

      const jnnModel = mapIfcToJnnModel({
        modelId: name,
        filename: name,
        metadata,
        spatialRoot: spatial ?? undefined,
        spatialHeadersData: headerData,
        itemsBasicData,
        geometryLocalIds: geomIds,
        fileSize: buffer.byteLength,
      });

      // Yield after domain mapping
      await new Promise((r) => setTimeout(r, 0));

      this.modelsMap.set(name, { model, jnnModel });
      this.parsedModel = jnnModel;
      this.updateCombinedBoundsAndFit(true);
      this.configureControls();
      if (this.modelBounds && this.world) {
        const sizeX = this.modelBounds.max[0] - this.modelBounds.min[0];
        const sizeY = this.modelBounds.max[1] - this.modelBounds.min[1];
        const sizeZ = this.modelBounds.max[2] - this.modelBounds.min[2];
        const diagonal = Math.hypot(sizeX, sizeY, sizeZ);
        this.world.camera.controls.minDistance = Math.max(0.3, diagonal * 0.001);
      }
      if (this.selection.size > 0) {
        this.select([...this.selection]);
      }
      if (this.visibility.hidden.size > 0 || this.visibility.isolated.size > 0) {
        this.applyVisibility();
      }
      if (this.xray) {
        this.applyXray();
      }

      // 3. Save converted .frag binary & jnnModel into IndexedDB cache asynchronously
      if (sha256) {
        this.lastCachePromise = (async () => {
          try {
            const fragBuffer = await model.getBuffer();
            if (fragBuffer && fragBuffer.byteLength > 0) {
              await saveCachedIfcModel({
                sha256,
                filename: name,
                fileSize: buffer.byteLength,
                fragBuffer,
                jnnModel,
                createdAt: Date.now(),
                lastAccessedAt: Date.now(),
              });
            }
          } catch (err) {
            console.warn('[ThatOpenViewerAdapter] Export/save frag buffer error:', err);
          }
        })();
      }

      onProgress?.(100, 'Hoàn tất nạp mô hình IFC.');

      if (typeof performance !== 'undefined' && performance.mark) {
        performance.mark('jnn-load-end');
        try {
          performance.measure('jnn-load-duration', 'jnn-load-start', 'jnn-load-end');
        } catch {
          // ignore
        }
      }

      return ok({
        elementCount: jnnModel.elements.length,
        bounds: this.modelBounds ?? { min: [-10, -10, 0], max: [10, 10, 10] },
        model: jnnModel,
        fromCache: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return fail('failed', `Failed to load IFC file "${name}": ${message}`);
    }
  }

  removeModel(modelId: string): AdapterResult {
    const entry = this.modelsMap.get(modelId);
    if (!entry) {
      return fail('not-found', `Model with ID "${modelId}" not found.`);
    }
    if (this.world) {
      this.world.scene.three.remove(entry.model.object);
    }
    entry.model.dispose();
    this.modelsMap.delete(modelId);
    if (this.fragments) {
      this.fragments.core.update(true);
    }
    for (const key of [...this.propertiesCache.keys()]) {
      if (key.startsWith(`${modelId}:`)) {
        this.propertiesCache.delete(key);
      }
    }
    if (this.activeModel === entry.model) {
      this.activeModel = this.modelsMap.values().next().value?.model ?? null;
    }
    if (this.modelsMap.size === 0 && this.fragments) {
      this.fragments.baseCoordinationModel = '';
      this.fragments.baseCoordinationMatrix = new THREE.Matrix4();
    }
    this.updateCombinedBoundsAndFit(false);
    this.refreshSelectionCenter();
    return okVoid;
  }

  setModelVisibility(modelId: string, visible: boolean): AdapterResult {
    const entry = this.modelsMap.get(modelId);
    if (!entry) {
      return fail('not-found', `Model with ID "${modelId}" not found.`);
    }
    entry.model.object.visible = visible;
    if (this.fragments) {
      this.fragments.core.update(true);
    }
    this.refreshSelectionCenter();
    return okVoid;
  }

  fitToModel(modelId: string): AdapterResult {
    const entry = this.modelsMap.get(modelId);
    if (!entry || !this.world) {
      return fail('not-found', `Model with ID "${modelId}" not found.`);
    }
    const box = entry.model.box;
    if (box && !box.isEmpty()) {
      this.resetPivotOffset();
      this.world.camera.controls.fitToBox(box, true);
      return okVoid;
    }
    return fail('failed', 'Model has empty bounding box.');
  }

  getModelBounds(modelId?: string): AdapterResult<Bounds> {
    if (modelId) {
      const entry = this.modelsMap.get(modelId);
      if (!entry || !entry.model.box || entry.model.box.isEmpty()) {
        return fail('not-found', `Model "${modelId}" bounds not found.`);
      }
      entry.model.object.updateMatrixWorld?.(true);
      const worldBox = entry.model.box;
      return ok({
        min: [worldBox.min.x, -worldBox.max.z, worldBox.min.y],
        max: [worldBox.max.x, -worldBox.min.z, worldBox.max.y],
      });
    }
    if (this.modelBounds) return ok(this.modelBounds);
    const updated = this.updateCombinedBoundsAndFit(false);
    if (updated) return ok(updated);
    return fail('not-loaded', 'No IFC model loaded.');
  }

  renderNow(): void {
    if (this.world?.renderer && this.world?.scene && this.world?.camera) {
      this.world.renderer.three.render(this.world.scene.three, this.world.camera.three);
    }
  }

  fitToView(ids?: readonly string[]): AdapterResult {
    if (!this.world || this.modelsMap.size === 0) return fail('not-loaded', 'No active model to fit.');

    if (ids && ids.length > 0) {
      const modelIdMap = this.toModelIdMap(ids);
      let hasItems = false;
      for (const set of Object.values(modelIdMap)) {
        if (set.size > 0) {
          hasItems = true;
          break;
        }
      }
      if (hasItems && this.highlighter) {
        this.resetPivotOffset();
        (this.highlighter as any).zoomSelection(modelIdMap).catch(console.error);
        return okVoid;
      }
    }

    const combined = new THREE.Box3();
    for (const entry of this.modelsMap.values()) {
      if (entry.model.object.visible && entry.model.box && !entry.model.box.isEmpty()) {
        combined.union(entry.model.box);
      }
    }
    if (!combined.isEmpty()) {
      this.resetPivotOffset();
      this.world.camera.controls.fitToBox(combined, true);
      return okVoid;
    }
    return fail('failed', 'Models have empty bounding box.');
  }

  setViewPreset(preset: ViewPreset): AdapterResult {
    if (!this.world) return fail('not-loaded', 'Viewer is not mounted.');
    const dirModel = PRESET_DIRS[preset];
    if (!dirModel) return fail('invalid-argument', `Unknown preset: ${preset}`);

    this.resetPivotOffset();

    const combined = new THREE.Box3();
    for (const entry of this.modelsMap.values()) {
      if (entry.model.object.visible && entry.model.box && !entry.model.box.isEmpty()) {
        combined.union(entry.model.box);
      }
    }

    const targetThree = new THREE.Vector3();
    let distance = 25;
    if (!combined.isEmpty()) {
      combined.getCenter(targetThree);
      const size = new THREE.Vector3();
      combined.getSize(size);
      distance = Math.max(size.x, size.y, size.z) * 1.8;
    } else if (this.activeModel?.box && !this.activeModel.box.isEmpty()) {
      this.activeModel.box.getCenter(targetThree);
      const size = new THREE.Vector3();
      this.activeModel.box.getSize(size);
      distance = Math.max(size.x, size.y, size.z) * 1.8;
    } else {
      targetThree.set(0, 0, 0);
    }

    const dirThree = toThree(dirModel).normalize();
    const posThree = targetThree.clone().addScaledVector(dirThree, distance);
    this.world.camera.controls.setLookAt(
      posThree.x,
      posThree.y,
      posThree.z,
      targetThree.x,
      targetThree.y,
      targetThree.z,
      true,
    );
    return okVoid;
  }

  setCamera(state: CameraState, animate = false): AdapterResult {
    if (!this.world) return fail('not-loaded', 'Viewer is not mounted.');
    this.resetPivotOffset();
    const pos = toThree(state.position);
    const target = toThree(state.target);
    this.world.camera.controls.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, animate);
    if (state.projection !== this.currentProjection) {
      this.setProjection(state.projection);
    }
    return okVoid;
  }

  setNavigationSettings(s: NavigationSettings): AdapterResult {
    this.nav = { ...s };
    this.configureControls();
    return okVoid;
  }

  beginOrbit(): AdapterResult {
    if (!this.world) return fail('not-loaded', 'Viewer is not mounted.');
    const controls = this.world.camera.controls;
    if (this.nav.orbitAroundSelection && this.selectionCenter) {
      ++this.anchorRequestId;
      this.pendingRaycast = null;
      OBC.setOrbitPoint(controls, this.selectionCenter);
      this.showPivot(this.selectionCenter);
    }
    return okVoid;
  }

  orbitBy(deltaAzimuth: number, deltaPolar: number, animate = false): AdapterResult {
    if (!this.world) return fail('not-loaded', 'Viewer is not mounted.');
    this.world.camera.controls.rotate(deltaAzimuth, deltaPolar, animate);
    return okVoid;
  }

  getCamera(): AdapterResult<CameraState> {
    if (!this.world) return fail('not-loaded', 'Viewer is not mounted.');
    const posThree = this.world.camera.three.position.clone();
    const targetThree = new THREE.Vector3();
    this.world.camera.controls.getTarget(targetThree);

    return ok({
      position: toModel(posThree),
      target: toModel(targetThree),
      projection: this.currentProjection,
    });
  }

  setProjection(projection: CameraState['projection']): AdapterResult {
    if (!this.world) return fail('not-loaded', 'Viewer is not mounted.');
    this.currentProjection = projection;
    const target = projection === 'orthographic' ? 'Orthographic' : 'Perspective';
    if (this.world.camera.projection.current !== target) {
      this.world.camera.projection
        .set(target)
        .then(() => this.applyMouseMapping(false))
        .catch((err) => {
          console.warn('Failed to set projection:', err);
        });
    }
    return okVoid;
  }

  setTheme(theme: 'light' | 'dark'): void {
    this.currentTheme = theme;
    if (this.world?.scene?.three) {
      this.world.scene.three.background = new THREE.Color(THEME_COLORS[theme]);
    }
  }

  projectToScreen(id: string): AdapterResult<{ x: number; y: number; onScreen: boolean }> {
    if (!this.world || !this.world.renderer) return fail('not-loaded', 'Viewer is not mounted.');
    const { targetModelId } = this.parseElementId(id);
    const entry = this.modelsMap.get(targetModelId) ?? this.modelsMap.values().next().value;
    const box = entry?.model.box;
    if (!box || box.isEmpty()) return fail('not-found', `Element not found: ${id}`);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const v = center.clone().project(this.world.camera.three);
    const dom = this.world.renderer.three.domElement;
    const w = dom.clientWidth;
    const h = dom.clientHeight;
    return ok({
      x: ((v.x + 1) / 2) * w,
      y: ((1 - v.y) / 2) * h,
      onScreen: v.z > -1 && v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1,
    });
  }

  select(ids: readonly string[]): AdapterResult {
    if (ids.length > 0) {
      let anyFound = false;
      for (const id of ids) {
        const { targetModelId, localId } = this.parseElementId(id);
        const entry = this.modelsMap.get(targetModelId);
        if (entry && (entry.jnnModel.elements.some((e) => e.id === id) || localId !== -1)) {
          anyFound = true;
          break;
        }
      }
      if (!anyFound) {
        return fail('not-found', 'None of the requested elements exist in loaded models.');
      }
    }

    this.selection = new Set(ids);
    if (this.highlighter) {
      if (ids.length === 0) {
        this.highlighter.clear('select').catch((err) => console.warn('highlighter.clear failed:', err));
      } else {
        const modelIdMap = this.toModelIdMap(ids);
        this.highlighter.highlightByID('select', modelIdMap, true, false).catch((err) => console.warn('highlightByID failed:', err));
      }
    }
    if (this.xray) {
      this.applyXray();
    }
    this.refreshSelectionCenter();
    return okVoid;
  }

  async getProperties(id: string): Promise<AdapterResult<{ element: JnnElement; propertySets: PropertySet[] }>> {
    if (this.propertiesCache.has(id)) {
      return ok(this.propertiesCache.get(id)!);
    }
    const { targetModelId, localId } = this.parseElementId(id);
    if (localId === -1) {
      return fail('invalid-argument', `Invalid element ID format: ${id}`);
    }

    const entry = this.modelsMap.get(targetModelId) ?? this.modelsMap.values().next().value;
    const targetModel = entry?.model ?? this.activeModel;
    if (!targetModel) return fail('not-loaded', 'No active IFC model.');

    try {
      const items = await (targetModel as any).getItemsData([localId], {
        attributesDefault: true,
        relations: {
          IsDefinedBy: {
            attributes: true,
            relations: {
              HasProperties: { attributes: true, relations: false },
              Quantities: { attributes: true, relations: false },
            },
          },
        },
      });

      const rawItem = items?.[0] as any;
      const parsed = parseItemPropertiesAndQuantities(rawItem);
      const baseEl: JnnElement | undefined = entry?.jnnModel.elements.find((e) => e.id === id) ?? this.parsedModel?.elements.find((e) => e.id === id);

      const element: JnnElement = baseEl
        ? {
            ...baseEl,
            type: parsed.type || baseEl.type,
            material: parsed.material ?? baseEl.material,
            properties: parsed.properties,
            quantities: parsed.quantities,
          }
        : {
            modelId: this.parsedModel?.modelId || '',
            modelRevisionId: 'rev-001',
            sourceFormat: 'IFC',
            sourceElementId: String(localId),
            globalId: rawItem?._guid?.value ?? null,
            id,
            name: rawItem?.Name?.value || `Element #${localId}`,
            category: baseEl ? (baseEl as JnnElement).category : 'IfcElement',
            type: parsed.type || 'IfcElement',
            material: parsed.material ?? null,
            storey: baseEl ? (baseEl as JnnElement).storey : null,
            transform: IDENTITY_TRANSFORM,
            properties: parsed.properties,
            quantities: parsed.quantities,
            meshRefs: [],
            geometryStatus: 'ok',
            importWarnings: [],
          };

      const result = { element, propertySets: parsed.properties };
      this.propertiesCache.set(id, result);
      return ok(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return fail('failed', `Failed to load properties for "${id}": ${message}`);
    }
  }

  setHidden(ids: readonly string[]): AdapterResult {
    this.visibility = { hidden: new Set(ids), isolated: this.visibility.isolated };
    this.applyVisibility();
    this.refreshSelectionCenter();
    return okVoid;
  }

  isolate(ids: readonly string[]): AdapterResult {
    this.visibility = { hidden: this.visibility.hidden, isolated: new Set(ids) };
    this.applyVisibility();
    this.refreshSelectionCenter();
    return okVoid;
  }

  setSection(spec: SectionSpec | null, force = false): AdapterResult {
    if (!force && this.currentSection === spec) return okVoid;
    if (!force && this.currentSection && spec && this.currentSection.kind === spec.kind) {
      if (spec.kind === 'plane' && this.currentSection.kind === 'plane') {
        if (
          spec.axis === this.currentSection.axis &&
          spec.flipped === this.currentSection.flipped &&
          Math.abs(spec.offset - this.currentSection.offset) < 1e-6
        ) {
          return okVoid;
        }
      } else if (spec.kind === 'box' && this.currentSection.kind === 'box') {
        const cur = this.currentSection;
        if (
          Math.abs(spec.min[0] - cur.min[0]) < 1e-6 &&
          Math.abs(spec.min[1] - cur.min[1]) < 1e-6 &&
          Math.abs(spec.min[2] - cur.min[2]) < 1e-6 &&
          Math.abs(spec.max[0] - cur.max[0]) < 1e-6 &&
          Math.abs(spec.max[1] - cur.max[1]) < 1e-6 &&
          Math.abs(spec.max[2] - cur.max[2]) < 1e-6
        ) {
          return okVoid;
        }
      }
    }
    this.currentSection = spec;
    if (this.sectionHelper) {
      if (this.world?.scene?.three) {
        this.world.scene.three.remove(this.sectionHelper);
      }
      this.sectionHelper.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        (m.material as THREE.Material | undefined)?.dispose?.();
      });
      this.sectionHelper = null;
    }

    if (this.activeClipEdges) {
      try {
        this.activeClipEdges.dispose();
      } catch (err) {
        console.warn('ClipEdges dispose failed:', err);
      }
      this.activeClipEdges = null;
    }

    if (!spec) {
      this.clipPlanes = [];
      this.lengthMeasurer?.applyPlanesVisibility([]);
      this.angleMeasurer?.applyPlanesVisibility([]);
      this.areaMeasurer?.applyPlanesVisibility([]);
      this.volumeMeasurer?.applyPlanesVisibility([]);
      if (this.world?.renderer?.three) {
        this.world.renderer.three.clippingPlanes = [];
      }
      for (const entry of this.modelsMap.values()) {
        entry.model.useClippingPlanes([]);
      }
      if (this.fragments) {
        this.fragments.core.update(true);
      }
      if (this.sectionGizmo) {
        this.sectionGizmo.visible = false;
      }
      return okVoid;
    }

    if (!this.modelBounds) return fail('not-loaded', 'No model loaded.');

    let threePlanes: THREE.Plane[] = [];
    if (spec.kind === 'plane') {
      const modelNormal = spec.axis === 'x'
        ? (spec.flipped ? [1, 0, 0] : [-1, 0, 0])
        : spec.axis === 'y'
          ? (spec.flipped ? [0, 1, 0] : [0, -1, 0])
          : (spec.flipped ? [0, 0, 1] : [0, 0, -1]);
      const modelOffset = spec.flipped ? -spec.offset : spec.offset;
      const normalThree = toThree(modelNormal as Vec3);
      threePlanes = [new THREE.Plane(normalThree, modelOffset)];
    } else {
      for (let i = 0; i < 3; i++) {
        if (spec.min[i]! >= spec.max[i]!) return fail('invalid-argument', 'Section box min must be < max.');
      }
      // X axis
      threePlanes.push(
        new THREE.Plane(toThree([1, 0, 0]), -spec.min[0]!),
        new THREE.Plane(toThree([-1, 0, 0]), spec.max[0]!),
      );
      // Y axis
      threePlanes.push(
        new THREE.Plane(toThree([0, 1, 0]), -spec.min[1]!),
        new THREE.Plane(toThree([0, -1, 0]), spec.max[1]!),
      );
      // Z axis
      threePlanes.push(
        new THREE.Plane(toThree([0, 0, 1]), -spec.min[2]!),
        new THREE.Plane(toThree([0, 0, -1]), spec.max[2]!),
      );
    }

    this.clipPlanes = threePlanes;
    this.lengthMeasurer?.applyPlanesVisibility(this.clipPlanes);
    this.angleMeasurer?.applyPlanesVisibility(this.clipPlanes);
    this.areaMeasurer?.applyPlanesVisibility(this.clipPlanes);
    this.volumeMeasurer?.applyPlanesVisibility(this.clipPlanes);

    if (this.world?.renderer?.three) {
      this.world.renderer.three.clippingPlanes = this.clipPlanes;
    }
    for (const entry of this.modelsMap.values()) {
      entry.model.useClippingPlanes(this.clipPlanes);
    }
    if (this.fragments) {
      this.fragments.core.update(true);
    }

    this.sectionHelper = this.buildSectionHelper(spec, this.modelBounds);
    this.sectionHelper.visible = this.sectionFrameVisible;
    if (this.world?.scene?.three) {
      this.world.scene.three.add(this.sectionHelper);
    }

    if (this.sectionGizmo) {
      if (spec.kind === 'box') {
        this.sectionGizmo.setBox(spec.min, spec.max);
      } else {
        const bounds = this.modelBounds ?? { min: [-25, -25, -10], max: [25, 25, 25] };
        this.sectionGizmo.setPlane(spec.axis, spec.offset, spec.flipped, bounds);
      }
      this.sectionGizmo.visible = this.sectionFrameVisible;
      if (this.world) {
        const h = this.world.renderer?.three?.domElement?.clientHeight || 600;
        this.sectionGizmo.updateScale(this.world.camera.three, h);
      }
    }

    // Generate section caps and edges for plane cuts
    if (spec.kind === 'plane' && this.clipStyler && this.world && threePlanes[0]) {
      try {
        const clipEdges = this.clipStyler.create(threePlanes[0], {
          world: this.world,
          link: false,
        });
        clipEdges.items.set('default', { style: 'default' });
        clipEdges.visible = true;
        clipEdges.update().catch((err) => console.warn('ClipEdges update failed:', err));
        this.activeClipEdges = clipEdges;
      } catch (err) {
        console.warn('ClipStyler create failed:', err);
      }
    }

    return okVoid;
  }

  setSectionFrameVisible(visible: boolean): AdapterResult {
    this.sectionFrameVisible = visible;
    if (this.sectionHelper) {
      this.sectionHelper.visible = visible;
    }
    if (this.sectionGizmo) {
      this.sectionGizmo.visible = visible && !!this.currentSection;
    }
    return okVoid;
  }

  isPointClipped(p: Vec3): boolean {
    const v = toThree(p);
    return this.clipPlanes.some((pl) => pl.distanceToPoint(v) < -1e-6);
  }

  private buildSectionHelper(spec: SectionSpec, b: Bounds): THREE.Object3D {
    const color = 0xf08c2e;
    const group = new THREE.Group();
    if (spec.kind === 'box') {
      const sizeX = spec.max[0] - spec.min[0];
      const sizeY = spec.max[1] - spec.min[1];
      const sizeZ = spec.max[2] - spec.min[2];
      const box = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
        new THREE.LineBasicMaterial({ color }),
      );
      box.scale.set(sizeX, sizeZ, sizeY);
      box.raycast = () => {};
      const centerModel: Vec3 = [
        (spec.min[0] + spec.max[0]) / 2,
        (spec.min[1] + spec.max[1]) / 2,
        (spec.min[2] + spec.max[2]) / 2,
      ];
      box.position.copy(toThree(centerModel));
      group.add(box);
      return group;
    }

    const s = boundsSize(b);
    const c = boundsCenter(b);
    const m = 1.5;
    let w: number, h: number;
    const obj = new THREE.Group();
    if (spec.axis === 'x') {
      [w, h] = [s[1] + m * 2, s[2] + m * 2];
      obj.position.set(spec.offset, c[2], -c[1]);
      obj.rotation.set(0, Math.PI / 2, 0);
    } else if (spec.axis === 'y') {
      [w, h] = [s[0] + m * 2, s[2] + m * 2];
      obj.position.set(c[0], c[2], -spec.offset);
      obj.rotation.set(0, 0, 0);
    } else {
      [w, h] = [s[0] + m * 2, s[1] + m * 2];
      obj.position.set(c[0], spec.offset, -c[1]);
      obj.rotation.set(Math.PI / 2, 0, 0);
    }
    const geom = new THREE.PlaneGeometry(w, h);
    const fill = new THREE.Mesh(
      geom,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }),
    );
    fill.raycast = () => {};
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(geom),
      new THREE.LineBasicMaterial({ color }),
    );
    outline.raycast = () => {};
    obj.add(fill, outline);
    group.add(obj);
    return group;
  }

  private applySectionPlanesFast(spec: SectionSpec): void {
    this.pendingFastSpec = spec;
    this.currentSection = spec;
    if (this.sectionFastRafId !== null) return;

    this.sectionFastRafId = requestAnimationFrame(() => {
      this.sectionFastRafId = null;
      const targetSpec = this.pendingFastSpec;
      if (!targetSpec) return;

      if (targetSpec.kind === 'box' && this.clipPlanes.length === 6) {
        this.clipPlanes[0]!.constant = -targetSpec.min[0];
        this.clipPlanes[1]!.constant = targetSpec.max[0];
        this.clipPlanes[2]!.constant = -targetSpec.min[1];
        this.clipPlanes[3]!.constant = targetSpec.max[1];
        this.clipPlanes[4]!.constant = -targetSpec.min[2];
        this.clipPlanes[5]!.constant = targetSpec.max[2];

        if (this.sectionHelper && this.sectionHelper.children[0]) {
          const sizeX = targetSpec.max[0] - targetSpec.min[0];
          const sizeY = targetSpec.max[1] - targetSpec.min[1];
          const sizeZ = targetSpec.max[2] - targetSpec.min[2];
          const centerModel: Vec3 = [
            (targetSpec.min[0] + targetSpec.max[0]) / 2,
            (targetSpec.min[1] + targetSpec.max[1]) / 2,
            (targetSpec.min[2] + targetSpec.max[2]) / 2,
          ];
          const box = this.sectionHelper.children[0];
          box.scale.set(sizeX, sizeZ, sizeY);
          box.position.copy(toThree(centerModel));
        }

        if (this.sectionGizmo) {
          this.sectionGizmo.setBox(targetSpec.min, targetSpec.max);
          if (this.world) {
            const h = this.world.renderer?.three?.domElement?.clientHeight || 600;
            this.sectionGizmo.updateScale(this.world.camera.three, h);
          }
        }
      } else if (targetSpec.kind === 'plane' && this.clipPlanes.length === 1) {
        this.clipPlanes[0]!.constant = targetSpec.flipped ? -targetSpec.offset : targetSpec.offset;
        if (this.sectionHelper && this.sectionHelper.children[0] && this.modelBounds) {
          const c = boundsCenter(this.modelBounds);
          if (targetSpec.axis === 'x') {
            this.sectionHelper.children[0]!.position.set(targetSpec.offset, c[2], -c[1]);
          } else if (targetSpec.axis === 'y') {
            this.sectionHelper.children[0]!.position.set(c[0], c[2], -targetSpec.offset);
          } else {
            this.sectionHelper.children[0]!.position.set(c[0], targetSpec.offset, -c[1]);
          }
        }
        if (this.sectionGizmo) {
          const bounds = this.modelBounds ?? { min: [-25, -25, -10], max: [25, 25, 25] };
          this.sectionGizmo.setPlane(targetSpec.axis, targetSpec.offset, targetSpec.flipped, bounds);
          if (this.world) {
            const h = this.world.renderer?.three?.domElement?.clientHeight || 600;
            this.sectionGizmo.updateScale(this.world.camera.three, h);
          }
        }
      }

      if (this.fragments) {
        this.fragments.core.update();
      }
    });
  }

  highlight(ids: readonly string[] | Map<string, string> | null, color = '#2f9e44'): AdapterResult {
    if (!ids) {
      if (this.highlighter) {
        for (const styleName of this.activeHighlightStyles) {
          this.highlighter.clear(styleName).catch(console.error);
        }
      }
      this.activeHighlightStyles.clear();
      return okVoid;
    }

    if (ids instanceof Map) {
      if (this.highlighter) {
        for (const styleName of this.activeHighlightStyles) {
          this.highlighter.clear(styleName).catch(console.error);
        }
      }
      this.activeHighlightStyles.clear();

      const byColor = new Map<string, string[]>();
      for (const [id, col] of ids) {
        const arr = byColor.get(col) ?? [];
        arr.push(id);
        byColor.set(col, arr);
      }

      for (const [col, groupIds] of byColor) {
        const cleanColor = col.replace('#', '');
        const styleName = `hl_${cleanColor}`;
        if (this.highlighter) {
          if (!this.highlighter.styles.has(styleName)) {
            this.highlighter.styles.set(styleName, {
              color: new THREE.Color(col),
              renderedFaces: 0,
              opacity: 1,
              transparent: false,
            });
          }
          const modelIdMap = this.toModelIdMap(groupIds);
          this.highlighter.highlightByID(styleName, modelIdMap, false, false).catch(console.error);
        }
        this.activeHighlightStyles.add(styleName);
      }
      return okVoid;
    }

    const cleanColor = color.replace('#', '');
    const styleName = `hl_${cleanColor}`;
    if (this.highlighter) {
      if (!this.highlighter.styles.has(styleName)) {
        this.highlighter.styles.set(styleName, {
          color: new THREE.Color(color),
          renderedFaces: 0,
          opacity: 1,
          transparent: false,
        });
      }
      const modelIdMap = this.toModelIdMap(ids);
      this.highlighter.highlightByID(styleName, modelIdMap, true, false).catch(console.error);
    }
    this.activeHighlightStyles.add(styleName);
    return okVoid;
  }

  setXray(enabled: boolean): AdapterResult {
    this.xray = enabled;
    this.applyXray();
    return okVoid;
  }

  setGridVisible(visible: boolean): AdapterResult {
    this.gridVisible = visible;
    if (this.gridHelper) {
      this.gridHelper.visible = visible;
    }
    return okVoid;
  }

  private getOrCreateLengthMeasurer(): OBCF.LengthMeasurement | null {
    if (!this.components || !this.world) return null;
    if (!this.lengthMeasurer) {
      this.lengthMeasurer = this.components.get(OBCF.LengthMeasurement);
      this.lengthMeasurer.world = this.world;
      this.lengthMeasurer.enabled = false;
      this.lengthMeasurer.units = this.measureSettings.unit;
      this.lengthMeasurer.rounding = this.measureSettings.precision;
      this.applySnappingsTo(this.lengthMeasurer);
      this.lengthMeasurer.list.onItemAdded.add(() => this.emitMeasureChange());
      this.lengthMeasurer.list.onItemDeleted.add(() => this.emitMeasureChange());
      this.lengthMeasurer.list.onCleared.add(() => this.emitMeasureChange());
      this.lengthMeasurer.applyPlanesVisibility(this.clipPlanes);
    }
    return this.lengthMeasurer;
  }

  private getOrCreateAngleMeasurer(): OBCF.AngleMeasurement | null {
    if (!this.components || !this.world) return null;
    if (!this.angleMeasurer) {
      this.angleMeasurer = this.components.get(OBCF.AngleMeasurement);
      this.angleMeasurer.world = this.world;
      this.angleMeasurer.enabled = false;
      this.angleMeasurer.rounding = this.measureSettings.precision;
      this.applySnappingsTo(this.angleMeasurer);
      this.angleMeasurer.list.onItemAdded.add(() => this.emitMeasureChange());
      this.angleMeasurer.list.onItemDeleted.add(() => this.emitMeasureChange());
      this.angleMeasurer.list.onCleared.add(() => this.emitMeasureChange());
      this.angleMeasurer.applyPlanesVisibility(this.clipPlanes);
    }
    return this.angleMeasurer;
  }

  private getOrCreateAreaMeasurer(): OBCF.AreaMeasurement | null {
    if (!this.components || !this.world) return null;
    if (!this.areaMeasurer) {
      this.areaMeasurer = this.components.get(OBCF.AreaMeasurement);
      this.areaMeasurer.world = this.world;
      this.areaMeasurer.enabled = false;
      const areaUnit = this.measureSettings.unit === 'mm' ? 'mm2' : this.measureSettings.unit === 'cm' ? 'cm2' : 'm2';
      this.areaMeasurer.units = areaUnit;
      this.areaMeasurer.rounding = this.measureSettings.precision;
      this.applySnappingsTo(this.areaMeasurer);
      this.areaMeasurer.list.onItemAdded.add(() => this.emitMeasureChange());
      this.areaMeasurer.list.onItemDeleted.add(() => this.emitMeasureChange());
      this.areaMeasurer.list.onCleared.add(() => this.emitMeasureChange());
      this.areaMeasurer.applyPlanesVisibility(this.clipPlanes);
    }
    return this.areaMeasurer;
  }

  private getOrCreateVolumeMeasurer(): OBCF.VolumeMeasurement | null {
    if (!this.components || !this.world) return null;
    if (!this.volumeMeasurer) {
      this.volumeMeasurer = this.components.get(OBCF.VolumeMeasurement);
      this.volumeMeasurer.world = this.world;
      this.volumeMeasurer.enabled = false;
      const volUnit = this.measureSettings.unit === 'mm' ? 'mm3' : this.measureSettings.unit === 'cm' ? 'cm3' : 'm3';
      this.volumeMeasurer.units = volUnit;
      this.volumeMeasurer.rounding = this.measureSettings.precision;
      this.volumeMeasurer.list.onItemAdded.add(() => this.emitMeasureChange());
      this.volumeMeasurer.list.onItemDeleted.add(() => this.emitMeasureChange());
      this.volumeMeasurer.list.onCleared.add(() => this.emitMeasureChange());
      this.volumeMeasurer.applyPlanesVisibility(this.clipPlanes);
    }
    return this.volumeMeasurer;
  }

  private applySnappingsTo(measurer: OBCF.Measurement<any, any>): void {
    const snappings: FRAGS.SnappingClass[] = [];
    if (this.measureSettings.snap.vertex) snappings.push(FRAGS.SnappingClass.POINT);
    if (this.measureSettings.snap.edge) snappings.push(FRAGS.SnappingClass.LINE);
    if (this.measureSettings.snap.face) snappings.push(FRAGS.SnappingClass.FACE);
    measurer.snappings = snappings;
  }

  private get currentMeasurer(): (OBCF.LengthMeasurement | OBCF.AngleMeasurement | OBCF.AreaMeasurement | OBCF.VolumeMeasurement) | null {
    switch (this.currentMeasureTool) {
      case 'length':
      case 'edge':
        return this.getOrCreateLengthMeasurer();
      case 'angle':
        return this.getOrCreateAngleMeasurer();
      case 'area':
        return this.getOrCreateAreaMeasurer();
      case 'volume':
        return this.getOrCreateVolumeMeasurer();
      default:
        return null;
    }
  }

  private getMeasureItems(): MeasureItem[] {
    const items: MeasureItem[] = [];
    if (this.lengthMeasurer) {
      for (const line of this.lengthMeasurer.list) {
        items.push({
          id: line.id,
          tool: (line as any)._mode === 'edge' ? 'edge' : 'length',
          value: line.value,
          unit: line.units,
          points: [toModel(line.start), toModel(line.end)],
        });
      }
    }
    if (this.angleMeasurer) {
      for (const angle of this.angleMeasurer.list) {
        items.push({
          id: angle.id,
          tool: 'angle',
          value: angle.value,
          unit: angle.units,
          points: [toModel(angle.start), toModel(angle.vertex), toModel(angle.end)],
        });
      }
    }
    if (this.areaMeasurer) {
      for (const area of this.areaMeasurer.list) {
        items.push({
          id: area.id,
          tool: 'area',
          value: area.value,
          unit: area.units,
          points: [...area.points].map((p) => toModel(p)),
        });
      }
    }
    if (this.volumeMeasurer) {
      for (const vol of this.volumeMeasurer.list) {
        items.push({
          id: vol.id,
          tool: 'volume',
          value: (vol as any)._cachedValue ?? 0,
          unit: vol.units,
          points: [],
        });
      }
    }
    return items;
  }

  private emitMeasureChange(): void {
    this.events.emit('measureChange', { items: this.getMeasureItems() });
  }

  setMeasureTool(tool: MeasureTool | null): AdapterResult {
    if (this.lengthMeasurer) this.lengthMeasurer.enabled = false;
    if (this.angleMeasurer) this.angleMeasurer.enabled = false;
    if (this.areaMeasurer) this.areaMeasurer.enabled = false;
    if (this.volumeMeasurer) this.volumeMeasurer.enabled = false;

    this.currentMeasureTool = tool;
    if (!tool) {
      return okVoid;
    }

    if (tool === 'length') {
      const m = this.getOrCreateLengthMeasurer();
      if (m) {
        m.mode = 'free';
        m.enabled = true;
      }
    } else if (tool === 'edge') {
      const m = this.getOrCreateLengthMeasurer();
      if (m) {
        m.mode = 'edge';
        m.enabled = true;
      }
    } else if (tool === 'angle') {
      const m = this.getOrCreateAngleMeasurer();
      if (m) {
        m.mode = 'free';
        m.enabled = true;
      }
    } else if (tool === 'area') {
      const m = this.getOrCreateAreaMeasurer();
      if (m) {
        m.mode = 'free';
        m.enabled = true;
      }
    } else if (tool === 'volume') {
      const m = this.getOrCreateVolumeMeasurer();
      if (m) {
        m.enabled = true;
      }
    }

    return okVoid;
  }

  setMeasureSettings(s: MeasureSettings): AdapterResult {
    this.measureSettings = structuredClone(s);
    if (this.lengthMeasurer) {
      this.lengthMeasurer.units = s.unit;
      this.lengthMeasurer.rounding = s.precision;
      for (const line of this.lengthMeasurer.list) {
        line.units = s.unit;
        line.rounding = s.precision;
      }
      this.applySnappingsTo(this.lengthMeasurer);
    }
    if (this.areaMeasurer) {
      const areaUnit = s.unit === 'mm' ? 'mm2' : s.unit === 'cm' ? 'cm2' : 'm2';
      this.areaMeasurer.units = areaUnit;
      this.areaMeasurer.rounding = s.precision;
      for (const a of this.areaMeasurer.list) {
        a.units = areaUnit;
        a.rounding = s.precision;
      }
      this.applySnappingsTo(this.areaMeasurer);
    }
    if (this.angleMeasurer) {
      this.angleMeasurer.rounding = s.precision;
      for (const a of this.angleMeasurer.list) {
        a.rounding = s.precision;
      }
      this.applySnappingsTo(this.angleMeasurer);
    }
    if (this.volumeMeasurer) {
      const volUnit = s.unit === 'mm' ? 'mm3' : s.unit === 'cm' ? 'cm3' : 'm3';
      this.volumeMeasurer.units = volUnit;
      this.volumeMeasurer.rounding = s.precision;
      for (const v of this.volumeMeasurer.list) {
        v.units = volUnit;
        v.rounding = s.precision;
      }
    }
    this.emitMeasureChange();
    return okVoid;
  }

  clearMeasurements(): AdapterResult {
    this.lengthMeasurer?.list.clear();
    this.angleMeasurer?.list.clear();
    this.areaMeasurer?.list.clear();
    this.volumeMeasurer?.list.clear();
    this.emitMeasureChange();
    return okVoid;
  }

  deleteMeasurement(id: string): AdapterResult {
    if (this.lengthMeasurer) {
      const line = [...this.lengthMeasurer.list].find((l) => l.id === id);
      if (line) {
        this.lengthMeasurer.list.delete(line);
        this.emitMeasureChange();
        return okVoid;
      }
    }
    if (this.angleMeasurer) {
      const a = [...this.angleMeasurer.list].find((m) => m.id === id);
      if (a) {
        this.angleMeasurer.list.delete(a);
        this.emitMeasureChange();
        return okVoid;
      }
    }
    if (this.areaMeasurer) {
      const a = [...this.areaMeasurer.list].find((m) => m.id === id);
      if (a) {
        this.areaMeasurer.list.delete(a);
        this.emitMeasureChange();
        return okVoid;
      }
    }
    if (this.volumeMeasurer) {
      const v = [...this.volumeMeasurer.list].find((m) => m.id === id);
      if (v) {
        this.volumeMeasurer.list.delete(v);
        this.emitMeasureChange();
        return okVoid;
      }
    }
    return fail('not-found', `Measurement with id ${id} not found.`);
  }

  setMeasurementsVisible(visible: boolean): AdapterResult {
    if (this.lengthMeasurer) this.lengthMeasurer.visible = visible;
    if (this.angleMeasurer) this.angleMeasurer.visible = visible;
    if (this.areaMeasurer) this.areaMeasurer.visible = visible;
    if (this.volumeMeasurer) this.volumeMeasurer.visible = visible;
    return okVoid;
  }

  debugState() {
    let totalElements = 0;
    for (const entry of this.modelsMap.values()) {
      totalElements += entry.jnnModel.elements.length;
    }
    const isIsolated = this.visibility.isolated.size > 0;
    let visibleCount = totalElements;
    if (isIsolated) {
      let count = 0;
      for (const id of this.visibility.isolated) {
        if (!this.visibility.hidden.has(id)) count++;
      }
      visibleCount = count;
    } else {
      visibleCount = Math.max(0, totalElements - this.visibility.hidden.size);
    }

    return {
      elementCount: totalElements,
      visibleCount,
      selected: [...this.selection],
      clipPlaneCount: this.clipPlanes.length,
      projection: this.currentProjection,
      xray: this.xray,
      models: [...this.modelsMap.entries()].map(([id, entry]) => {
        entry.model.object.updateMatrixWorld?.(true);
        const worldBox = entry.model.box && !entry.model.box.isEmpty() ? entry.model.box : null;
        return {
          id,
          elementCount: entry.jnnModel.elements.length,
          bounds: worldBox
            ? {
                min: [worldBox.min.x, -worldBox.max.z, worldBox.min.y],
                max: [worldBox.max.x, -worldBox.min.z, worldBox.max.y],
              }
            : null,
        };
      }),
    };
  }

  private parseElementId(id: string): { targetModelId: string; localId: number } {
    const lastColon = id.lastIndexOf(':');
    if (lastColon === -1) {
      const num = Number(id);
      const fallbackModelId = this.modelsMap.keys().next().value ?? '';
      return { targetModelId: fallbackModelId, localId: isNaN(num) ? -1 : num };
    }
    const modelId = id.slice(0, lastColon);
    const localId = Number(id.slice(lastColon + 1));
    let targetModelId = modelId;
    if (!this.modelsMap.has(targetModelId) && this.modelsMap.size === 1) {
      targetModelId = this.modelsMap.keys().next().value!;
    }
    return { targetModelId, localId: isNaN(localId) ? -1 : localId };
  }

  private toModelIdMap(ids: readonly string[]): Record<string, Set<number>> {
    const map: Record<string, Set<number>> = {};
    for (const id of ids) {
      const { targetModelId, localId } = this.parseElementId(id);
      if (localId === -1 || !targetModelId) continue;
      if (!map[targetModelId]) {
        map[targetModelId] = new Set<number>();
      }
      map[targetModelId].add(localId);
    }
    return map;
  }

  private applyVisibility(): void {
    if (!this.fragments) return;

    const isIsolated = this.visibility.isolated.size > 0;
    const isHidden = this.visibility.hidden.size > 0;

    for (const [modelId, entry] of this.modelsMap) {
      const model = entry.model;

      if (!isIsolated && !isHidden) {
        model.setVisible(undefined, true).catch((err) => console.warn('setVisible failed:', err));
        continue;
      }

      if (isIsolated) {
        model.setVisible(undefined, false).then(() => {
          const toShow: number[] = [];
          for (const id of this.visibility.isolated) {
            if (this.visibility.hidden.has(id)) continue;
            const { targetModelId, localId } = this.parseElementId(id);
            if (targetModelId === modelId && localId !== -1) {
              toShow.push(localId);
            }
          }
          if (toShow.length > 0) {
            model.setVisible(toShow, true).catch((err) => console.warn('setVisible failed:', err));
          }
          this.fragments?.core.update(true);
        }).catch((err) => console.warn('setVisible failed:', err));
      } else {
        const toHide: number[] = [];
        for (const id of this.visibility.hidden) {
          const { targetModelId, localId } = this.parseElementId(id);
          if (targetModelId === modelId && localId !== -1) {
            toHide.push(localId);
          }
        }
        model.setVisible(undefined, true).then(() => {
          if (toHide.length > 0) {
            model.setVisible(toHide, false).catch((err) => console.warn('setVisible failed:', err));
          }
          this.fragments?.core.update(true);
        }).catch((err) => console.warn('setVisible failed:', err));
      }
    }

    this.fragments.core.update(true);
  }

  private applyXray(): void {
    for (const [modelId, entry] of this.modelsMap) {
      if (this.xray) {
        const selectedLocalIds: number[] = [];
        for (const id of this.selection) {
          const { targetModelId, localId } = this.parseElementId(id);
          if (targetModelId === modelId && localId !== -1) {
            selectedLocalIds.push(localId);
          }
        }
        entry.model.setGhostItems(selectedLocalIds, true).catch(() => {});
      } else {
        entry.model.clearGhost();
      }
    }
    if (this.fragments) {
      this.fragments.core.update(true);
    }
  }

  private async refreshSelectionCenter(): Promise<void> {
    const req = ++this.selectionCenterReq;
    const ids = [...this.selection].filter((id) => isVisible(id, this.visibility));
    if (!ids.length) {
      this.selectionCenter = null;
      return;
    }
    const box = new THREE.Box3();
    const modelMap = this.toModelIdMap(ids);
    for (const [modelKey, localIds] of Object.entries(modelMap)) {
      const entry = this.modelsMap.get(modelKey);
      if (!entry?.model?.object?.visible) continue;
      if (typeof (entry.model as any).getMergedBox === 'function') {
        try {
          const modelBox = await (entry.model as any).getMergedBox([...localIds]);
          if (modelBox && !modelBox.isEmpty()) {
            box.union(modelBox);
          }
        } catch (err) {
          console.warn('getMergedBox failed:', err);
        }
      } else if (entry.model?.box && !entry.model.box.isEmpty()) {
        box.union(entry.model.box);
      }
    }
    if (req !== this.selectionCenterReq || this.disposed) return;
    this.selectionCenter = box.isEmpty() ? null : box.getCenter(new THREE.Vector3());
  }

  async pickAt(clientX: number, clientY: number): Promise<PickResult | null> {
    if (!this.world || !this.world.renderer || this.modelsMap.size === 0) return null;
    const dom = this.world.renderer.three.domElement;
    const rect = dom.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const position = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );

    try {
      const raycasters = this.components?.get(OBC.Raycasters);
      const raycaster = raycasters?.get(this.world);
      if (!raycaster) return null;

      const hit = (await raycaster.castRay({ position })) as any;
      if (!hit || hit.localId === undefined || hit.localId === null) return null;

      // Ignore points clipped by active section planes
      if (hit.point && this.clipPlanes.some((p) => p.distanceToPoint(hit.point) < -1e-6)) {
        return null;
      }

      let matchedEntry: { model: FragmentsModel; jnnModel: JnnModel } | undefined;
      for (const entry of this.modelsMap.values()) {
        if (entry.model === hit.fragments || entry.model.modelId === (hit as any).modelId) {
          matchedEntry = entry;
          break;
        }
      }
      if (!matchedEntry) {
        matchedEntry = this.modelsMap.values().next().value;
      }
      if (!matchedEntry) return null;

      const elementId = `${matchedEntry.jnnModel.modelId}:${hit.localId}`;
      if (!isVisible(elementId, this.visibility)) return null;

      const point = hit.point ? toModel(hit.point) : ([0, 0, 0] as Vec3);
      let normal: Vec3 | undefined = undefined;
      const rawNormal = hit.normal ?? hit.face?.normal;
      if (rawNormal) {
        const nThree = new THREE.Vector3(rawNormal.x, rawNormal.y, rawNormal.z);
        if (hit.object) {
          nThree.transformDirection(hit.object.matrixWorld);
        }
        nThree.normalize();
        normal = toModel(nThree);
      }
      return { elementId, point, normal };
    } catch (err) {
      console.warn('pickAt failed:', err);
      return null;
    }
  }

  private onPointerDown = (ev: PointerEvent) => {
    if (ev.button !== 0) return;
    this.pointerDown = { x: ev.clientX, y: ev.clientY };
  };

  private onPointerUp = async (ev: PointerEvent) => {
    const d = this.pointerDown;
    this.pointerDown = null;
    if (!d || ev.button !== 0) return;
    const moved = Math.hypot(ev.clientX - d.x, ev.clientY - d.y);
    if (moved > 5) return;
    if (this.currentMeasureTool) {
      const m = this.currentMeasurer;
      if (m) {
        await (m as any).create();
        this.emitMeasureChange();
      }
      return;
    }
    const hit = await this.pickAt(ev.clientX, ev.clientY);
    this.events.emit('pick', {
      result: hit,
      additive: ev.ctrlKey || ev.metaKey || ev.shiftKey,
    });
  };

  private onPointerMove = async (ev: PointerEvent) => {
    if (this.currentMeasureTool) return;
    if (ev.buttons !== 0 || ev.pointerType === 'touch') return;
    const now = performance.now();
    if (now - this.lastHoverAt < 40) return;
    this.lastHoverAt = now;
    const hit = await this.pickAt(ev.clientX, ev.clientY);
    if (hit) {
      this.lastHover = {
        x: ev.clientX,
        y: ev.clientY,
        t: performance.now(),
        point: toThree(hit.point),
      };
    } else {
      this.lastHover = null;
    }
    const id = hit?.elementId ?? null;
    if (id !== this.hovered) {
      this.hovered = id;
      if (this.world?.renderer?.three?.domElement) {
        this.world.renderer.three.domElement.style.cursor = id ? 'pointer' : 'default';
      }
      if (this.highlighter) {
        if (id) {
          const modelIdMap = this.toModelIdMap([id]);
          this.highlighter.highlightByID('hover', modelIdMap, true, false).catch(() => {});
        } else {
          this.highlighter.clear('hover').catch(() => {});
        }
      }
      this.events.emit('hover', { elementId: id });
    }
  };

  private onPointerLeave = () => {
    if (this.hovered) {
      this.hovered = null;
      if (this.highlighter) {
        this.highlighter.clear('hover').catch(() => {});
      }
      this.events.emit('hover', { elementId: null });
    }
  };

  async captureScreenshot(options?: {
    mimeType?: string;
    quality?: number;
    maxWidth?: number;
    maxHeight?: number;
  }): Promise<string | null> {
    if (!this.world?.renderer?.three || !this.world.scene?.three || !this.world.camera?.three) return null;
    this.world.renderer.three.render(this.world.scene.three, this.world.camera.three);
    const dom = this.world.renderer.three.domElement;
    const mime = options?.mimeType || 'image/png';
    const quality = options?.quality ?? 0.92;
    if (!options?.maxWidth && !options?.maxHeight) {
      return dom.toDataURL(mime, quality);
    }
    const maxW = options.maxWidth || dom.width;
    const maxH = options.maxHeight || dom.height;
    const scale = Math.min(maxW / dom.width, maxH / dom.height, 1);
    const w = Math.max(1, Math.round(dom.width * scale));
    const h = Math.max(1, Math.round(dom.height * scale));
    const thumb = document.createElement('canvas');
    thumb.width = w;
    thumb.height = h;
    const ctx = thumb.getContext('2d');
    if (!ctx) return dom.toDataURL(mime, quality);
    ctx.drawImage(dom, 0, 0, w, h);
    return thumb.toDataURL(mime, quality);
  }

  on<K extends keyof ViewerEvents>(event: K, handler: (payload: ViewerEvents[K]) => void): () => void {
    return this.events.on(event, handler);
  }
}
