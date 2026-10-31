/**
 * ViewerAdapter — the single contract the UI talks to, whatever renders the
 * model (Three.js for JNN/IFC caches, Autodesk APS Viewer for RVT/NWC/NWD).
 *
 * Adapters MUST declare what they support via `capabilities`. A call to an
 * unsupported operation must resolve to `{ ok: false, code: 'unsupported' }`
 * rather than silently doing nothing.
 */
import type { JnnElement, JnnModel, PropertySet } from '../domain/model';

export type Vec3 = [number, number, number];

export type AdapterErrorCode = 'unsupported' | 'not-loaded' | 'not-found' | 'invalid-argument' | 'failed';

export type AdapterResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; code: AdapterErrorCode; message: string };

export const ok = <T>(value: T): AdapterResult<T> => ({ ok: true, value });
export const okVoid: AdapterResult = { ok: true, value: undefined };
export const fail = (code: AdapterErrorCode, message: string): AdapterResult<never> => ({ ok: false, code, message });

export type ViewerCapability =
  | 'loadModel'
  | 'loadIfc'
  | 'select'
  | 'getProperties'
  | 'visibility'
  | 'isolate'
  | 'fitToView'
  | 'camera'
  | 'sectionPlane'
  | 'sectionBox'
  | 'highlight'
  | 'xray';

export type ViewPreset =
  | 'iso'
  | 'top'
  | 'bottom'
  | 'front'
  | 'back'
  | 'left'
  | 'right'
  | 'top-front'
  | 'top-back'
  | 'top-left'
  | 'top-right'
  | 'bottom-front'
  | 'bottom-back'
  | 'bottom-left'
  | 'bottom-right'
  | 'front-left'
  | 'front-right'
  | 'back-left'
  | 'back-right'
  | 'top-front-left'
  | 'top-front-right'
  | 'top-back-left'
  | 'top-back-right'
  | 'bottom-front-left'
  | 'bottom-front-right'
  | 'bottom-back-left'
  | 'bottom-back-right';

/** Camera in model coordinates (+Z up). */
export interface CameraState {
  position: Vec3;
  target: Vec3;
  projection: 'perspective' | 'orthographic';
}

export type NavigationPreset = 'revit' | 'classic';

export interface NavigationSettings {
  preset: NavigationPreset;        // default 'revit'
  rotateSpeed: number;             // 0.1–1.0, default 0.4
  zoomSpeed: number;               // 0.3–2.0, default 1.0
  orbitAroundCursor: boolean;      // default true
  orbitAroundSelection: boolean;   // default true
  showPivot: boolean;              // default true
}

export const DEFAULT_NAV: NavigationSettings = {
  preset: 'revit',
  rotateSpeed: 0.4,
  zoomSpeed: 1.0,
  orbitAroundCursor: true,
  orbitAroundSelection: true,
  showPivot: true,
};

export type SectionAxis = 'x' | 'y' | 'z';

export type SectionSpec =
  | {
      kind: 'plane';
      axis: SectionAxis;
      /** Plane position along the axis, in model units. */
      offset: number;
      /** false: keep the side with coordinates below `offset`. */
      flipped: boolean;
    }
  | { kind: 'box'; min: Vec3; max: Vec3 };

export interface Bounds {
  min: Vec3;
  max: Vec3;
}

export interface PickResult {
  elementId: string;
  point: Vec3;
  normal?: Vec3;
}

export interface FpsStats {
  avgFps: number;
  maxFrameMs: number;
  over100Count: number;
  active: boolean;
  raycastCount?: number;
}

export interface ViewerEvents {
  /** Fired on a click in the viewport (not after an orbit/pan drag). */
  pick: { result: PickResult | null; additive: boolean };
  hover: { elementId: string | null };
  cameraChange: CameraState;
  navHint: { kind: 'holdShiftToOrbit' };
  sectionEdit: { spec: SectionSpec; phase: 'drag' | 'end'; handle?: string };
  fpsStats: FpsStats;
}

export type ViewerEventName = keyof ViewerEvents;
export type Unsubscribe = () => void;

export interface ViewerAdapter {
  readonly id: string;
  readonly capabilities: ReadonlySet<ViewerCapability>;

  mount(container: HTMLElement): void;
  dispose(): void;

  loadModel(model: JnnModel): Promise<AdapterResult<{ elementCount: number; bounds: Bounds }>>;
  loadIfc?(
    file: ArrayBuffer | Uint8Array,
    name: string,
    onProgress?: (percent: number, status?: string) => void,
    options?: { append?: boolean; bypassCache?: boolean },
  ): Promise<AdapterResult<{ elementCount: number; bounds: Bounds; model?: JnnModel; fromCache?: boolean }>>;
  removeModel?(modelId: string): AdapterResult;
  setModelVisibility?(modelId: string, visible: boolean): AdapterResult;
  fitToModel?(modelId: string): AdapterResult;
  getModelBounds(modelId?: string): AdapterResult<Bounds>;

  select(ids: readonly string[]): AdapterResult;
  getProperties(
    id: string,
  ): AdapterResult<{ element: JnnElement; propertySets: PropertySet[] }> | Promise<AdapterResult<{ element: JnnElement; propertySets: PropertySet[] }>>;

  setHidden(ids: readonly string[]): AdapterResult;
  /** Empty array clears isolation. */
  isolate(ids: readonly string[]): AdapterResult;

  fitToView(ids?: readonly string[]): AdapterResult;
  setViewPreset(preset: ViewPreset): AdapterResult;
  setCamera(camera: CameraState): AdapterResult;
  getCamera(): AdapterResult<CameraState>;
  setProjection(projection: CameraState['projection']): AdapterResult;
  setNavigationSettings?(s: NavigationSettings): AdapterResult;
  /** Rotate camera around current pivot in radians. Used for ViewCube drag. */
  orbitBy?(deltaAzimuth: number, deltaPolar: number, animate?: boolean): AdapterResult;

  setSection(spec: SectionSpec | null): AdapterResult;
  setSectionFrameVisible?(visible: boolean): AdapterResult;

  /** Colour override; `null` clears highlights. Accepts array of IDs or Map of id->color. Colour is CSS hex. */
  highlight(ids: readonly string[] | Map<string, string> | null, color?: string): AdapterResult;
  setXray(enabled: boolean): AdapterResult;
  setGridVisible?(visible: boolean): AdapterResult;
  setTheme(theme: 'light' | 'dark'): void;

  /** Screen-space position (CSS px, relative to the container) of an element's centre. */
  projectToScreen(id: string): AdapterResult<{ x: number; y: number; onScreen: boolean }>;

  on<K extends ViewerEventName>(event: K, handler: (payload: ViewerEvents[K]) => void): Unsubscribe;
}

/** Small typed event emitter adapters can reuse. */
export class Emitter<E> {
  private handlers = new Map<keyof E, Set<(p: never) => void>>();
  on<K extends keyof E>(event: K, handler: (payload: E[K]) => void): Unsubscribe {
    let set = this.handlers.get(event);
    if (!set) this.handlers.set(event, (set = new Set()));
    set.add(handler as (p: never) => void);
    return () => set!.delete(handler as (p: never) => void);
  }
  emit<K extends keyof E>(event: K, payload: E[K]): void {
    this.handlers.get(event)?.forEach((h) => (h as (p: E[K]) => void)(payload));
  }
  clear() {
    this.handlers.clear();
  }
}
