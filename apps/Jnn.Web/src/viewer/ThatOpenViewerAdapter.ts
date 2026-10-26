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
import * as WebIFC from 'web-ifc';
import type { FragmentsModel } from '@thatopen/fragments';
import { IDENTITY_TRANSFORM, type JnnElement, type JnnModel, type PropertySet } from '../domain/model';
import {
  mapIfcToJnnModel,
  parseItemPropertiesAndQuantities,
  parseSpatialStructure,
  type SpatialNode,
} from '../ifc/mapToJnn';
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
} from './ViewerAdapter';

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
  ]);

  private readonly events = new Emitter<ViewerEvents>();
  private components: OBC.Components | null = null;
  private world: (OBC.SimpleWorld<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBC.SimpleRenderer>) | null = null;
  private fragments: OBC.FragmentsManager | null = null;
  private ifcLoader: OBC.IfcLoader | null = null;
  private activeModel: FragmentsModel | null = null;
  private modelBounds: Bounds | null = null;
  private parsedModel: JnnModel | null = null;
  private propertiesCache = new Map<string, { element: JnnElement; propertySets: PropertySet[] }>();
  private disposed = false;
  private initializedPromise: Promise<void> | null = null;
  private currentProjection: CameraState['projection'] = 'perspective';
  private currentTheme: 'light' | 'dark' = 'dark';

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

    // Subtle ground grid
    const gridHelper = new THREE.GridHelper(50, 50, 0xf97316, 0x2d333b);
    gridHelper.position.y = -0.01;
    world.scene.three.add(gridHelper);

    // Setup local worker & wasm
    this.initializedPromise = this.initEngine();

    // Camera change event listener
    world.camera.controls.addEventListener('update', () => {
      if (this.disposed) return;
      const cam = this.getCamera();
      if (cam.ok) {
        this.events.emit('cameraChange', cam.value);
      }
    });
  }

  private async initEngine(): Promise<void> {
    if (!this.components || !this.world) return;
    const fragments = this.components.get(OBC.FragmentsManager);
    this.fragments = fragments;

    const workerUrl = new URL('./thatopen/worker.mjs', window.location.href).href;
    await fragments.init(workerUrl);

    this.world.camera.controls.addEventListener('update', () => {
      fragments.core.update();
    });

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
  }

  dispose(): void {
    this.disposed = true;
    if (this.fragments && this.world) {
      for (const [, model] of this.fragments.list) {
        this.world.scene.three.remove(model.object);
        model.dispose();
      }
      this.fragments.list.clear();
    }
    if (this.components) {
      this.components.dispose();
      this.components = null;
    }
    this.world = null;
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
  ): Promise<AdapterResult<{ elementCount: number; bounds: Bounds; model?: JnnModel }>> {
    if (this.disposed) return fail('failed', 'Adapter has been disposed.');
    if (this.initializedPromise) {
      await this.initializedPromise;
    }
    if (!this.ifcLoader || !this.fragments || !this.world) {
      return fail('not-loaded', 'Viewer engine is not initialized.');
    }

    try {
      // Clear old models
      for (const [, oldModel] of this.fragments.list) {
        this.world.scene.three.remove(oldModel.object);
        oldModel.dispose();
      }
      this.fragments.list.clear();

      const buffer = file instanceof Uint8Array ? file : new Uint8Array(file);

      const model = await this.ifcLoader.load(buffer, false, name, {
        processData: {
          progressCallback: (p: any) => {
            if (onProgress && p?.progress !== undefined) {
              onProgress(p.progress * 80, p.currentProcess);
            }
          },
        },
      });

      this.activeModel = model;
      this.world.scene.three.add(model.object);
      this.fragments.core.update(true);

      const bbox = model.box;
      if (bbox && !bbox.isEmpty()) {
        this.world.camera.controls.fitToBox(bbox, true);
        this.modelBounds = {
          min: [bbox.min.x, -bbox.max.z, bbox.min.y],
          max: [bbox.max.x, -bbox.min.z, bbox.max.y],
        };
      } else {
        this.modelBounds = { min: [-10, -10, 0], max: [10, 10, 10] };
      }

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
      const itemsBasicData = await model.getItemsData(elementLocalIds, { attributesDefault: true }).catch(() => []);

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

      this.parsedModel = jnnModel;
      this.propertiesCache.clear();
      onProgress?.(100, 'Hoàn tất nạp mô hình IFC.');

      return ok({
        elementCount: jnnModel.elements.length,
        bounds: this.modelBounds,
        model: jnnModel,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return fail('failed', `Failed to load IFC file "${name}": ${message}`);
    }
  }

  getModelBounds(): AdapterResult<Bounds> {
    return this.modelBounds ? ok(this.modelBounds) : fail('not-loaded', 'No IFC model loaded.');
  }

  renderNow(): void {
    if (this.world?.renderer && this.world?.scene && this.world?.camera) {
      this.world.renderer.three.render(this.world.scene.three, this.world.camera.three);
    }
  }

  fitToView(_ids?: readonly string[]): AdapterResult {
    if (!this.world || !this.activeModel) return fail('not-loaded', 'No active model to fit.');
    const bbox = this.activeModel.box;
    if (bbox && !bbox.isEmpty()) {
      this.world.camera.controls.fitToBox(bbox, true);
      return okVoid;
    }
    return fail('failed', 'Model has empty bounding box.');
  }

  setViewPreset(preset: ViewPreset): AdapterResult {
    if (!this.world) return fail('not-loaded', 'Viewer is not mounted.');
    const dirModel = PRESET_DIRS[preset];
    if (!dirModel) return fail('invalid-argument', `Unknown preset: ${preset}`);

    const targetThree = new THREE.Vector3();
    if (this.activeModel?.box && !this.activeModel.box.isEmpty()) {
      this.activeModel.box.getCenter(targetThree);
    } else {
      targetThree.set(0, 0, 0);
    }

    const dirThree = toThree(dirModel).normalize();
    let distance = 25;
    if (this.activeModel?.box && !this.activeModel.box.isEmpty()) {
      const size = new THREE.Vector3();
      this.activeModel.box.getSize(size);
      distance = Math.max(size.x, size.y, size.z) * 1.8;
    }

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

  setCamera(state: CameraState): AdapterResult {
    if (!this.world) return fail('not-loaded', 'Viewer is not mounted.');
    const pos = toThree(state.position);
    const target = toThree(state.target);
    this.world.camera.controls.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, false);
    if (state.projection !== this.currentProjection) {
      this.setProjection(state.projection);
    }
    return okVoid;
  }

  getCamera(): AdapterResult<CameraState> {
    if (!this.world) return fail('not-loaded', 'Viewer is not mounted.');
    const posThree = new THREE.Vector3();
    const targetThree = new THREE.Vector3();
    this.world.camera.controls.getPosition(posThree);
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
      this.world.camera.projection.set(target).catch((err) => {
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

  projectToScreen(_id: string): AdapterResult<{ x: number; y: number; onScreen: boolean }> {
    return fail('unsupported', 'projectToScreen not implemented for ThatOpenViewerAdapter.');
  }

  select(_ids: readonly string[]): AdapterResult {
    return fail('unsupported', 'Element selection will be available in T07.');
  }

  async getProperties(id: string): Promise<AdapterResult<{ element: JnnElement; propertySets: PropertySet[] }>> {
    if (this.propertiesCache.has(id)) {
      return ok(this.propertiesCache.get(id)!);
    }
    if (!this.activeModel) return fail('not-loaded', 'No active IFC model.');

    try {
      const parts = id.split(':');
      const localId = Number(parts[parts.length - 1]);
      if (isNaN(localId)) {
        return fail('invalid-argument', `Invalid element ID format: ${id}`);
      }

      const items = await (this.activeModel as any).getItemsData([localId], {
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
      const baseEl: JnnElement | undefined = this.parsedModel?.elements.find((e) => e.id === id);

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

  setHidden(_ids: readonly string[]): AdapterResult {
    return fail('unsupported', 'Hide element will be available in T07.');
  }

  isolate(_ids: readonly string[]): AdapterResult {
    return fail('unsupported', 'Isolate element will be available in T07.');
  }

  setSection(_spec: SectionSpec | null): AdapterResult {
    return fail('unsupported', 'Section clipper will be available in T08.');
  }

  highlight(_ids: readonly string[] | null, _color?: string): AdapterResult {
    return fail('unsupported', 'Element highlight will be available in T07.');
  }

  setXray(_enabled: boolean): AdapterResult {
    return fail('unsupported', 'X-ray mode will be available in T07.');
  }

  on<K extends keyof ViewerEvents>(event: K, handler: (payload: ViewerEvents[K]) => void): () => void {
    return this.events.on(event, handler);
  }
}
