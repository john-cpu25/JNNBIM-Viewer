import * as THREE from 'three';
import type { Bounds, SectionAxis, Vec3 } from './ViewerAdapter';
import { worldUnitsPerPixel } from './navigation';

export type HandleId = `${'x' | 'y' | 'z'}-${'min' | 'max'}` | 'plane';

const AXIS_COLORS: Record<'x' | 'y' | 'z', number> = {
  x: 0xe03131, // Red
  y: 0x2f9e44, // Green
  z: 0x1971c2, // Blue
};

const HOVER_COLOR = 0xfab005; // Yellow

// Model space -> Three.js space unit directions
const AXIS_DIR_THREE: Record<'x' | 'y' | 'z', Record<'min' | 'max', THREE.Vector3>> = {
  x: {
    min: new THREE.Vector3(-1, 0, 0),
    max: new THREE.Vector3(1, 0, 0),
  },
  y: {
    min: new THREE.Vector3(0, 0, 1), // Model -Y is Three +Z
    max: new THREE.Vector3(0, 0, -1), // Model +Y is Three -Z
  },
  z: {
    min: new THREE.Vector3(0, -1, 0), // Model -Z is Three -Y
    max: new THREE.Vector3(0, 1, 0), // Model +Z is Three +Y
  },
};

const toThree = (p: Vec3): THREE.Vector3 => new THREE.Vector3(p[0], p[2], -p[1]);

interface HandleObject {
  id: HandleId;
  group: THREE.Group;
  materials: THREE.MeshBasicMaterial[];
  hitProxy: THREE.Mesh;
  baseColor: number;
}

export class SectionGizmo {
  readonly group = new THREE.Group();
  private handles = new Map<HandleId, HandleObject>();
  private activeHoverId: HandleId | null = null;
  private raycaster = new THREE.Raycaster();

  constructor() {
    this.group.renderOrder = 1000;
    this.createBoxHandles();
    this.createPlaneHandle();
    this.hideAll();
  }

  get visible(): boolean {
    return this.group.visible;
  }

  set visible(v: boolean) {
    this.group.visible = v;
  }

  private createHandleMesh(baseColor: number, isDouble = false): {
    group: THREE.Group;
    materials: THREE.MeshBasicMaterial[];
    hitProxy: THREE.Mesh;
  } {
    const handleGroup = new THREE.Group();
    const materials: THREE.MeshBasicMaterial[] = [];

    const mat = new THREE.MeshBasicMaterial({
      color: baseColor,
      depthTest: false,
      transparent: true,
      opacity: 0.95,
    });
    materials.push(mat);

    // Primary Arrow Cone (height 1, radius 0.35)
    const coneGeom = new THREE.ConeGeometry(0.35, 1, 16);
    coneGeom.translate(0, 0.5, 0); // Base at 0, apex at 1
    const coneMesh = new THREE.Mesh(coneGeom, mat);
    handleGroup.add(coneMesh);

    // Collar Box at base
    const collarGeom = new THREE.BoxGeometry(0.5, 0.08, 0.5);
    collarGeom.translate(0, 0.04, 0);
    const collarMesh = new THREE.Mesh(collarGeom, mat);
    handleGroup.add(collarMesh);

    if (isDouble) {
      // Second arrow pointing opposite direction
      const cone2Geom = new THREE.ConeGeometry(0.35, 1, 16);
      cone2Geom.rotateX(Math.PI);
      cone2Geom.translate(0, -0.5, 0);
      const cone2Mesh = new THREE.Mesh(cone2Geom, mat);
      handleGroup.add(cone2Mesh);
    }

    // Invisible hit proxy sphere (larger radius for easy clicking & dragging)
    const hitProxyGeom = new THREE.SphereGeometry(0.9, 8, 8);
    const hitProxyMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const hitProxy = new THREE.Mesh(hitProxyGeom, hitProxyMat);
    handleGroup.add(hitProxy);

    return { group: handleGroup, materials, hitProxy };
  }

  private createBoxHandles() {
    const axes: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z'];
    const sides: Array<'min' | 'max'> = ['min', 'max'];

    for (const axis of axes) {
      for (const side of sides) {
        const id: HandleId = `${axis}-${side}`;
        const color = AXIS_COLORS[axis];
        const { group, materials, hitProxy } = this.createHandleMesh(color, false);

        // Orient handle along its direction
        const dir = AXIS_DIR_THREE[axis][side];
        group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

        this.group.add(group);
        this.handles.set(id, { id, group, materials, hitProxy, baseColor: color });
      }
    }
  }

  private createPlaneHandle() {
    const { group, materials, hitProxy } = this.createHandleMesh(AXIS_COLORS.z, true);
    this.group.add(group);
    this.handles.set('plane', { id: 'plane', group, materials, hitProxy, baseColor: AXIS_COLORS.z });
  }

  private hideAll() {
    for (const h of this.handles.values()) {
      h.group.visible = false;
    }
  }

  setBox(min: Vec3, max: Vec3): void {
    this.hideAll();

    const midX = (min[0] + max[0]) / 2;
    const midY = (min[1] + max[1]) / 2;
    const midZ = (min[2] + max[2]) / 2;

    const positions: Record<HandleId, Vec3> = {
      'x-min': [min[0], midY, midZ],
      'x-max': [max[0], midY, midZ],
      'y-min': [midX, min[1], midZ],
      'y-max': [midX, max[1], midZ],
      'z-min': [midX, midY, min[2]],
      'z-max': [midX, midY, max[2]],
      plane: [0, 0, 0],
    };

    for (const [id, posModel] of Object.entries(positions)) {
      if (id === 'plane') continue;
      const h = this.handles.get(id as HandleId);
      if (h) {
        h.group.position.copy(toThree(posModel));
        h.group.visible = true;
      }
    }
  }

  setPlane(axis: SectionAxis, offset: number, _flipped: boolean, bounds: Bounds): void {
    this.hideAll();

    const h = this.handles.get('plane');
    if (!h) return;

    const midX = (bounds.min[0] + bounds.max[0]) / 2;
    const midY = (bounds.min[1] + bounds.max[1]) / 2;
    const midZ = (bounds.min[2] + bounds.max[2]) / 2;

    const posModel: Vec3 =
      axis === 'x' ? [offset, midY, midZ] : axis === 'y' ? [midX, offset, midZ] : [midX, midY, offset];

    h.group.position.copy(toThree(posModel));

    // Direction along normal
    const dir = AXIS_DIR_THREE[axis].max;
    h.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

    // Update color to match active plane axis
    const color = AXIS_COLORS[axis];
    h.baseColor = color;
    h.materials.forEach((m) => m.color.setHex(color));

    h.group.visible = true;
  }

  hitTest(ndc: THREE.Vector2, camera: THREE.Camera): HandleId | null {
    if (!this.group.visible) return null;
    this.raycaster.setFromCamera(ndc, camera);

    const hitObjects: THREE.Object3D[] = [];
    const objToId = new Map<THREE.Object3D, HandleId>();

    for (const h of this.handles.values()) {
      if (h.group.visible) {
        hitObjects.push(h.hitProxy);
        objToId.set(h.hitProxy, h.id);
      }
    }

    const intersects = this.raycaster.intersectObjects(hitObjects, false);
    if (intersects.length > 0 && intersects[0]) {
      return objToId.get(intersects[0].object) ?? null;
    }
    return null;
  }

  setHover(id: HandleId | null): void {
    if (this.activeHoverId === id) return;
    this.activeHoverId = id;

    for (const h of this.handles.values()) {
      const isTarget = h.id === id;
      const color = isTarget ? HOVER_COLOR : h.baseColor;
      h.materials.forEach((m) => m.color.setHex(color));
    }
  }

  setActive(id: HandleId | null): void {
    this.setHover(id);
  }

  updateScale(camera: THREE.Camera, viewportHeightPx: number): void {
    if (!this.group.visible) return;

    for (const h of this.handles.values()) {
      if (h.group.visible) {
        const dist = camera.position.distanceTo(h.group.position);
        const wupp = worldUnitsPerPixel(camera, dist, viewportHeightPx);
        const s = Math.max(1e-4, wupp * 28);
        h.group.scale.set(s, s, s);
      }
    }
  }

  dispose(): void {
    for (const h of this.handles.values()) {
      h.group.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) {
          (obj as THREE.Mesh).geometry.dispose();
        }
      });
      h.materials.forEach((m) => m.dispose());
    }
    this.handles.clear();
  }
}
