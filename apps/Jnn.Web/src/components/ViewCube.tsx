import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useApp } from '../state/AppContext';
import type { ViewPreset } from '../viewer/ViewerAdapter';

interface PartConfig {
  preset: ViewPreset;
  type: 'face' | 'edge' | 'corner';
  position: [number, number, number];
  size: [number, number, number];
  rotation?: [number, number, number];
  label?: string;
}

const PARTS: PartConfig[] = [
  // 6 Faces
  { preset: 'top', type: 'face', position: [0, 0.92, 0], size: [1.36, 0.08, 1.36], label: 'TOP' },
  { preset: 'bottom', type: 'face', position: [0, -0.92, 0], size: [1.36, 0.08, 1.36], label: 'BOTTOM' },
  { preset: 'front', type: 'face', position: [0, 0, 0.92], size: [1.36, 1.36, 0.08], label: 'FRONT' },
  { preset: 'back', type: 'face', position: [0, 0, -0.92], size: [1.36, 1.36, 0.08], label: 'BACK' },
  { preset: 'left', type: 'face', position: [-0.92, 0, 0], size: [0.08, 1.36, 1.36], label: 'LEFT' },
  { preset: 'right', type: 'face', position: [0.92, 0, 0], size: [0.08, 1.36, 1.36], label: 'RIGHT' },

  // 12 Edges
  { preset: 'top-front', type: 'edge', position: [0, 0.92, 0.92], size: [1.36, 0.22, 0.22] },
  { preset: 'top-back', type: 'edge', position: [0, 0.92, -0.92], size: [1.36, 0.22, 0.22] },
  { preset: 'top-left', type: 'edge', position: [-0.92, 0.92, 0], size: [0.22, 0.22, 1.36] },
  { preset: 'top-right', type: 'edge', position: [0.92, 0.92, 0], size: [0.22, 0.22, 1.36] },
  { preset: 'bottom-front', type: 'edge', position: [0, -0.92, 0.92], size: [1.36, 0.22, 0.22] },
  { preset: 'bottom-back', type: 'edge', position: [0, -0.92, -0.92], size: [1.36, 0.22, 0.22] },
  { preset: 'bottom-left', type: 'edge', position: [-0.92, -0.92, 0], size: [0.22, 0.22, 1.36] },
  { preset: 'bottom-right', type: 'edge', position: [0.92, -0.92, 0], size: [0.22, 0.22, 1.36] },
  { preset: 'front-left', type: 'edge', position: [-0.92, 0, 0.92], size: [0.22, 1.36, 0.22] },
  { preset: 'front-right', type: 'edge', position: [0.92, 0, 0.92], size: [0.22, 1.36, 0.22] },
  { preset: 'back-left', type: 'edge', position: [-0.92, 0, -0.92], size: [0.22, 1.36, 0.22] },
  { preset: 'back-right', type: 'edge', position: [0.92, 0, -0.92], size: [0.22, 1.36, 0.22] },

  // 8 Corners
  { preset: 'top-front-left', type: 'corner', position: [-0.92, 0.92, 0.92], size: [0.24, 0.24, 0.24] },
  { preset: 'top-front-right', type: 'corner', position: [0.92, 0.92, 0.92], size: [0.24, 0.24, 0.24] },
  { preset: 'top-back-left', type: 'corner', position: [-0.92, 0.92, -0.92], size: [0.24, 0.24, 0.24] },
  { preset: 'top-back-right', type: 'corner', position: [0.92, 0.92, -0.92], size: [0.24, 0.24, 0.24] },
  { preset: 'bottom-front-left', type: 'corner', position: [-0.92, -0.92, 0.92], size: [0.24, 0.24, 0.24] },
  { preset: 'bottom-front-right', type: 'corner', position: [0.92, -0.92, 0.92], size: [0.24, 0.24, 0.24] },
  { preset: 'bottom-back-left', type: 'corner', position: [-0.92, -0.92, -0.92], size: [0.24, 0.24, 0.24] },
  { preset: 'bottom-back-right', type: 'corner', position: [0.92, -0.92, -0.92], size: [0.24, 0.24, 0.24] },
];

function createTextTexture(text: string, isDark: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = isDark ? '#272d37' : '#e2e6eb';
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = isDark ? '#3e4856' : '#cbd3dc';
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, 244, 244);

    ctx.fillStyle = isDark ? '#e6edf3' : '#1f2328';
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

export function ViewCube() {
  const { viewer, state } = useApp();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
      return;
    }

    const size = 120;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(size, size);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1.75, 1.75, 1.75, -1.75, 0.1, 50);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(4, 6, 8);
    scene.add(ambientLight, dirLight);

    const cubeGroup = new THREE.Group();
    scene.add(cubeGroup);

    // Inner core box
    const coreGeom = new THREE.BoxGeometry(1.7, 1.7, 1.7);
    const coreMat = new THREE.MeshBasicMaterial({
      color: state.theme === 'dark' ? 0x1a1e24 : 0xd3d9e0,
    });
    const core = new THREE.Mesh(coreGeom, coreMat);
    cubeGroup.add(core);

    const isDark = state.theme === 'dark';
    const meshMap = new Map<THREE.Mesh, PartConfig>();
    const texturesToDispose: THREE.Texture[] = [];
    const materialsToDispose: THREE.Material[] = [coreMat];
    const geometriesToDispose: THREE.BufferGeometry[] = [coreGeom];

    const edgeMat = new THREE.MeshLambertMaterial({
      color: isDark ? 0x374151 : 0xd1d5db,
    });
    const cornerMat = new THREE.MeshLambertMaterial({
      color: isDark ? 0x4b5563 : 0x9ca3af,
    });
    materialsToDispose.push(edgeMat, cornerMat);

    for (const part of PARTS) {
      const geom = new THREE.BoxGeometry(...part.size);
      geometriesToDispose.push(geom);

      let mat: THREE.Material;
      if (part.type === 'face' && part.label) {
        const tex = createTextTexture(part.label, isDark);
        texturesToDispose.push(tex);
        mat = new THREE.MeshLambertMaterial({ map: tex });
        materialsToDispose.push(mat);
      } else if (part.type === 'edge') {
        mat = edgeMat.clone();
        materialsToDispose.push(mat);
      } else {
        mat = cornerMat.clone();
        materialsToDispose.push(mat);
      }

      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(...part.position);
      cubeGroup.add(mesh);
      meshMap.set(mesh, part);
    }

    const render = () => {
      renderer.render(scene, camera);
    };

    // Update cube orientation from main viewer camera
    const updateFromCamera = () => {
      if (!viewer) return;
      const camRes = viewer.getCamera();
      if (!camRes.ok) return;
      const { position, target } = camRes.value;
      const p = new THREE.Vector3(position[0], position[2], -position[1]);
      const t = new THREE.Vector3(target[0], target[2], -target[1]);
      const dir = p.clone().sub(t).normalize();
      if (dir.lengthSq() < 1e-4) return;

      const up = Math.abs(dir.y) > 0.99 ? new THREE.Vector3(0, 0, -Math.sign(dir.y)) : new THREE.Vector3(0, 1, 0);
      const rotMatrix = new THREE.Matrix4().lookAt(dir, new THREE.Vector3(0, 0, 0), up);
      const quat = new THREE.Quaternion().setFromRotationMatrix(rotMatrix).invert();
      cubeGroup.quaternion.copy(quat);
      render();
    };

    updateFromCamera();
    const unsub = viewer?.on('cameraChange', () => {
      updateFromCamera();
    });

    render();

    return () => {
      unsub?.();
      renderer.dispose();
      texturesToDispose.forEach((t) => t.dispose());
      materialsToDispose.forEach((m) => m.dispose());
      geometriesToDispose.forEach((g) => g.dispose());
    };
  }, [viewer, state.theme]);

  return (
    <div
      data-testid="viewcube-3d"
      className="absolute top-3 right-3 z-20 h-[120px] w-[120px] select-none touch-none"
    >
      <canvas
        ref={canvasRef}
        data-testid="viewcube-canvas"
        className="h-full w-full cursor-grab active:cursor-grabbing"
      />
    </div>
  );
}
