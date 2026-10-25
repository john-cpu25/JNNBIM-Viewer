// Shape of the debug hook installed by Viewport.tsx when `?debug=1` is present.
type AdapterResult<T> = { ok: true; value: T } | { ok: false; code: string; message: string };

interface JnnDebugViewer {
  projectToScreen(id: string): AdapterResult<{ x: number; y: number; onScreen: boolean }>;
  getCamera(): AdapterResult<{ position: number[]; target: number[]; projection: string }>;
  debugState(): {
    elementCount: number;
    visibleCount: number;
    selected: string[];
    clipPlaneCount: number;
    projection: 'perspective' | 'orthographic';
    xray: boolean;
  };
}

interface Window {
  __jnn?: { viewer: JnnDebugViewer; getState: () => unknown };
}
