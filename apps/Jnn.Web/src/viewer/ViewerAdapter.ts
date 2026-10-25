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

export type ViewPreset = 'iso' | 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right';

/** Camera in model coordinates (+Z up). */
export interface CameraState {
  position: Vec3;
  target: Vec3;
  projection: 'perspective' | 'orthographic';
}

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
}

export interface ViewerEvents {
  /** Fired on a click in the viewport (not after an orbit/pan drag). */
  pick: { result: PickResult | null; additive: boolean };
  hover: { elementId: string | null };
  cameraChange: CameraState;
}

export type ViewerEventName = keyof ViewerEvents;
export type Unsubscribe = () => void;

export interface ViewerAdapter {
  readonly id: string;
  readonly capabilities: ReadonlySet<ViewerCapability>;

  mount(container: HTMLElement): void;
  dispose(): void;

  loadModel(model: JnnModel): Promise<AdapterResult<{ elementCount: number; bounds: Bounds }>>;
  getModelBounds(): AdapterResult<Bounds>;

  select(ids: readonly string[]): AdapterResult;
  getProperties(id: string): AdapterResult<{ element: JnnElement; propertySets: PropertySet[] }>;

  setHidden(ids: readonly string[]): AdapterResult;
  /** Empty array clears isolation. */
  isolate(ids: readonly string[]): AdapterResult;

  fitToView(ids?: readonly string[]): AdapterResult;
  setViewPreset(preset: ViewPreset): AdapterResult;
  setCamera(camera: CameraState): AdapterResult;
  getCamera(): AdapterResult<CameraState>;
  setProjection(projection: CameraState['projection']): AdapterResult;

  setSection(spec: SectionSpec | null): AdapterResult;

  /** Colour override; `null` clears highlights. Colour is CSS hex. */
  highlight(ids: readonly string[] | null, color?: string): AdapterResult;
  setXray(enabled: boolean): AdapterResult;
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
