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

  // Orbit controls & mouse interaction state
  private navigationMode: 'select' | 'orbit' | 'pan' = 'select';
  private isOrbiting = false;
  private isPanning = false;
  private hasDragged = false;
  private mouseDownPosition = { x: 0, y: 0 };
  private previousMousePosition = { x: 0, y: 0 };
  private hoverRafId: number | null = null;
  private cameraTarget = new THREE.Vector3(0, 5, 0);

  // Mesh registries
  private meshMap = new Map<string, THREE.Mesh>();
  private originalMaterials = new Map<string, THREE.Material | THREE.Material[]>();
  private elementDataMap = new Map<string, BimElement>();

  // Shared reusable materials (prevents WebGL material leaks)
  private selectionMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#06b6d4'),
    emissive: new THREE.Color('#0891b2'),
    emissiveIntensity: 0.45,
    roughness: 0.3,
    metalness: 0.3,
  });
  private clashMaterialA = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ef4444'),
    emissive: new THREE.Color('#b91c1c'),
    emissiveIntensity: 0.6,
    roughness: 0.3,
  });
  private clashMaterialB = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#06b6d4'),
    emissive: new THREE.Color('#0e7490'),
    emissiveIntensity: 0.6,
    roughness: 0.3,
  });
  private clashGhostMaterial = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  });
  private wireframeGhostMaterial = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    transparent: true,
    opacity: 0.3,
    wireframe: true,
  });

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

  private groundGrid: THREE.GridHelper | null = null;

  private setupGroundGrid(): void {
    const grid = new THREE.GridHelper(90, 45, 0x0891b2, 0x1e293b);
    grid.position.y = -3.65;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.35;
    this.scene.add(grid);
    this.groundGrid = grid;
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
    this.hasDragged = false;
    this.mouseDownPosition = { x: e.clientX, y: e.clientY };

    if (e.button === 0) {
      if (this.navigationMode === 'pan' || e.shiftKey) {
        this.isPanning = true;
      } else {
        this.isOrbiting = true;
      }
    } else if (e.button === 2 || e.button === 1) {
      this.isPanning = true;
    }
    this.previousMousePosition = { x: e.clientX, y: e.clientY };
  };

  private onMouseMove = (e: MouseEvent) => {
    const deltaX = e.clientX - this.previousMousePosition.x;
    const deltaY = e.clientY - this.previousMousePosition.y;

    if (this.isOrbiting || this.isPanning) {
      const totalDx = e.clientX - this.mouseDownPosition.x;
      const totalDy = e.clientY - this.mouseDownPosition.y;
      if (Math.hypot(totalDx, totalDy) > 4) {
        this.hasDragged = true;
      }
    }

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
      const panSpeed = this.isOrthographic ? 0.025 / Math.max(0.2, this.orthographicCamera.zoom) : 0.025;
      const right = new THREE.Vector3();
      const up = new THREE.Vector3();

      this.camera.matrix.extractBasis(right, up, new THREE.Vector3());

      const move = right.multiplyScalar(-deltaX * panSpeed).add(up.multiplyScalar(deltaY * panSpeed));
      this.camera.position.add(move);
      this.cameraTarget.add(move);
      this.camera.lookAt(this.cameraTarget);
      this.notifyCameraChange();
    } else {
      // Throttled raycasting for hover detection
      if (this.hoverRafId === null) {
        const clientX = e.clientX;
        const clientY = e.clientY;
        this.hoverRafId = requestAnimationFrame(() => {
          this.hoverRafId = null;
          this.handleHoverRaycast(clientX, clientY);
        });
      }
    }

    this.previousMousePosition = { x: e.clientX, y: e.clientY };
  };

  private onMouseUp = () => {
    this.isOrbiting = false;
    this.isPanning = false;
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (this.isOrthographic) {
      const zoomScale = e.deltaY < 0 ? 1.12 : 0.89;
      this.orthographicCamera.zoom = Math.max(0.2, Math.min(12, this.orthographicCamera.zoom * zoomScale));
      this.orthographicCamera.updateProjectionMatrix();
    } else {
      const zoomFactor = e.deltaY * 0.03;
      const dir = new THREE.Vector3().subVectors(this.camera.position, this.cameraTarget).normalize();
      const dist = this.camera.position.distanceTo(this.cameraTarget);

      const newDist = Math.max(3, Math.min(150, dist + zoomFactor));
      this.camera.position.copy(this.cameraTarget).add(dir.multiplyScalar(newDist));
      this.camera.lookAt(this.cameraTarget);
    }
    this.notifyCameraChange();
  };

  private onClick = (e: MouseEvent) => {
    // Ignore click if user was dragging to orbit or pan
    if (this.hasDragged) {
      this.hasDragged = false;
      return;
    }
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

  private handleHoverRaycast(clientX: number, clientY: number) {
    if (!this.container) return;
    const rect = this.container.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

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

  private disposeObjectResources(obj: THREE.Object3D): void {
    obj.traverse(child => {
      const anyChild = child as any;
      if (anyChild.geometry) {
        anyChild.geometry.dispose();
      }
      if (anyChild.material) {
        const materials = Array.isArray(anyChild.material) ? anyChild.material : [anyChild.material];
        for (const mat of materials) {
          if (mat.map) mat.map.dispose();
          // Do not dispose shared highlight/ghost materials
          if (
            mat !== this.selectionMaterial &&
            mat !== this.clashMaterialA &&
            mat !== this.clashMaterialB &&
            mat !== this.clashGhostMaterial &&
            mat !== this.wireframeGhostMaterial
          ) {
            mat.dispose();
          }
        }
      }
    });
  }

  async loadModel(model: BimModel): Promise<void> {
    // Clear existing meshes and child edge lines cleanly
    for (const [id, mesh] of this.meshMap.entries()) {
      const origMat = this.originalMaterials.get(id);
      if (origMat) mesh.material = origMat;
      this.scene.remove(mesh);
      this.disposeObjectResources(mesh);
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
      mesh.visible = element.visible !== false;
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

    boxGeo.dispose();
    cylinderGeo.dispose();

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
      this.disposeObjectResources(obj);
    }

    if (!model.elements || model.elements.length < 5) return;

    // Compute exact 3D bounding box of the loaded model
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const el of model.elements) {
      const [px, py, pz] = el.transform.position;
      const [sx, sy, sz] = el.transform.scale;
      if (px - sx / 2 < minX) minX = px - sx / 2;
      if (px + sx / 2 > maxX) maxX = px + sx / 2;
      if (py - sy / 2 < minY) minY = py - sy / 2;
      if (py + sy / 2 > maxY) maxY = py + sy / 2;
      if (pz - sz / 2 < minZ) minZ = pz - sz / 2;
      if (pz + sz / 2 > maxZ) maxZ = pz + sz / 2;
    }

    if (!isFinite(minX) || !isFinite(minY) || !isFinite(minZ)) return;

    // Position ground grid right below the model's lowest foundation
    if (this.groundGrid) {
      this.groundGrid.position.y = minY - 0.05;
    }

    // 1. Dynamic Revit 3D Section Box (Green Dashed Bounding Box)
    const padX = 3.6;
    const padY = 2.4;
    const padZ = 3.6;
    const boxSize = new THREE.Vector3(
      (maxX - minX) + padX,
      (maxY - minY) + padY,
      (maxZ - minZ) + padZ
    );
    const boxCenter = new THREE.Vector3(
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (minZ + maxZ) / 2
    );

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

    // 2. Dynamic Revit Level Datums (extracted from model storeys or exact Project2 levels)
    const isProject2 =
      model.id.includes('PROJECT2') ||
      model.name.toLowerCase() === 'project2' ||
      model.elements.some(e => e.id.startsWith('P2-'));

    let levels: { name: string; elev: string; y: number }[] = [];

    if (isProject2) {
      levels = [
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
    } else {
      const storeyElevMap = new Map<string, number>();
      for (const el of model.elements) {
        if (!el.storey) continue;
        // Prefer slab/beam top or column base for level elevation
        const candidateY =
          el.category === 'IfcSlab' || el.category === 'IfcBeam'
            ? el.transform.position[1] + el.transform.scale[1] / 2
            : el.transform.position[1] - el.transform.scale[1] / 2;
        if (!storeyElevMap.has(el.storey)) {
          storeyElevMap.set(el.storey, candidateY);
        } else if (el.category === 'IfcSlab') {
          storeyElevMap.set(el.storey, candidateY);
        }
      }
      levels = Array.from(storeyElevMap.entries())
        .map(([rawName, yVal]) => {
          const cleanName = rawName.replace(/\s*\([+-]?\d+.*?\)/, '').trim();
          const sign = yVal >= 0 ? '+' : '';
          return {
            name: cleanName,
            elev: `${sign}${yVal.toFixed(3)}`,
            y: +yVal.toFixed(2)
          };
        })
        .sort((a, b) => b.y - a.y);
    }

    const levelFrontZ = maxZ + 2.0;
    const levelLeftX = minX - 5.5;
    const levelRightX = maxX + 2.0;

    levels.forEach(lvl => {
      const pts = [
        new THREE.Vector3(levelLeftX, lvl.y, levelFrontZ),
        new THREE.Vector3(levelRightX, lvl.y, levelFrontZ)
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
      sprite.position.set(levelLeftX - 1.8, lvl.y, levelFrontZ);
      this.annotationGroup.add(sprite);
    });

    // 3. Dynamic Revit Grid Bubbles along X (1..N) and Z (A..Z) on base plane
    const clusterCoords = (rawVals: number[], minGap = 1.2): number[] => {
      const sorted = [...rawVals].sort((a, b) => a - b);
      const result: number[] = [];
      for (const v of sorted) {
        if (result.length === 0 || Math.abs(v - result[result.length - 1]) >= minGap) {
          result.push(+v.toFixed(2));
        }
      }
      return result;
    };

    const gridElements = model.elements.filter(
      e => e.category === 'IfcColumn' || e.category === 'IfcFooting'
    );
    const sourceElems = gridElements.length >= 4 ? gridElements : model.elements;

    const gridX = isProject2
      ? [-11.4, -7.6, -3.8, 0.0, 3.8, 7.6, 11.4]
      : clusterCoords(sourceElems.map(e => e.transform.position[0]), 1.5).slice(0, 14);

    const gridZ = isProject2
      ? [-5.5, 0.0, 5.5]
      : clusterCoords(sourceElems.map(e => e.transform.position[2]), 1.5).slice(0, 12);

    const basePlaneY = minY;

    gridX.forEach((x, i) => {
      const label = String(i + 1);
      const pts = [
        new THREE.Vector3(x, basePlaneY, minZ - 2.0),
        new THREE.Vector3(x, basePlaneY, maxZ + 3.0)
      ];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const lMat = new THREE.LineDashedMaterial({ color: 0x64748b, dashSize: 0.6, gapSize: 0.3 });
      const gridL = new THREE.Line(lineGeo, lMat);
      gridL.computeLineDistances();
      this.annotationGroup.add(gridL);

      const bubble = this.createTextSprite(label, true);
      bubble.position.set(x, basePlaneY, maxZ + 3.8);
      this.annotationGroup.add(bubble);
    });

    gridZ.forEach((z, i) => {
      const label = String.fromCharCode(65 + i);
      const pts = [
        new THREE.Vector3(minX - 2.5, basePlaneY, z),
        new THREE.Vector3(maxX + 3.0, basePlaneY, z)
      ];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const lMat = new THREE.LineDashedMaterial({ color: 0x64748b, dashSize: 0.6, gapSize: 0.3 });
      const gridL = new THREE.Line(lineGeo, lMat);
      gridL.computeLineDistances();
      this.annotationGroup.add(gridL);

      const bubble = this.createTextSprite(label, true);
      bubble.position.set(maxX + 3.8, basePlaneY, z);
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
      this.selectionMaterial.clippingPlanes = this.activeClippingPlanes;
      selectedMesh.material = this.selectionMaterial;
    }

    if (this.onSelectCb) {
      this.onSelectCb(id);
    }
  }

  hoverElement(id: string | null): void {
    this.hoveredElementId = id;
  }

  setNavigationMode(mode: 'select' | 'orbit' | 'pan'): void {
    this.navigationMode = mode;
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

  showElements(ids: string[]): void {
    const idSet = new Set(ids);
    for (const [id, mesh] of this.meshMap.entries()) {
      if (idSet.has(id)) {
        mesh.visible = true;
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

    // Sync orthographic zoom to fit target bounds
    const frustumSize = 35;
    this.orthographicCamera.zoom = Math.max(0.25, Math.min(8, frustumSize / (maxDim * 1.35)));
    this.orthographicCamera.updateProjectionMatrix();

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
      this.orthographicCamera.updateProjectionMatrix();
      this.camera = this.orthographicCamera;
    } else {
      this.isOrthographic = false;
      this.perspectiveCamera.position.copy(this.camera.position);
      this.perspectiveCamera.lookAt(this.cameraTarget);
      this.perspectiveCamera.updateProjectionMatrix();
      this.camera = this.perspectiveCamera;
    }
    this.notifyCameraChange();
  }

  setSectionPlane(axis: 'x' | 'y' | 'z', enabled: boolean, offset: number, flipped: boolean): void {
    const normal = new THREE.Vector3();
    // In BIM UI: 'z' = Floor Elevation (maps to Three.js Y up-axis), 'y' = Front-Back depth (maps to Three.js Z axis)
    if (axis === 'x') normal.set(flipped ? 1 : -1, 0, 0);
    if (axis === 'y') normal.set(0, 0, flipped ? 1 : -1);
    if (axis === 'z') normal.set(0, flipped ? 1 : -1, 0);

    const constant = flipped ? -offset : offset;
    this.clipPlanes[axis].set(normal, constant);

    this.updateActiveClippingPlanes(enabled ? axis : null);
  }

  private applyClippingPlanesToAllMaterials(): void {
    this.selectionMaterial.clippingPlanes = this.activeClippingPlanes;
    this.clashMaterialA.clippingPlanes = this.activeClippingPlanes;
    this.clashMaterialB.clippingPlanes = this.activeClippingPlanes;
    this.clashGhostMaterial.clippingPlanes = this.activeClippingPlanes;
    this.wireframeGhostMaterial.clippingPlanes = this.activeClippingPlanes;

    for (const mesh of this.meshMap.values()) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => { m.clippingPlanes = this.activeClippingPlanes; });
      } else {
        mesh.material.clippingPlanes = this.activeClippingPlanes;
      }
    }
  }

  private updateActiveClippingPlanes(activeAxis: 'x' | 'y' | 'z' | null): void {
    this.activeClippingPlanes = [];
    if (activeAxis) {
      this.activeClippingPlanes.push(this.clipPlanes[activeAxis]);
    }
    this.applyClippingPlanesToAllMaterials();
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
    this.applyClippingPlanesToAllMaterials();
  }

  highlightClashPair(idA: string, idB: string, focusPoint?: [number, number, number]): void {
    const meshA = this.meshMap.get(idA);
    const meshB = this.meshMap.get(idB);

    this.clashGhostMaterial.clippingPlanes = this.activeClippingPlanes;
    this.clashMaterialA.clippingPlanes = this.activeClippingPlanes;
    this.clashMaterialB.clippingPlanes = this.activeClippingPlanes;

    // Ghost all other meshes using shared ghost material
    for (const [id, mesh] of this.meshMap.entries()) {
      if (id === idA || id === idB) {
        mesh.visible = true;
      } else {
        mesh.material = this.clashGhostMaterial;
      }
    }

    // Item A in distinct Red (#EF4444) with emissive glow
    if (meshA) {
      meshA.material = this.clashMaterialA;
    }

    // Item B in distinct Cyan/Teal (#06B6D4) with emissive glow
    if (meshB) {
      meshB.material = this.clashMaterialB;
    }

    // Smoothly focus camera on clash point
    if (focusPoint) {
      const pt = new THREE.Vector3(...focusPoint);
      this.cameraTarget.copy(pt);
      this.camera.position.set(pt.x + 5, pt.y + 4, pt.z + 6);
      this.camera.lookAt(pt);
      this.notifyCameraChange();
    } else if (meshA && meshB) {
      const box = new THREE.Box3().expandByObject(meshA).expandByObject(meshB);
      const center = new THREE.Vector3();
      box.getCenter(center);
      this.cameraTarget.copy(center);
      this.camera.position.set(center.x + 6, center.y + 4, center.z + 7);
      this.camera.lookAt(center);
      this.notifyCameraChange();
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
    this.wireframeGhostMaterial.clippingPlanes = this.activeClippingPlanes;
    for (const [id, mesh] of this.meshMap.entries()) {
      if (enabled) {
        mesh.material = this.wireframeGhostMaterial;
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
