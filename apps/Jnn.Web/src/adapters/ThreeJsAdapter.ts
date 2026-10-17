import * as THREE from 'three';
import { ViewerAdapter } from './ViewerAdapter';
import { BimModel, CameraPreset, BimElement } from '../types/bim';

export class ThreeJsAdapter implements ViewerAdapter {
  private container: HTMLElement | null = null;
  private scene: THREE.Scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private perspectiveCamera: THREE.PerspectiveCamera;
  private orthographicCamera: THREE.OrthographicCamera;
  private isOrthographic = false;
  private renderer: THREE.WebGLRenderer | null = null;
  private animationFrameId: number | null = null;

  // Orbit controls state
  private isOrbiting = false;
  private isPanning = false;
  private previousMousePosition = { x: 0, y: 0 };
  private cameraTarget = new THREE.Vector3(0, 5, 0);

  // Mesh registries
  private meshMap = new Map<string, THREE.Mesh>();
  private originalMaterials = new Map<string, THREE.Material | THREE.Material[]>();
  private elementDataMap = new Map<string, BimElement>();

  // State
  private annotationGroup: THREE.Group = new THREE.Group();
  private selectedElementId: string | null = null;
  private hoveredElementId: string | null = null;
  private ghostMode = false;
  private shadowsEnabled = false; // Default OFF for clear structural inspection (Revit/Navisworks standard)
  private dirLight1: THREE.DirectionalLight | null = null;
  private onSelectCb: ((id: string | null) => void) | null = null;
  private onHoverCb: ((id: string | null) => void) | null = null;
  private onFpsCb: ((fps: number) => void) | null = null;
  private onCameraChangeCbs: Array<(camera: THREE.Camera, target: THREE.Vector3) => void> = [];

  private notifyCameraChange(): void {
    for (const cb of this.onCameraChangeCbs) {
      cb(this.camera, this.cameraTarget);
    }
  }

  // FPS tracking
  private lastTime = performance.now();
  private frameCount = 0;

  // Section clipping planes
  private clipPlanes: {
    x: THREE.Plane;
    y: THREE.Plane;
    z: THREE.Plane;
  } = {
    x: new THREE.Plane(new THREE.Vector3(-1, 0, 0), 100),
    y: new THREE.Plane(new THREE.Vector3(0, -1, 0), 100),
    z: new THREE.Plane(new THREE.Vector3(0, 0, -1), 100),
  };
  private activeClippingPlanes: THREE.Plane[] = [];

  // Raycaster
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  constructor() {
    this.perspectiveCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    this.perspectiveCamera.position.set(24, 20, 28);
    this.perspectiveCamera.lookAt(this.cameraTarget);

    const aspect = 1;
    const frustumSize = 35;
    this.orthographicCamera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      1000
    );
    this.orthographicCamera.position.set(24, 20, 28);
    this.orthographicCamera.lookAt(this.cameraTarget);

    this.camera = this.perspectiveCamera;
  }

  init(container: HTMLElement): void {
    this.container = container;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.localClippingEnabled = true;
    this.renderer.shadowMap.enabled = this.shadowsEnabled;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // Setup Lighting
    this.setupLighting();

    // Setup Ground Grid & Coordinate Axes
    this.setupGroundGrid();

    // Event listeners
    this.bindEvents();

    // Update camera aspect
    this.updateCameraAspect(width, height);

    // Start render loop
    this.animate();
  }

  private setupLighting(): void {
    this.scene.clear();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x475569, 0.45);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight1.position.set(30, 45, 25);
    dirLight1.castShadow = this.shadowsEnabled;
    dirLight1.shadow.mapSize.width = 2048;
    dirLight1.shadow.mapSize.height = 2048;
    dirLight1.shadow.camera.near = 0.5;
    dirLight1.shadow.camera.far = 150;
    const d = 25;
    dirLight1.shadow.camera.left = -d;
    dirLight1.shadow.camera.right = d;
    dirLight1.shadow.camera.top = d;
    dirLight1.shadow.camera.bottom = -d;
    dirLight1.shadow.bias = -0.0005;
    this.scene.add(dirLight1);
    this.dirLight1 = dirLight1;

    const dirLight2 = new THREE.DirectionalLight(0xcfd8dc, 0.45);
    dirLight2.position.set(-25, 20, -30);
    this.scene.add(dirLight2);
    this.scene.add(this.annotationGroup);
  }

  private setupGroundGrid(): void {
    const grid = new THREE.GridHelper(50, 25, 0x0891b2, 0x1e293b);
    grid.position.y = -3.65;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.35;
    this.scene.add(grid);
  }

  private updateCameraAspect(width: number, height: number): void {
    const aspect = width / height;
    this.perspectiveCamera.aspect = aspect;
    this.perspectiveCamera.updateProjectionMatrix();

    const frustumSize = 35;
    this.orthographicCamera.left = (-frustumSize * aspect) / 2;
    this.orthographicCamera.right = (frustumSize * aspect) / 2;
    this.orthographicCamera.top = frustumSize / 2;
    this.orthographicCamera.bottom = -frustumSize / 2;
    this.orthographicCamera.updateProjectionMatrix();
  }

  private bindEvents(): void {
    if (!this.container) return;

    window.addEventListener('resize', this.onWindowResize);

    const el = this.renderer?.domElement;
    if (!el) return;

    el.addEventListener('mousedown', this.onMouseDown);
    el.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('click', this.onClick);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onWindowResize = () => {
    if (!this.container || !this.renderer) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.renderer.setSize(width, height);
    this.updateCameraAspect(width, height);
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) { // Left click = Orbit
      this.isOrbiting = true;
    } else if (e.button === 2 || (e.button === 1)) { // Right click or middle click = Pan
      this.isPanning = true;
    }
    this.previousMousePosition = { x: e.clientX, y: e.clientY };
  };

  private onMouseMove = (e: MouseEvent) => {
    const deltaX = e.clientX - this.previousMousePosition.x;
    const deltaY = e.clientY - this.previousMousePosition.y;

    if (this.isOrbiting) {
      const rotateSpeed = 0.005;
      const offset = new THREE.Vector3().subVectors(this.camera.position, this.cameraTarget);

      // Spherical orbit
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta -= deltaX * rotateSpeed;
      spherical.phi = Math.max(0.05, Math.min(Math.PI - 0.05, spherical.phi - deltaY * rotateSpeed));

      offset.setFromSpherical(spherical);
      this.camera.position.copy(this.cameraTarget).add(offset);
      this.camera.lookAt(this.cameraTarget);
      this.notifyCameraChange();
    } else if (this.isPanning) {
      const panSpeed = 0.025;
      const right = new THREE.Vector3();
      const up = new THREE.Vector3();

      this.camera.matrix.extractBasis(right, up, new THREE.Vector3());

      const move = right.multiplyScalar(-deltaX * panSpeed).add(up.multiplyScalar(deltaY * panSpeed));
      this.camera.position.add(move);
      this.cameraTarget.add(move);
      this.camera.lookAt(this.cameraTarget);
      this.notifyCameraChange();
    } else {
      // Raycasting for hover detection
      this.handleHoverRaycast(e);
    }

    this.previousMousePosition = { x: e.clientX, y: e.clientY };
  };

  private onMouseUp = () => {
    this.isOrbiting = false;
    this.isPanning = false;
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY * 0.03;
    const dir = new THREE.Vector3().subVectors(this.camera.position, this.cameraTarget).normalize();
    const dist = this.camera.position.distanceTo(this.cameraTarget);

    const newDist = Math.max(3, Math.min(150, dist + zoomFactor));
    this.camera.position.copy(this.cameraTarget).add(dir.multiplyScalar(newDist));
    this.camera.lookAt(this.cameraTarget);
    this.notifyCameraChange();
  };

  private onClick = (e: MouseEvent) => {
    if (!this.container) return;
    const rect = this.container.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = Array.from(this.meshMap.values()).filter(m => m.visible);
    const intersects = this.raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object as THREE.Mesh;
      const elementId = hitMesh.userData.elementId;
      this.selectElement(elementId);
    } else {
      this.selectElement(null);
    }
  };

  private handleHoverRaycast(e: MouseEvent) {
    if (!this.container) return;
    const rect = this.container.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = Array.from(this.meshMap.values()).filter(m => m.visible);
    const intersects = this.raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object as THREE.Mesh;
      const elementId = hitMesh.userData.elementId;
      if (this.hoveredElementId !== elementId) {
        this.hoveredElementId = elementId;
        this.container.style.cursor = 'pointer';
        if (this.onHoverCb) this.onHoverCb(elementId);
      }
    } else {
      if (this.hoveredElementId !== null) {
        this.hoveredElementId = null;
        this.container.style.cursor = 'default';
        if (this.onHoverCb) this.onHoverCb(null);
      }
    }
  }

  async loadModel(model: BimModel): Promise<void> {
    // Clear existing meshes
    for (const mesh of this.meshMap.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => m.dispose());
      } else {
        mesh.material.dispose();
      }
    }
    this.meshMap.clear();
    this.originalMaterials.clear();
    this.elementDataMap.clear();

    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const cylinderGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);

    for (const element of model.elements) {
      this.elementDataMap.set(element.id, element);

      let geo: THREE.BufferGeometry;
      if (element.meshType === 'cylinder') {
        geo = cylinderGeo.clone();
      } else {
        geo = boxGeo.clone();
      }

      // Material based on category
      const color = element.color || '#64748b';
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: 0.65,
        metalness: 0.15,
        clippingPlanes: this.activeClippingPlanes,
        clipShadows: true,
      });

      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set(...element.transform.position);
      if (element.transform.rotation) {
        mesh.rotation.set(...element.transform.rotation);
      }
      mesh.scale.set(...element.transform.scale);
      mesh.castShadow = this.shadowsEnabled;
      mesh.receiveShadow = this.shadowsEnabled;
      mesh.userData = { elementId: element.id };

      // Subtle architectural edge lines (signature Revit linework)
      if (element.meshType !== 'cylinder') {
        const edgeGeo = new THREE.EdgesGeometry(geo);
        const edgeMat = new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.5 });
        const edgeLine = new THREE.LineSegments(edgeGeo, edgeMat);
        mesh.add(edgeLine);
      }

      this.scene.add(mesh);
      this.meshMap.set(element.id, mesh);
      this.originalMaterials.set(element.id, material);
    }

    // Build Revit Section Box & Level Datums matching Image 1
    this.setupRevitAnnotations(model);

    this.fitToView();
  }

  private createTextSprite(text: string, isBubble = false): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 256, 128);

    if (isBubble) {
      // Circular Grid Bubble Head (red border, white background, black text)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(128, 64, 46, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 6;
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 44px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 128, 64);
    } else {
      // Revit Level Target Marker (blue circle + elevation label)
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(32, 64, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#0284c7';
      ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 64, 64);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(isBubble ? 1.6 : 3.4, isBubble ? 0.8 : 1.7, 1);
    return sprite;
  }

  private setupRevitAnnotations(model: BimModel): void {
    while (this.annotationGroup.children.length > 0) {
      const obj = this.annotationGroup.children[0];
      this.annotationGroup.remove(obj);
      if ((obj as any).geometry) (obj as any).geometry.dispose();
    }

    // Add Revit Section Box & Annotations for structural models
    if (model.elements.length < 50) return;

    // 1. Revit 3D Section Box (Green Dashed Bounding Box matching Image 1)
    const boxSize = new THREE.Vector3(26.4, 28.2, 14.8);
    const boxCenter = new THREE.Vector3(0, 9.6, 0);

    const boxGeo = new THREE.BoxGeometry(boxSize.x, boxSize.y, boxSize.z);
    const edges = new THREE.EdgesGeometry(boxGeo);
    const lineMat = new THREE.LineDashedMaterial({
      color: 0x16a34a, // Signature Revit green
      dashSize: 0.8,
      gapSize: 0.4,
    });
    const sectionBoxLine = new THREE.LineSegments(edges, lineMat);
    sectionBoxLine.computeLineDistances();
    sectionBoxLine.position.copy(boxCenter);
    this.annotationGroup.add(sectionBoxLine);

    // 2. Revit Level Datums (Horizontal dashed lines on the left with blue target circles)
    const levels = [
      { name: 'MAI', elev: '+22.300', y: 22.3 },
      { name: 'T7', elev: '+19.000', y: 19.0 },
      { name: 'T6', elev: '+15.700', y: 15.7 },
      { name: 'T5', elev: '+12.400', y: 12.4 },
      { name: 'T4', elev: '+9.100', y: 9.1 },
      { name: 'T3', elev: '+5.800', y: 5.8 },
      { name: 'T2', elev: '+2.900', y: 2.9 },
      { name: 'T1', elev: '+0.000', y: 0.0 },
      { name: 'HẦM', elev: '-2.900', y: -2.9 },
      { name: 'Base', elev: '-3.600', y: -3.6 }
    ];

    levels.forEach(lvl => {
      const pts = [
        new THREE.Vector3(-18.0, lvl.y, 7.5),
        new THREE.Vector3(13.5, lvl.y, 7.5)
      ];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const levelLineMat = new THREE.LineDashedMaterial({
        color: 0x334155,
        dashSize: 0.6,
        gapSize: 0.3
      });
      const levelLine = new THREE.Line(lineGeo, levelLineMat);
      levelLine.computeLineDistances();
      this.annotationGroup.add(levelLine);

      const sprite = this.createTextSprite(`${lvl.name} ${lvl.elev}`);
      sprite.position.set(-19.8, lvl.y, 7.5);
      this.annotationGroup.add(sprite);
    });

    // 3. Revit Grid Bubbles along X (1 -> 7) and Y (A, B, C) on ground plane
    const gridX = [-11.4, -7.6, -3.8, 0.0, 3.8, 7.6, 11.4];
    const gridXLabels = ['1', '2', '3', '4', '5', '6', '7'];

    gridX.forEach((x, i) => {
      const pts = [
        new THREE.Vector3(x, -3.6, -7.5),
        new THREE.Vector3(x, -3.6, 8.5)
      ];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const lMat = new THREE.LineDashedMaterial({ color: 0x64748b, dashSize: 0.6, gapSize: 0.3 });
      const gridL = new THREE.Line(lineGeo, lMat);
      gridL.computeLineDistances();
      this.annotationGroup.add(gridL);

      const bubble = this.createTextSprite(gridXLabels[i], true);
      bubble.position.set(x, -3.6, 9.3);
      this.annotationGroup.add(bubble);
    });

    const gridY = [-5.5, 0.0, 5.5];
    const gridYLabels = ['A', 'B', 'C'];

    gridY.forEach((y, i) => {
      const pts = [
        new THREE.Vector3(-14.0, -3.6, y),
        new THREE.Vector3(14.5, -3.6, y)
      ];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const lMat = new THREE.LineDashedMaterial({ color: 0x64748b, dashSize: 0.6, gapSize: 0.3 });
      const gridL = new THREE.Line(lineGeo, lMat);
      gridL.computeLineDistances();
      this.annotationGroup.add(gridL);

      const bubble = this.createTextSprite(gridYLabels[i], true);
      bubble.position.set(15.3, -3.6, y);
      this.annotationGroup.add(bubble);
    });
  }

  selectElement(id: string | null): void {
    // Revert previous selection
    if (this.selectedElementId && this.meshMap.has(this.selectedElementId)) {
      const prevMesh = this.meshMap.get(this.selectedElementId)!;
      const origMat = this.originalMaterials.get(this.selectedElementId);
      if (origMat) prevMesh.material = origMat;
    }

    this.selectedElementId = id;

    if (id && this.meshMap.has(id)) {
      const selectedMesh = this.meshMap.get(id)!;
      // High-contrast cyan emissive highlight for selected element
      const highlightMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#06b6d4'),
        emissive: new THREE.Color('#0891b2'),
        emissiveIntensity: 0.45,
        roughness: 0.3,
        metalness: 0.3,
        clippingPlanes: this.activeClippingPlanes,
      });
      selectedMesh.material = highlightMat;
    }

    if (this.onSelectCb) {
      this.onSelectCb(id);
    }
  }

  hoverElement(id: string | null): void {
    this.hoveredElementId = id;
  }

  isolateElements(ids: string[]): void {
    const idSet = new Set(ids);
    for (const [id, mesh] of this.meshMap.entries()) {
      mesh.visible = idSet.has(id);
    }
  }

  hideElements(ids: string[]): void {
    const idSet = new Set(ids);
    for (const [id, mesh] of this.meshMap.entries()) {
      if (idSet.has(id)) {
        mesh.visible = false;
      }
    }
  }

  showAll(): void {
    for (const mesh of this.meshMap.values()) {
      mesh.visible = true;
    }
    this.clearClashHighlight();
  }

  fitToView(ids?: string[]): void {
    const box = new THREE.Box3();
    let hasTarget = false;

    if (ids && ids.length > 0) {
      ids.forEach(id => {
        const mesh = this.meshMap.get(id);
        if (mesh && mesh.visible) {
          box.expandByObject(mesh);
          hasTarget = true;
        }
      });
    } else {
      for (const mesh of this.meshMap.values()) {
        if (mesh.visible) {
          box.expandByObject(mesh);
          hasTarget = true;
        }
      }
    }

    if (!hasTarget) return;

    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z, 5);
    const fov = (this.perspectiveCamera.fov * Math.PI) / 180;
    const cameraDistance = (maxDim / 2) / Math.tan(fov / 2) * 1.5;

    this.cameraTarget.copy(center);
    this.camera.position.set(center.x + cameraDistance * 0.7, center.y + cameraDistance * 0.6, center.z + cameraDistance * 0.9);
    this.camera.lookAt(this.cameraTarget);
    this.notifyCameraChange();
  }

  setCameraPreset(preset: CameraPreset): void {
    const dist = 35;
    const target = this.cameraTarget;

    switch (preset) {
      case 'Top':
        this.camera.position.set(target.x, target.y + dist, target.z + 0.0001);
        break;
      case 'Bottom':
        this.camera.position.set(target.x, target.y - dist, target.z + 0.0001);
        break;
      case 'Front':
        this.camera.position.set(target.x, target.y + 3, target.z + dist);
        break;
      case 'Back':
        this.camera.position.set(target.x, target.y + 3, target.z - dist);
        break;
      case 'Left':
        this.camera.position.set(target.x - dist, target.y + 3, target.z);
        break;
      case 'Right':
        this.camera.position.set(target.x + dist, target.y + 3, target.z);
        break;
      case 'Isometric':
      default:
        this.camera.position.set(target.x + 24, target.y + 20, target.z + 28);
        break;
    }

    this.camera.lookAt(target);
    this.notifyCameraChange();
  }

  setCameraProjection(projection: 'Perspective' | 'Orthographic'): void {
    if (projection === 'Orthographic') {
      this.isOrthographic = true;
      this.orthographicCamera.position.copy(this.camera.position);
      this.orthographicCamera.lookAt(this.cameraTarget);
      this.camera = this.orthographicCamera;
    } else {
      this.isOrthographic = false;
      this.perspectiveCamera.position.copy(this.camera.position);
      this.perspectiveCamera.lookAt(this.cameraTarget);
      this.camera = this.perspectiveCamera;
    }
  }

  setSectionPlane(axis: 'x' | 'y' | 'z', enabled: boolean, offset: number, flipped: boolean): void {
    const normal = new THREE.Vector3();
    if (axis === 'x') normal.set(flipped ? 1 : -1, 0, 0);
    if (axis === 'y') normal.set(0, flipped ? 1 : -1, 0);
    if (axis === 'z') normal.set(0, 0, flipped ? 1 : -1);

    const constant = flipped ? -offset : offset;
    this.clipPlanes[axis].set(normal, constant);

    this.updateActiveClippingPlanes(enabled ? axis : null);
  }

  private updateActiveClippingPlanes(activeAxis: 'x' | 'y' | 'z' | null): void {
    this.activeClippingPlanes = [];
    if (activeAxis) {
      this.activeClippingPlanes.push(this.clipPlanes[activeAxis]);
    }

    for (const mesh of this.meshMap.values()) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => { m.clippingPlanes = this.activeClippingPlanes; });
      } else {
        mesh.material.clippingPlanes = this.activeClippingPlanes;
      }
    }
  }

  setSectionBox(enabled: boolean, min?: [number, number, number], max?: [number, number, number]): void {
    if (!enabled || !min || !max) {
      this.activeClippingPlanes = [];
    } else {
      // 6 clipping planes for the box
      this.activeClippingPlanes = [
        new THREE.Plane(new THREE.Vector3(1, 0, 0), -min[0]),
        new THREE.Plane(new THREE.Vector3(-1, 0, 0), max[0]),
        new THREE.Plane(new THREE.Vector3(0, 1, 0), -min[1]),
        new THREE.Plane(new THREE.Vector3(0, -1, 0), max[1]),
        new THREE.Plane(new THREE.Vector3(0, 0, 1), -min[2]),
        new THREE.Plane(new THREE.Vector3(0, 0, -1), max[2]),
      ];
    }

    for (const mesh of this.meshMap.values()) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => { m.clippingPlanes = this.activeClippingPlanes; });
      } else {
        mesh.material.clippingPlanes = this.activeClippingPlanes;
      }
    }
  }

  highlightClashPair(idA: string, idB: string, focusPoint?: [number, number, number]): void {
    const meshA = this.meshMap.get(idA);
    const meshB = this.meshMap.get(idB);

    // Ghost all other meshes
    for (const [id, mesh] of this.meshMap.entries()) {
      if (id === idA || id === idB) {
        mesh.visible = true;
      } else {
        // Ghost mode: high transparency
        const ghostMat = new THREE.MeshStandardMaterial({
          color: 0x94a3b8,
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
          clippingPlanes: this.activeClippingPlanes,
        });
        mesh.material = ghostMat;
      }
    }

    // Item A in distinct Red (#EF4444) with emissive glow
    if (meshA) {
      meshA.material = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#ef4444'),
        emissive: new THREE.Color('#b91c1c'),
        emissiveIntensity: 0.6,
        roughness: 0.3,
        clippingPlanes: this.activeClippingPlanes,
      });
    }

    // Item B in distinct Cyan/Teal (#06B6D4) with emissive glow
    if (meshB) {
      meshB.material = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#06b6d4'),
        emissive: new THREE.Color('#0e7490'),
        emissiveIntensity: 0.6,
        roughness: 0.3,
        clippingPlanes: this.activeClippingPlanes,
      });
    }

    // Smoothly focus camera on clash point
    if (focusPoint) {
      const pt = new THREE.Vector3(...focusPoint);
      this.cameraTarget.copy(pt);
      this.camera.position.set(pt.x + 5, pt.y + 4, pt.z + 6);
      this.camera.lookAt(pt);
    } else if (meshA && meshB) {
      const box = new THREE.Box3().expandByObject(meshA).expandByObject(meshB);
      const center = new THREE.Vector3();
      box.getCenter(center);
      this.cameraTarget.copy(center);
      this.camera.position.set(center.x + 6, center.y + 4, center.z + 7);
      this.camera.lookAt(center);
    }
  }

  clearClashHighlight(): void {
    for (const [id, mesh] of this.meshMap.entries()) {
      const orig = this.originalMaterials.get(id);
      if (orig) mesh.material = orig;
      mesh.visible = true;
    }
  }

  setGhostMode(enabled: boolean): void {
    this.ghostMode = enabled;
    for (const [id, mesh] of this.meshMap.entries()) {
      if (enabled) {
        mesh.material = new THREE.MeshStandardMaterial({
          color: 0x64748b,
          transparent: true,
          opacity: 0.3,
          wireframe: true,
        });
      } else {
        const orig = this.originalMaterials.get(id);
        if (orig) mesh.material = orig;
      }
    }
  }

  setBackgroundColor(colorHex: string): void {
    if (this.renderer) {
      this.renderer.setClearColor(new THREE.Color(colorHex), 1);
    }
  }

  captureScreenshot(): string {
    if (!this.renderer) return '';
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  onElementSelected(callback: (id: string | null) => void): void {
    this.onSelectCb = callback;
  }

  onElementHovered(callback: (id: string | null) => void): void {
    this.onHoverCb = callback;
  }

  onFpsUpdate(callback: (fps: number) => void): void {
    this.onFpsCb = callback;
  }

  onCameraChange(callback: (camera: THREE.Camera, target: THREE.Vector3) => void): () => void {
    this.onCameraChangeCbs.push(callback);
    callback(this.camera, this.cameraTarget);
    return () => {
      this.onCameraChangeCbs = this.onCameraChangeCbs.filter(cb => cb !== callback);
    };
  }

  orbitCamera(deltaX: number, deltaY: number): void {
    const rotateSpeed = 0.006;
    const offset = new THREE.Vector3().subVectors(this.camera.position, this.cameraTarget);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta -= deltaX * rotateSpeed;
    spherical.phi = Math.max(0.05, Math.min(Math.PI - 0.05, spherical.phi - deltaY * rotateSpeed));
    offset.setFromSpherical(spherical);
    this.camera.position.copy(this.cameraTarget).add(offset);
    this.camera.lookAt(this.cameraTarget);
    this.notifyCameraChange();
  }

  private animate = () => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    if (this.renderer) {
      this.renderer.render(this.scene, this.camera);
    }

    // Calculate real FPS
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastTime >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / (now - this.lastTime));
      if (this.onFpsCb) this.onFpsCb(fps);
      this.frameCount = 0;
      this.lastTime = now;
    }
  };

  setShadows(enabled: boolean): void {
    this.shadowsEnabled = enabled;
    if (this.renderer) {
      this.renderer.shadowMap.enabled = enabled;
    }
    if (this.dirLight1) {
      this.dirLight1.castShadow = enabled;
    }
    for (const mesh of this.meshMap.values()) {
      mesh.castShadow = enabled;
      mesh.receiveShadow = enabled;
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => (m.needsUpdate = true));
        } else {
          mesh.material.needsUpdate = true;
        }
      }
    }
  }

  isShadowsEnabled(): boolean {
    return this.shadowsEnabled;
  }

  setAnnotationsVisibility(enabled: boolean): void {
    this.annotationGroup.visible = enabled;
  }

  isAnnotationsVisible(): boolean {
    return this.annotationGroup.visible;
  }

  dispose(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('mouseup', this.onMouseUp);

    if (this.renderer && this.renderer.domElement) {
      const el = this.renderer.domElement;
      el.removeEventListener('mousedown', this.onMouseDown);
      el.removeEventListener('mousemove', this.onMouseMove);
      el.removeEventListener('wheel', this.onWheel);
      el.removeEventListener('click', this.onClick);

      if (el.parentElement) {
        el.parentElement.removeChild(el);
      }
      this.renderer.dispose();
    }
  }
}
