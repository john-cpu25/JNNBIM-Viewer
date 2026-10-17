import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { CameraPreset } from '../../types/bim';
import { ViewerAdapter } from '../../adapters/ViewerAdapter';
import { Compass, Home } from 'lucide-react';

interface ViewCubeProps {
  adapter?: ViewerAdapter;
  onSelectPreset: (preset: CameraPreset) => void;
}

type CubeFaceName = 'Right' | 'Left' | 'Top' | 'Bottom' | 'Front' | 'Back';

const FACE_CONFIGS: { name: CubeFaceName; label: string; preset: CameraPreset; index: number }[] = [
  { name: 'Right', label: 'RIGHT', preset: 'Right', index: 0 },
  { name: 'Left', label: 'LEFT', preset: 'Left', index: 1 },
  { name: 'Top', label: 'TOP', preset: 'Top', index: 2 },
  { name: 'Bottom', label: 'BOT', preset: 'Bottom', index: 3 },
  { name: 'Front', label: 'FRONT', preset: 'Front', index: 4 },
  { name: 'Back', label: 'BACK', preset: 'Back', index: 5 },
];

export const ViewCube: React.FC<ViewCubeProps> = ({ adapter, onSelectPreset }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredTarget, setHoveredTarget] = useState<string | null>(null);

  // References to keep Three.js scene instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cubeMeshRef = useRef<THREE.Mesh | null>(null);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const textureCanvasesRef = useRef<HTMLCanvasElement[]>([]);
  const cornerHitboxesRef = useRef<{ mesh: THREE.Mesh; preset: CameraPreset; name: string }[]>([]);
  const compassLettersRef = useRef<{ mesh: THREE.Mesh; preset: CameraPreset; name: string }[]>([]);

  // Track dragging on viewcube
  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const hasMovedSignificantlyRef = useRef(false);

  // Helper to draw face texture
  const drawFaceTexture = (
    canvas: HTMLCanvasElement,
    label: string,
    isHovered: boolean
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    // Background
    ctx.clearRect(0, 0, w, h);

    if (isHovered) {
      // Revit Sky-Blue Highlight
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 14;
      ctx.strokeRect(7, 7, w - 14, h - 14);
      // Inner glowing border
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 4;
      ctx.strokeRect(18, 18, w - 36, h - 36);

      // Text
      ctx.fillStyle = '#ffffff';
    } else {
      // Clean Architectural Matte Off-White
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#f8fafc');
      grad.addColorStop(1, '#e2e8f0');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Chamfered borders
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, w - 10, h - 10);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 4;
      ctx.strokeRect(14, 14, w - 28, h - 28);

      // Text
      ctx.fillStyle = '#334155';
    }

    ctx.font = '900 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2, h / 2);
  };

  // Helper to draw compass ring texture with N, E, S, W and ticks
  const createCompassTexture = (): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const center = 256;
    const outerR = 236;
    const innerR = 175;

    ctx.clearRect(0, 0, 512, 512);

    // Soft drop shadow under the cube
    const shadowGrad = ctx.createRadialGradient(center, center, 20, center, center, 140);
    shadowGrad.addColorStop(0, 'rgba(15, 23, 42, 0.45)');
    shadowGrad.addColorStop(0.6, 'rgba(15, 23, 42, 0.2)');
    shadowGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.arc(center, center, 140, 0, Math.PI * 2);
    ctx.fill();

    // Circular compass ring disc
    ctx.fillStyle = 'rgba(241, 245, 249, 0.9)';
    ctx.beginPath();
    ctx.arc(center, center, outerR, 0, Math.PI * 2);
    ctx.arc(center, center, innerR, 0, Math.PI * 2, true);
    ctx.fill();

    // Outer & inner ring stroke
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(center, center, outerR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(center, center, innerR, 0, Math.PI * 2);
    ctx.stroke();

    // Radial tick marks every 15 deg
    for (let deg = 0; deg < 360; deg += 15) {
      const rad = (deg * Math.PI) / 180;
      const isMajor = deg % 90 === 0;
      const isSemi = deg % 45 === 0;
      const tickLen = isMajor ? 18 : isSemi ? 12 : 7;

      const r1 = outerR - 4;
      const r2 = r1 - tickLen;
      const x1 = center + Math.cos(rad) * r1;
      const y1 = center + Math.sin(rad) * r1;
      const x2 = center + Math.cos(rad) * r2;
      const y2 = center + Math.sin(rad) * r2;

      ctx.strokeStyle = isMajor ? '#0f172a' : '#64748b';
      ctx.lineWidth = isMajor ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Cardinal Direction Letters:
    // In Revit: North is at top (-Z in 3D), East at right (+X), South at bottom (+Z), West at left (-X)
    ctx.font = '900 46px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textR = (outerR + innerR) / 2;
    // North: -Y in 2D canvas = -Z in 3D space
    ctx.fillStyle = '#0284c7'; // Cyan/Blue for North
    ctx.fillText('N', center, center - textR + 2);

    ctx.fillStyle = '#334155';
    // East: +X in 2D canvas = +X in 3D space
    ctx.fillText('E', center + textR - 2, center);
    // South: +Y in 2D canvas = +Z in 3D space
    ctx.fillText('S', center, center + textR - 2);
    // West: -X in 2D canvas = -X in 3D space
    ctx.fillText('W', center - textR + 2, center);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const width = 144;
    const height = 144;

    // 1. Scene & Orthographic Camera (CAD / Revit ViewCube projection)
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const frustum = 3.6;
    const camera = new THREE.OrthographicCamera(
      -frustum / 2,
      frustum / 2,
      frustum / 2,
      -frustum / 2,
      0.1,
      50
    );
    // Default initial angle: Isometric (+X, +Y, +Z)
    camera.position.set(2.4, 2.0, 2.8).normalize().multiplyScalar(4.2);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    rendererRef.current = renderer;

    // 3. Lighting setup for clean realistic matte cube
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight1.position.set(3, 5, 4);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    dirLight2.position.set(-3, -2, -3);
    scene.add(dirLight2);

    // 4. Create 3D Cube with 6 face canvas textures
    const cubeMaterials: THREE.MeshStandardMaterial[] = [];
    const canvases: HTMLCanvasElement[] = [];

    FACE_CONFIGS.forEach((cfg) => {
      const faceCanvas = document.createElement('canvas');
      faceCanvas.width = 256;
      faceCanvas.height = 256;
      drawFaceTexture(faceCanvas, cfg.label, false);
      canvases.push(faceCanvas);

      const texture = new THREE.CanvasTexture(faceCanvas);
      const mat = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.45,
        metalness: 0.1,
      });
      cubeMaterials.push(mat);
    });

    materialsRef.current = cubeMaterials;
    textureCanvasesRef.current = canvases;

    const cubeGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const cubeMesh = new THREE.Mesh(cubeGeo, cubeMaterials);
    cubeMesh.userData = { isViewCube: true };
    scene.add(cubeMesh);
    cubeMeshRef.current = cubeMesh;

    // 5. Compass Ground Disc & Ring
    const compassTex = createCompassTexture();
    const compassGeo = new THREE.PlaneGeometry(3.2, 3.2);
    const compassMat = new THREE.MeshBasicMaterial({
      map: compassTex,
      transparent: true,
      depthWrite: false,
    });
    const compassMesh = new THREE.Mesh(compassGeo, compassMat);
    compassMesh.rotation.x = -Math.PI / 2;
    compassMesh.position.y = -0.92;
    scene.add(compassMesh);

    // 6. Corner & Edge interactive hitboxes (for Isometric angles)
    const cornerHitboxes: { mesh: THREE.Mesh; preset: CameraPreset; name: string }[] = [];
    const cornerSize = 0.35;
    const cornerGeo = new THREE.BoxGeometry(cornerSize, cornerSize, cornerSize);
    const invisMat = new THREE.MeshBasicMaterial({ visible: false });

    // 4 Top Corners
    const topCorners: { pos: [number, number, number]; preset: CameraPreset; name: string }[] = [
      { pos: [0.75, 0.75, 0.75], preset: 'Isometric', name: 'Top-Right-Front' },
      { pos: [-0.75, 0.75, 0.75], preset: 'Isometric', name: 'Top-Left-Front' },
      { pos: [0.75, 0.75, -0.75], preset: 'Isometric', name: 'Top-Right-Back' },
      { pos: [-0.75, 0.75, -0.75], preset: 'Isometric', name: 'Top-Left-Back' },
    ];

    topCorners.forEach(tc => {
      const cornerMesh = new THREE.Mesh(cornerGeo, invisMat.clone());
      cornerMesh.position.set(...tc.pos);
      cornerMesh.userData = { isCorner: true, preset: tc.preset, name: tc.name };
      scene.add(cornerMesh);
      cornerHitboxes.push({ mesh: cornerMesh, preset: tc.preset, name: tc.name });
    });
    cornerHitboxesRef.current = cornerHitboxes;

    // 7. Interactive Cardinal Compass Directions Clickboxes
    const compassHits: { mesh: THREE.Mesh; preset: CameraPreset; name: string }[] = [];
    const cardinalPoints: { pos: [number, number, number]; preset: CameraPreset; name: string }[] = [
      { pos: [0, -0.9, -1.3], preset: 'Back', name: 'North (N)' },
      { pos: [1.3, -0.9, 0], preset: 'Right', name: 'East (E)' },
      { pos: [0, -0.9, 1.3], preset: 'Front', name: 'South (S)' },
      { pos: [-1.3, -0.9, 0], preset: 'Left', name: 'West (W)' },
    ];
    cardinalPoints.forEach(cp => {
      const cMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.4), invisMat.clone());
      cMesh.position.set(...cp.pos);
      cMesh.userData = { isCompass: true, preset: cp.preset, name: cp.name };
      scene.add(cMesh);
      compassHits.push({ mesh: cMesh, preset: cp.preset, name: cp.name });
    });
    compassLettersRef.current = compassHits;

    // 8. Render loop
    const render = () => {
      renderer.render(scene, camera);
    };
    render();

    // 9. Subscribe to Main Camera sync
    let unsubscribe: (() => void) | undefined;
    if (adapter?.onCameraChange) {
      unsubscribe = adapter.onCameraChange((mainCam, target) => {
        if (!cameraRef.current) return;
        const dir = new THREE.Vector3().subVectors(mainCam.position, target).normalize();
        cameraRef.current.position.copy(dir.multiplyScalar(4.2));
        cameraRef.current.lookAt(0, 0, 0);
        render();
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
      renderer.dispose();
      cubeGeo.dispose();
      compassGeo.dispose();
      cornerGeo.dispose();
      cubeMaterials.forEach(m => m.dispose());
      compassMat.dispose();
    };
  }, [adapter]);

  // Handle Mouse Interactions (Raycasting, Drag to Orbit, Click Face)
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    hasMovedSignificantlyRef.current = false;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !cameraRef.current || !cubeMeshRef.current || !sceneRef.current) return;

    if (isDraggingRef.current) {
      const deltaX = e.clientX - dragStartPosRef.current.x;
      const deltaY = e.clientY - dragStartPosRef.current.y;
      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        hasMovedSignificantlyRef.current = true;
      }
      dragStartPosRef.current = { x: e.clientX, y: e.clientY };

      // Orbit main camera directly when dragging viewcube!
      if (adapter?.orbitCamera) {
        adapter.orbitCamera(deltaX, deltaY);
      }
      return;
    }

    // Raycast hover detection
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), cameraRef.current);

    // Check hit on cube mesh
    const intersects = raycaster.intersectObject(cubeMeshRef.current, false);

    let activeHoverFaceIndex = -1;
    let label = '';

    if (intersects.length > 0 && intersects[0].face) {
      const hitFace = intersects[0].face;
      const normal = hitFace.normal.clone().normalize();

      // Determine hit face by normal
      if (Math.abs(normal.x - 1) < 0.1) activeHoverFaceIndex = 0; // Right
      else if (Math.abs(normal.x + 1) < 0.1) activeHoverFaceIndex = 1; // Left
      else if (Math.abs(normal.y - 1) < 0.1) activeHoverFaceIndex = 2; // Top
      else if (Math.abs(normal.y + 1) < 0.1) activeHoverFaceIndex = 3; // Bottom
      else if (Math.abs(normal.z - 1) < 0.1) activeHoverFaceIndex = 4; // Front
      else if (Math.abs(normal.z + 1) < 0.1) activeHoverFaceIndex = 5; // Back

      if (activeHoverFaceIndex >= 0) {
        label = FACE_CONFIGS[activeHoverFaceIndex].name;
      }
    }

    // If no cube face, check compass directions
    if (activeHoverFaceIndex === -1) {
      const compassMeshes = compassLettersRef.current.map(c => c.mesh);
      const compassHits = raycaster.intersectObjects(compassMeshes, false);
      if (compassHits.length > 0) {
        label = compassHits[0].object.userData.name || 'Compass';
      }
    }

    setHoveredTarget(label || null);

    // Update face highlights
    materialsRef.current.forEach((mat, idx) => {
      const canvas = textureCanvasesRef.current[idx];
      if (!canvas) return;
      const isHovered = idx === activeHoverFaceIndex;
      drawFaceTexture(canvas, FACE_CONFIGS[idx].label, isHovered);
      if (mat.map) mat.map.needsUpdate = true;
    });

    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    if (hasMovedSignificantlyRef.current) return; // Drag occurred, do not trigger click

    if (!canvasRef.current || !cameraRef.current || !cubeMeshRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), cameraRef.current);

    // 1. Check corner hits first (high precision for Isometric view)
    const cornerMeshes = cornerHitboxesRef.current.map(c => c.mesh);
    const cornerHits = raycaster.intersectObjects(cornerMeshes, false);
    if (cornerHits.length > 0) {
      onSelectPreset('Isometric');
      return;
    }

    // 2. Check compass hits (N, E, S, W)
    const compassMeshes = compassLettersRef.current.map(c => c.mesh);
    const compassHits = raycaster.intersectObjects(compassMeshes, false);
    if (compassHits.length > 0) {
      const preset = compassHits[0].object.userData.preset as CameraPreset;
      if (preset) onSelectPreset(preset);
      return;
    }

    // 3. Check cube face hits
    const cubeHits = raycaster.intersectObject(cubeMeshRef.current, false);
    if (cubeHits.length > 0 && cubeHits[0].face) {
      const normal = cubeHits[0].face.normal.clone().normalize();
      let targetPreset: CameraPreset | null = null;

      if (Math.abs(normal.x - 1) < 0.1) targetPreset = 'Right';
      else if (Math.abs(normal.x + 1) < 0.1) targetPreset = 'Left';
      else if (Math.abs(normal.y - 1) < 0.1) targetPreset = 'Top';
      else if (Math.abs(normal.y + 1) < 0.1) targetPreset = 'Bottom';
      else if (Math.abs(normal.z - 1) < 0.1) targetPreset = 'Front';
      else if (Math.abs(normal.z + 1) < 0.1) targetPreset = 'Back';

      if (targetPreset) {
        onSelectPreset(targetPreset);
      }
    }
  };

  const handleMouseLeave = () => {
    isDraggingRef.current = false;
    setHoveredTarget(null);
    materialsRef.current.forEach((mat, idx) => {
      const canvas = textureCanvasesRef.current[idx];
      if (canvas) {
        drawFaceTexture(canvas, FACE_CONFIGS[idx].label, false);
        if (mat.map) mat.map.needsUpdate = true;
      }
    });
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  };

  return (
    <div className="absolute top-4 right-4 z-20 flex flex-col items-center gap-1 select-none pointer-events-auto group">
      {/* North & Compass Orientation Badge */}
      <div className="flex items-center gap-1.5 text-[11px] text-cyan-400 font-mono font-bold bg-[var(--bg-surface)]/90 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-cyan-800/60 shadow-lg transition-transform group-hover:scale-102">
        <Compass className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
        <span>NORTH (Y+)</span>
        {hoveredTarget && (
          <span className="text-[10px] text-white bg-cyan-700/80 px-1 rounded ml-1 font-sans">
            {hoveredTarget}
          </span>
        )}
      </div>

      {/* 3D ViewCube & Compass Dial Container */}
      <div 
        ref={containerRef}
        className="relative w-36 h-36 bg-[var(--bg-surface)]/80 backdrop-blur-md border border-[var(--border-color)] rounded-2xl shadow-2xl flex items-center justify-center p-0.5 overflow-hidden transition-all hover:border-cyan-500/50"
      >
        {/* Floating Revit Home Icon Button */}
        <button
          onClick={() => onSelectPreset('Isometric')}
          data-tooltip="Home / Isometric View"
          className="absolute top-2 left-2 z-30 p-1.5 rounded-lg bg-[var(--bg-elevated)]/90 hover:bg-cyan-600 text-[var(--text-secondary)] hover:text-white border border-[var(--border-color)] shadow-md transition-all hover:scale-110 opacity-70 group-hover:opacity-100"
          title="Home (Isometric View)"
        >
          <Home className="w-3.5 h-3.5" />
        </button>

        {/* 3D WebGL Canvas for ViewCube + Compass Ring */}
        <canvas
          ref={canvasRef}
          width={144}
          height={144}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          className="w-full h-full cursor-pointer active:cursor-grabbing"
          title="Drag to orbit 3D model, click face to align camera"
        />
      </div>
    </div>
  );
};
