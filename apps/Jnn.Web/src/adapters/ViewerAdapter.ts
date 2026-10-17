import { BimModel, CameraPreset } from '../types/bim';

export interface ViewerAdapter {
  init(container: HTMLElement): void;
  dispose(): void;
  loadModel(model: BimModel): Promise<void>;
  selectElement(id: string | null): void;
  hoverElement(id: string | null): void;
  isolateElements(ids: string[]): void;
  hideElements(ids: string[]): void;
  showAll(): void;
  fitToView(ids?: string[]): void;
  setCameraPreset(preset: CameraPreset): void;
  setCameraProjection(projection: 'Perspective' | 'Orthographic'): void;
  setSectionPlane(axis: 'x' | 'y' | 'z', enabled: boolean, offset: number, flipped: boolean): void;
  setSectionBox(enabled: boolean, min?: [number, number, number], max?: [number, number, number]): void;
  highlightClashPair(idA: string, idB: string, focusPoint?: [number, number, number]): void;
  clearClashHighlight(): void;
  setGhostMode(enabled: boolean): void;
  setBackgroundColor(colorHex: string): void;
  captureScreenshot(): string;
  setShadows?(enabled: boolean): void;
  isShadowsEnabled?(): boolean;
  setAnnotationsVisibility?(enabled: boolean): void;
  isAnnotationsVisible?(): boolean;
  onElementSelected(callback: (id: string | null) => void): void;
  onElementHovered(callback: (id: string | null) => void): void;
  onFpsUpdate?(callback: (fps: number) => void): void;
  onCameraChange?(callback: (camera: any, target: any) => void): () => void;
  orbitCamera?(deltaX: number, deltaY: number): void;
}
