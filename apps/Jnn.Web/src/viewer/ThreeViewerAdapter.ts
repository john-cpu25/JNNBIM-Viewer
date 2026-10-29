/**
 * Three.js implementation of ViewerAdapter for JNN geometry (sample model in
 * Milestone 1; JNN geometry cache bundles from the IFC adapter later).
 *
 * Conventions: model space is +Z up (IFC). The whole model sits under
 * `modelRoot`, which is rotated so Three.js keeps its native +Y up.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { JnnElement, JnnModel } from '../domain/model';
import { boundsOf, center as boundsCenter, elementBounds, isEmpty, size as boundsSize } from '../domain/bounds';
import { isVisible, type VisibilityState } from '../domain/visibility';
import { categoryStyle } from './categoryStyle';
import {
  Emitter,
  fail,
  ok,
  okVoid,
  type AdapterResult,
  type Bounds,
  type CameraState,
  type SectionSpec,
  type Vec3,
  type ViewerAdapter,
  type ViewerCapability,
  type ViewerEvents,
  type ViewPreset,
  type NavigationSettings,
  DEFAULT_NAV,
} from './ViewerAdapter';

/** Minimal renderer surface so unit tests can run without WebGL. */
export interface RendererLike {
  domElement: HTMLCanvasElement;
  localClippingEnabled: boolean;
  setPixelRatio(r: number): void;
  setSize(w: number, h: number, updateStyle?: boolean): void;
  setClearColor(color: THREE.ColorRepresentation, alpha?: number): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  dispose(): void;
}

export interface ThreeViewerOptions {
  createRenderer?: () => RendererLike;
  /** Disable the rAF loop (tests). */
  manualRender?: boolean;
}

interface ElementEntry {
  element: JnnElement;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  edges: THREE.LineSegments;
  baseColor: THREE.Color;
  baseOpacity: number;
  bounds: Bounds;
}

const THEMES = {
  light: { background: 0xeef0f2, edge: 0x2b3138, edgeOpacity: 0.32, grid: 0xc4c9cf, gridCenter: 0xa9b0b8, plane: 0xe8590c },
  dark: { background: 0x15181c, edge: 0x07090b, edgeOpacity: 0.55, grid: 0x2b3138, gridCenter: 0x3a424b, plane: 0xf08c2e },
} as const;

const SELECT_COLOR = new THREE.Color(0xf08c2e);
const HOVER_EMISSIVE = new THREE.Color(0x3a2a14);

const toThree = (p: Vec3) => new THREE.Vector3(p[0], p[2], -p[1]);
const toModel = (v: THREE.Vector3): Vec3 => [v.x, -v.z, v.y];

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

export class ThreeViewerAdapter implements ViewerAdapter {
  readonly id = 'three';
  readonly capabilities: ReadonlySet<ViewerCapability> = new Set<ViewerCapability>([
    'loadModel',
    'select',
    'getProperties',
    'visibility',
    'isolate',
    'fitToView',
    'camera',
    'sectionPlane',
    'sectionBox',
    'highlight',
    'xray',
  ]);

  private readonly events = new Emitter<ViewerEvents>();
  private readonly scene = new THREE.Scene();
  private readonly modelRoot = new THREE.Group();
  private readonly helpers = new THREE.Group();
  private readonly perspective = new THREE.PerspectiveCamera(45, 1, 0.05, 5000);
  private readonly ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -5000, 5000);
  private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = this.perspective;
  private renderer: RendererLike | null = null;
  private controls: OrbitControls | null = null;
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private raf = 0;
  private needsRender = true;
  private disposed = false;

  private readonly entries = new Map<string, ElementEntry>();
  private readonly pickables: THREE.Mesh[] = [];
  private readonly unitBox = new THREE.BoxGeometry(1, 1, 1);
  private readonly unitEdges = new THREE.EdgesGeometry(this.unitBox);
  private readonly edgeMaterial = new THREE.LineBasicMaterial({ transparent: true });
  private grid: THREE.GridHelper | null = null;
  private currentSection: SectionSpec | null = null;
  private gridVisible = true;
  private sectionHelper: THREE.Object3D | null = null;
  private modelBounds: Bounds | null = null;

  private selection = new Set<string>();
  private visibility: VisibilityState = { hidden: new Set(), isolated: new Set() };
  private highlights = new Map<string, THREE.Color>();
  private hovered: string | null = null;
  private xray = false;
  private clipPlanes: THREE.Plane[] = [];
  private theme: 'light' | 'dark' = 'light';
  private nav: NavigationSettings = { ...DEFAULT_NAV };

  private tween: { from: [THREE.Vector3, THREE.Vector3]; to: [THREE.Vector3, THREE.Vector3]; t0: number; ms: number; zoom?: [number, number] } | null = null;
  private pointerDown: { x: number; y: number } | null = null;
  private lastHoverAt = 0;

  constructor(private readonly options: ThreeViewerOptions = {}) {
    this.modelRoot.rotation.x = -Math.PI / 2;
    this.scene.add(this.modelRoot, this.helpers);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8d8576, 1.6);
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(40, 80, 30);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(-40, 20, -50);
    this.scene.add(hemi, sun, fill);
  }

  // ---------------------------------------------------------------- lifecycle
  mount(container: HTMLElement): void {
    if (this.renderer) return;
    this.container = container;
    const renderer = this.options.createRenderer
      ? this.options.createRenderer()
      : new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    renderer.localClippingEnabled = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.setAttribute('data-testid', 'viewer-canvas');
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const controls = new OrbitControls(this.camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.screenSpacePanning = true;
    controls.zoomToCursor = true;
    controls.addEventListener('change', () => {
      this.requestRender();
      this.events.emit('cameraChange', this.cameraState());
    });
    this.controls = controls;

    const el = renderer.domElement;
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerleave', this.onPointerLeave);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(container);
    }
    this.resize();
    this.applyTheme();
    if (!this.options.manualRender) this.loop();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    const el = this.renderer?.domElement;
    if (el) {
      el.removeEventListener('pointerdown', this.onPointerDown);
      el.removeEventListener('pointerup', this.onPointerUp);
      el.removeEventListener('pointermove', this.onPointerMove);
      el.removeEventListener('pointerleave', this.onPointerLeave);
      el.remove();
    }
    this.controls?.dispose();
    this.clearModel();
    this.unitBox.dispose();
    this.unitEdges.dispose();
    this.edgeMaterial.dispose();
    this.renderer?.dispose();
    this.renderer = null;
    this.events.clear();
  }

  on: ViewerAdapter['on'] = (event, handler) => this.events.on(event, handler);

  // -------------------------------------------------------------------- model
  async loadModel(model: JnnModel): Promise<AdapterResult<{ elementCount: number; bounds: Bounds }>> {
    this.clearModel();
    let skipped = 0;
    for (const el of model.elements) {
      const prim = el.meshRefs.find((r) => r.primitive)?.primitive;
      if (!prim || el.geometryStatus === 'missing' || el.geometryStatus === 'failed') {
        skipped++;
        continue;
      }
      const style = categoryStyle(el.category);
      const material = new THREE.MeshStandardMaterial({
        color: style.color,
        roughness: style.roughness,
        metalness: style.metalness,
        transparent: style.opacity < 1,
        opacity: style.opacity,
        depthWrite: style.opacity >= 1,
        side: THREE.FrontSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      });
      const mesh = new THREE.Mesh(this.unitBox, material);
      const placement = new THREE.Matrix4().fromArray(el.transform as number[]);
      const local = new THREE.Matrix4().compose(
        new THREE.Vector3(...prim.center),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), prim.rotationZ),
        new THREE.Vector3(...prim.size),
      );
      mesh.matrixAutoUpdate = false;
      mesh.matrix.multiplyMatrices(placement, local);
      mesh.userData.elementId = el.id;
      mesh.renderOrder = style.opacity < 1 ? 1 : 0;
      const edges = new THREE.LineSegments(this.unitEdges, this.edgeMaterial);
      edges.raycast = () => {};
      mesh.add(edges);
      this.modelRoot.add(mesh);
      this.pickables.push(mesh);
      this.entries.set(el.id, {
        element: el,
        mesh,
        edges,
        baseColor: new THREE.Color(style.color),
        baseOpacity: style.opacity,
        bounds: elementBounds(el),
      });
    }
    this.modelRoot.updateMatrixWorld(true);
    const bounds = boundsOf([...this.entries.values()].map((e) => e.element));
    this.modelBounds = bounds;
    this.buildGrid(bounds);
    this.refreshAll();
    this.setViewPreset('iso', false);
    if (skipped) console.warn(`[JNN] ${skipped} element(s) without displayable geometry were skipped.`);
    return ok({ elementCount: this.entries.size, bounds });
  }

  async loadIfc(
    _file: ArrayBuffer | Uint8Array,
    _name: string,
    _onProgress?: (percent: number, status?: string) => void,
  ): Promise<AdapterResult<{ elementCount: number; bounds: Bounds }>> {
    return fail('unsupported', 'ThreeViewerAdapter does not support IFC loading. Use ThatOpenViewerAdapter.');
  }

  getModelBounds(_modelId?: string): AdapterResult<Bounds> {
    return this.modelBounds ? ok(this.modelBounds) : fail('not-loaded', 'No model loaded.');
  }

  private clearModel() {
    for (const e of this.entries.values()) {
      e.mesh.material.dispose();
      this.modelRoot.remove(e.mesh);
    }
    this.entries.clear();
    this.pickables.length = 0;
    this.selection.clear();
    this.highlights.clear();
    this.modelBounds = null;
    if (this.grid) {
      this.helpers.remove(this.grid);
      this.grid.geometry.dispose();
      (this.grid.material as THREE.Material).dispose();
      this.grid = null;
    }
    this.setSection(null);
  }

  private buildGrid(b: Bounds) {
    const s = boundsSize(b);
    const extent = Math.ceil(Math.max(s[0], s[1]) * 1.6 / 10) * 10 + 10;
    const t = THEMES[this.theme];
    const grid = new THREE.GridHelper(extent, extent / 2, t.gridCenter, t.grid);
    const c = boundsCenter(b);
    grid.position.copy(toThree([c[0], c[1], b.min[2] - 0.01]));
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.6;
    grid.visible = this.gridVisible;
    this.grid = grid;
    this.helpers.add(grid);
  }

  // ----------------------------------------------------- selection & display
  select(ids: readonly string[]): AdapterResult {
    const missing = ids.filter((id) => !this.entries.has(id));
    if (missing.length) return fail('not-found', `Unknown element id(s): ${missing.slice(0, 3).join(', ')}`);
    this.selection = new Set(ids);
    this.refreshAll();
    return okVoid;
  }

  getProperties(id: string) {
    const e = this.entries.get(id);
    if (!e) return fail('not-found', `Unknown element id: ${id}`);
    return ok({ element: e.element, propertySets: e.element.properties });
  }

  setHidden(ids: readonly string[]): AdapterResult {
    this.visibility = { hidden: new Set(ids), isolated: this.visibility.isolated };
    this.refreshAll();
    return okVoid;
  }

  isolate(ids: readonly string[]): AdapterResult {
    this.visibility = { hidden: this.visibility.hidden, isolated: new Set(ids) };
    this.refreshAll();
    return okVoid;
  }

  highlight(ids: readonly string[] | Map<string, string> | null, color = '#2f9e44'): AdapterResult {
    this.highlights.clear();
    if (ids instanceof Map) {
      for (const [id, col] of ids) {
        if (this.entries.has(id)) this.highlights.set(id, new THREE.Color(col));
      }
    } else if (ids) {
      const c = new THREE.Color(color);
      for (const id of ids) if (this.entries.has(id)) this.highlights.set(id, c);
    }
    this.refreshAll();
    return okVoid;
  }

  setXray(enabled: boolean): AdapterResult {
    this.xray = enabled;
    this.refreshAll();
    return okVoid;
  }

  setGridVisible(visible: boolean): AdapterResult {
    this.gridVisible = visible;
    if (this.grid) {
      this.grid.visible = visible;
      this.requestRender();
    }
    return okVoid;
  }

  setTheme(theme: 'light' | 'dark'): void {
    this.theme = theme;
    this.applyTheme();
  }

  private applyTheme() {
    const t = THEMES[this.theme];
    this.renderer?.setClearColor(t.background, 1);
    this.scene.background = new THREE.Color(t.background);
    this.edgeMaterial.color.set(t.edge);
    this.edgeMaterial.opacity = t.edgeOpacity;
    if (this.modelBounds && this.grid) {
      this.helpers.remove(this.grid);
      this.grid.geometry.dispose();
      this.buildGrid(this.modelBounds);
    }
    this.refreshAll();
  }

  /** Re-derive every element's material state from selection/visibility/etc. */
  private refreshAll() {
    for (const [id, e] of this.entries) {
      const m = e.mesh.material;
      const selected = this.selection.has(id);
      e.mesh.visible = isVisible(id, this.visibility);
      const hl = this.highlights.get(id);
      m.color.copy(selected ? SELECT_COLOR : (hl ?? e.baseColor));
      m.emissive.copy(selected ? SELECT_COLOR : this.hovered === id ? HOVER_EMISSIVE : new THREE.Color(0));
      m.emissiveIntensity = selected ? 0.35 : 1;
      const ghost = this.xray && !selected && !hl;
      const opacity = ghost ? Math.min(0.12, e.baseOpacity) : e.baseOpacity;
      m.opacity = opacity;
      m.transparent = opacity < 1;
      m.depthWrite = opacity >= 1;
      m.clippingPlanes = this.clipPlanes.length ? this.clipPlanes : null;
      e.edges.visible = !ghost;
      m.needsUpdate = true;
    }
    this.edgeMaterial.clippingPlanes = this.clipPlanes.length ? this.clipPlanes : null;
    this.edgeMaterial.needsUpdate = true;
    this.requestRender();
  }

  // ------------------------------------------------------------------ camera
  private cameraState(): CameraState {
    return {
      position: toModel(this.camera.position.clone()),
      target: toModel(this.controls?.target.clone() ?? new THREE.Vector3()),
      projection: this.camera === this.perspective ? 'perspective' : 'orthographic',
    };
  }

  getCamera(): AdapterResult<CameraState> {
    return ok(this.cameraState());
  }

  setCamera(cam: CameraState): AdapterResult {
    if (cam.projection !== this.cameraState().projection) this.setProjection(cam.projection);
    this.startTween(toThree(cam.position), toThree(cam.target), false);
    return okVoid;
  }

  setProjection(projection: CameraState['projection']): AdapterResult {
    const next = projection === 'perspective' ? this.perspective : this.ortho;
    if (next === this.camera) return okVoid;
    const target = this.controls?.target.clone() ?? new THREE.Vector3();
    const dist = this.camera.position.distanceTo(target);
    next.position.copy(this.camera.position);
    next.quaternion.copy(this.camera.quaternion);
    if (next === this.ortho) {
      // Match the visible height of the perspective frustum at the target.
      const h = 2 * dist * Math.tan(THREE.MathUtils.degToRad(this.perspective.fov / 2));
      this.ortho.zoom = 1;
      this.orthoHalfHeight = h / 2;
    } else {
      const h = (this.orthoHalfHeight * 2) / this.ortho.zoom;
      const d = h / 2 / Math.tan(THREE.MathUtils.degToRad(this.perspective.fov / 2));
      const dir = this.camera.position.clone().sub(target).normalize();
      next.position.copy(target).addScaledVector(dir, d);
    }
    this.camera = next;
    if (this.controls) {
      this.controls.object = next;
      this.controls.target.copy(target);
      this.controls.update();
    }
    this.resize();
    this.requestRender();
    return okVoid;
  }

  setNavigationSettings(s: NavigationSettings): AdapterResult {
    this.nav = { ...s };
    if (this.controls) {
      this.controls.rotateSpeed = this.nav.rotateSpeed * 2.5;
    }
    return okVoid;
  }

  orbitBy(deltaAzimuth: number, deltaPolar: number, _animate = false): AdapterResult {
    if (!this.controls) return fail('not-loaded', 'Viewer is not mounted.');
    const offset = this.camera.position.clone().sub(this.controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta += deltaAzimuth;
    spherical.phi += deltaPolar;
    spherical.phi = Math.max(1e-4, Math.min(Math.PI - 1e-4, spherical.phi));
    spherical.makeSafe();
    offset.setFromSpherical(spherical);
    this.camera.position.copy(this.controls.target).add(offset);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
    this.requestRender();
    this.events.emit('cameraChange', this.cameraState());
    return okVoid;
  }

  private orthoHalfHeight = 20;

  setViewPreset(preset: ViewPreset, animate = true): AdapterResult {
    if (!this.modelBounds || isEmpty(this.modelBounds)) return fail('not-loaded', 'No model loaded.');
    const vis = this.visibleBounds() ?? this.modelBounds;
    const dir = toThree(PRESET_DIRS[preset]).normalize();
    this.frame(vis, dir, animate);
    return okVoid;
  }

  fitToView(ids?: readonly string[]): AdapterResult {
    if (!this.modelBounds) return fail('not-loaded', 'No model loaded.');
    let b: Bounds | null;
    if (ids && ids.length) {
      const els = ids.map((id) => this.entries.get(id)?.element).filter((e): e is JnnElement => !!e);
      if (!els.length) return fail('not-found', 'None of the requested elements exist.');
      b = boundsOf(els);
    } else b = this.visibleBounds();
    if (!b || isEmpty(b)) return fail('invalid-argument', 'Nothing visible to fit.');
    const dir = this.camera.position.clone().sub(this.controls?.target ?? new THREE.Vector3()).normalize();
    this.frame(b, dir, true);
    return okVoid;
  }

  private visibleBounds(): Bounds | null {
    const els = [...this.entries.values()].filter((e) => e.mesh.visible).map((e) => e.element);
    if (!els.length) return null;
    return boundsOf(els);
  }

  private frame(b: Bounds, dir: THREE.Vector3, animate: boolean) {
    const c = toThree(boundsCenter(b));
    const s = boundsSize(b);
    const radius = Math.max(0.5, 0.5 * Math.hypot(s[0], s[1], s[2]));
    const aspect = this.aspect();
    const fov = THREE.MathUtils.degToRad(this.perspective.fov);
    const fitH = radius / Math.sin(fov / 2);
    const fitW = radius / Math.sin(Math.atan(Math.tan(fov / 2) * aspect));
    const dist = Math.max(fitH, fitW) * 1.05;
    const pos = c.clone().addScaledVector(dir, dist);
    let zoom: [number, number] | undefined;
    if (this.camera === this.ortho) {
      const needHalfH = radius * 1.1 * Math.max(1, 1 / aspect);
      zoom = [this.ortho.zoom, this.orthoHalfHeight / needHalfH];
    }
    this.startTween(pos, c, animate, zoom);
  }

  private startTween(pos: THREE.Vector3, target: THREE.Vector3, animate: boolean, zoom?: [number, number]) {
    const ctrl = this.controls;
    if (!animate || !ctrl || this.options.manualRender) {
      this.camera.position.copy(pos);
      if (ctrl) ctrl.target.copy(target);
      if (zoom) this.ortho.zoom = zoom[1];
      this.camera.lookAt(target);
      this.updateProjection();
      ctrl?.update();
      this.requestRender();
      this.events.emit('cameraChange', this.cameraState());
      return;
    }
    this.tween = {
      from: [this.camera.position.clone(), ctrl.target.clone()],
      to: [pos, target],
      t0: performance.now(),
      ms: 420,
      zoom,
    };
  }

  private stepTween(now: number) {
    const tw = this.tween;
    if (!tw || !this.controls) return;
    const t = Math.min(1, (now - tw.t0) / tw.ms);
    const k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    this.camera.position.lerpVectors(tw.from[0], tw.to[0], k);
    this.controls.target.lerpVectors(tw.from[1], tw.to[1], k);
    if (tw.zoom) this.ortho.zoom = THREE.MathUtils.lerp(tw.zoom[0], tw.zoom[1], k);
    this.updateProjection();
    this.controls.update();
    this.requestRender();
    if (t >= 1) {
      this.tween = null;
      this.events.emit('cameraChange', this.cameraState());
    }
  }

  // ----------------------------------------------------------------- section
  setSection(spec: SectionSpec | null): AdapterResult {
    if (this.currentSection === spec) return okVoid;
    if (this.currentSection && spec && this.currentSection.kind === spec.kind) {
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
      this.modelRoot.remove(this.sectionHelper);
      this.sectionHelper.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        (m.material as THREE.Material | undefined)?.dispose?.();
      });
      this.sectionHelper = null;
    }
    if (!spec) {
      this.clipPlanes = [];
      this.refreshAll();
      return okVoid;
    }
    if (!this.modelBounds) return fail('not-loaded', 'No model loaded.');
    const axisIndex = (a: 'x' | 'y' | 'z') => (a === 'x' ? 0 : a === 'y' ? 1 : 2);
    const unit = (i: number, sign: number) => {
      const v = new THREE.Vector3();
      v.setComponent(i, sign);
      return v;
    };
    const modelPlanes: THREE.Plane[] = [];
    if (spec.kind === 'plane') {
      const i = axisIndex(spec.axis);
      // Plane keeps points where n·p + c >= 0.
      modelPlanes.push(
        spec.flipped ? new THREE.Plane(unit(i, 1), -spec.offset) : new THREE.Plane(unit(i, -1), spec.offset),
      );
    } else {
      for (let i = 0; i < 3; i++) {
        if (spec.min[i]! >= spec.max[i]!) return fail('invalid-argument', 'Section box min must be < max.');
        modelPlanes.push(new THREE.Plane(unit(i, 1), -spec.min[i]!), new THREE.Plane(unit(i, -1), spec.max[i]!));
      }
    }
    this.modelRoot.updateMatrixWorld(true);
    this.clipPlanes = modelPlanes.map((p) => p.clone().applyMatrix4(this.modelRoot.matrixWorld));
    this.sectionHelper = this.buildSectionHelper(spec, this.modelBounds);
    this.modelRoot.add(this.sectionHelper);
    this.refreshAll();
    return okVoid;
  }

  setSectionFrameVisible(visible: boolean): AdapterResult {
    if (this.sectionHelper) {
      this.sectionHelper.visible = visible;
      this.requestRender();
    }
    return okVoid;
  }

  private buildSectionHelper(spec: SectionSpec, b: Bounds): THREE.Object3D {
    const color = THEMES[this.theme].plane;
    const group = new THREE.Group();
    if (spec.kind === 'box') {
      const s = [spec.max[0] - spec.min[0], spec.max[1] - spec.min[1], spec.max[2] - spec.min[2]] as const;
      const box = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(s[0], s[1], s[2])),
        new THREE.LineBasicMaterial({ color }),
      );
      box.position.set((spec.min[0] + spec.max[0]) / 2, (spec.min[1] + spec.max[1]) / 2, (spec.min[2] + spec.max[2]) / 2);
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
      obj.position.set(spec.offset, c[1], c[2]);
      obj.rotation.set(0, Math.PI / 2, 0);
    } else if (spec.axis === 'y') {
      [w, h] = [s[0] + m * 2, s[2] + m * 2];
      obj.position.set(c[0], spec.offset, c[2]);
      obj.rotation.set(Math.PI / 2, 0, 0);
    } else {
      [w, h] = [s[0] + m * 2, s[1] + m * 2];
      obj.position.set(c[0], c[1], spec.offset);
    }
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }),
    );
    fill.raycast = () => {};
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, h)),
      new THREE.LineBasicMaterial({ color }),
    );
    obj.add(fill, outline);
    group.add(obj);
    return group;
  }

  /** True when a model-space point is removed by the active section. */
  isPointClipped(p: Vec3): boolean {
    const v = toThree(p);
    return this.clipPlanes.some((pl) => pl.distanceToPoint(v) < -1e-6);
  }

  // ----------------------------------------------------------------- picking
  private readonly raycaster = new THREE.Raycaster();

  pickAt(clientX: number, clientY: number): { elementId: string; point: Vec3 } | null {
    const el = this.renderer?.domElement;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const candidates = this.pickables.filter((m) => m.visible && !(this.xray && !this.selection.has(m.userData.elementId)));
    const hits = this.raycaster.intersectObjects(candidates, false);
    for (const h of hits) {
      if (this.clipPlanes.some((p) => p.distanceToPoint(h.point) < -1e-6)) continue;
      return { elementId: h.object.userData.elementId as string, point: toModel(h.point) };
    }
    return null;
  }

  projectToScreen(id: string): AdapterResult<{ x: number; y: number; onScreen: boolean }> {
    const e = this.entries.get(id);
    if (!e || !this.container) return fail('not-found', `Unknown element id: ${id}`);
    const v = toThree(boundsCenter(e.bounds)).project(this.camera);
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    return ok({
      x: ((v.x + 1) / 2) * w,
      y: ((1 - v.y) / 2) * h,
      onScreen: v.z > -1 && v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1,
    });
  }

  private onPointerDown = (ev: PointerEvent) => {
    if (ev.button !== 0) return;
    this.pointerDown = { x: ev.clientX, y: ev.clientY };
  };

  private onPointerUp = (ev: PointerEvent) => {
    const d = this.pointerDown;
    this.pointerDown = null;
    if (!d || ev.button !== 0) return;
    const moved = Math.hypot(ev.clientX - d.x, ev.clientY - d.y);
    // Distance alone separates a click from an orbit/pan drag; a time limit
    // would drop slow clicks on busy machines.
    if (moved > 5) return;
    const hit = this.pickAt(ev.clientX, ev.clientY);
    this.events.emit('pick', { result: hit, additive: ev.ctrlKey || ev.metaKey || ev.shiftKey });
  };

  private onPointerMove = (ev: PointerEvent) => {
    if (ev.buttons !== 0 || ev.pointerType === 'touch') return;
    const now = performance.now();
    if (now - this.lastHoverAt < 40) return;
    this.lastHoverAt = now;
    const id = this.pickAt(ev.clientX, ev.clientY)?.elementId ?? null;
    if (id !== this.hovered) {
      this.hovered = id;
      if (this.renderer) this.renderer.domElement.style.cursor = id ? 'pointer' : 'default';
      this.refreshAll();
      this.events.emit('hover', { elementId: id });
    }
  };

  private onPointerLeave = () => {
    if (this.hovered) {
      this.hovered = null;
      this.refreshAll();
      this.events.emit('hover', { elementId: null });
    }
  };

  // --------------------------------------------------------------- rendering
  private aspect() {
    const w = this.container?.clientWidth || 1;
    const h = this.container?.clientHeight || 1;
    return w / h;
  }

  private updateProjection() {
    const a = this.aspect();
    this.perspective.aspect = a;
    this.perspective.updateProjectionMatrix();
    const hh = this.orthoHalfHeight;
    this.ortho.left = -hh * a;
    this.ortho.right = hh * a;
    this.ortho.top = hh;
    this.ortho.bottom = -hh;
    this.ortho.updateProjectionMatrix();
  }

  private resize() {
    if (!this.container || !this.renderer) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, true);
    this.updateProjection();
    this.requestRender();
  }

  requestRender() {
    this.needsRender = true;
  }

  /** Render immediately (used by tests and when the rAF loop is disabled). */
  renderNow() {
    this.renderer?.render(this.scene, this.camera);
    this.needsRender = false;
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.tween) this.stepTween(performance.now());
    const changed = this.controls?.update() ?? false;
    if (changed || this.needsRender) this.renderNow();
  };

  // ------------------------------------------------------------ test support
  /** Introspection used by unit tests and the e2e debug hook. */
  debugState() {
    return {
      elementCount: this.entries.size,
      visibleCount: [...this.entries.values()].filter((e) => e.mesh.visible).length,
      selected: [...this.selection],
      clipPlaneCount: this.clipPlanes.length,
      projection: this.cameraState().projection,
      xray: this.xray,
      models: this.modelBounds ? [{ id: 'model', elementCount: this.entries.size, bounds: this.modelBounds }] : [],
    };
  }
}
