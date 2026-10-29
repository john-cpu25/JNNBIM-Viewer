import { ThreeViewerAdapter, type RendererLike } from './ThreeViewerAdapter';
import { createSampleModel } from '../domain/sampleModel';

function fakeRenderer(): RendererLike & { renders: number } {
  const r = {
    domElement: document.createElement('canvas'),
    localClippingEnabled: false,
    renders: 0,
    setPixelRatio() {},
    setSize() {},
    setClearColor() {},
    render() {
      r.renders++;
    },
    dispose() {},
  };
  return r;
}

async function setup() {
  const renderer = fakeRenderer();
  const v = new ThreeViewerAdapter({ createRenderer: () => renderer, manualRender: true });
  const host = document.createElement('div');
  document.body.appendChild(host);
  v.mount(host);
  const model = createSampleModel();
  const res = await v.loadModel(model);
  return { v, model, res, renderer };
}

describe('ThreeViewerAdapter (no WebGL)', () => {
  it('loads every element and reports bounds', async () => {
    const { v, res, model } = await setup();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.elementCount).toBe(model.elements.length);
    expect(res.value.bounds.max[0]).toBeGreaterThan(24);
    expect(v.debugState().visibleCount).toBe(model.elements.length);
    v.dispose();
  });

  it('declares its capabilities', async () => {
    const { v } = await setup();
    for (const c of ['select', 'isolate', 'sectionPlane', 'sectionBox', 'xray'] as const) expect(v.capabilities.has(c)).toBe(true);
    v.dispose();
  });

  it('selects, rejects unknown ids, and returns properties', async () => {
    const { v, model } = await setup();
    const id = model.elements[5]!.id;
    expect(v.select([id]).ok).toBe(true);
    expect(v.debugState().selected).toEqual([id]);
    const bad = v.select(['missing']);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.code).toBe('not-found');
    const p = v.getProperties(id);
    expect(p.ok && p.value.element.globalId).toBe(model.elements[5]!.globalId);
    v.dispose();
  });

  it('hides and isolates', async () => {
    const { v, model } = await setup();
    const ids = model.elements.slice(0, 10).map((e) => e.id);
    v.setHidden(ids.slice(0, 3));
    expect(v.debugState().visibleCount).toBe(model.elements.length - 3);
    v.isolate(ids);
    expect(v.debugState().visibleCount).toBe(7);
    v.isolate([]);
    v.setHidden([]);
    expect(v.debugState().visibleCount).toBe(model.elements.length);
    v.dispose();
  });

  it('applies section planes in model coordinates (+Z up)', async () => {
    const { v } = await setup();
    v.setSection({ kind: 'plane', axis: 'z', offset: 1.25, flipped: false });
    expect(v.debugState().clipPlaneCount).toBe(1);
    expect(v.isPointClipped([5, 5, 0.5])).toBe(false);
    expect(v.isPointClipped([5, 5, 2])).toBe(true);
    v.setSection({ kind: 'plane', axis: 'z', offset: 1.25, flipped: true });
    expect(v.isPointClipped([5, 5, 2])).toBe(false);
    v.setSection({ kind: 'plane', axis: 'y', offset: 7, flipped: false });
    expect(v.isPointClipped([0, 6, 0])).toBe(false);
    expect(v.isPointClipped([0, 8, 0])).toBe(true);
    v.dispose();
  });

  it('applies and validates section boxes', async () => {
    const { v } = await setup();
    expect(v.setSection({ kind: 'box', min: [0, 0, 0], max: [6, 5, 3.6] }).ok).toBe(true);
    expect(v.debugState().clipPlaneCount).toBe(6);
    expect(v.isPointClipped([3, 2, 1])).toBe(false);
    expect(v.isPointClipped([7, 2, 1])).toBe(true);
    expect(v.isPointClipped([3, -1, 1])).toBe(true);
    const bad = v.setSection({ kind: 'box', min: [1, 0, 0], max: [0, 1, 1] });
    expect(bad.ok).toBe(false);
    v.setSection(null);
    expect(v.debugState().clipPlaneCount).toBe(0);
    v.dispose();
  });

  it('switches projection and keeps camera state in model coordinates', async () => {
    const { v } = await setup();
    v.setViewPreset('top', false);
    const cam = v.getCamera();
    expect(cam.ok).toBe(true);
    if (cam.ok) expect(cam.value.position[2]).toBeGreaterThan(cam.value.target[2]); // looking down
    v.setProjection('orthographic');
    expect(v.debugState().projection).toBe('orthographic');
    v.setProjection('perspective');
    expect(v.debugState().projection).toBe('perspective');
    v.dispose();
  });

  it('toggles grid visibility', async () => {
    const { v } = await setup();
    const resOff = v.setGridVisible(false);
    expect(resOff.ok).toBe(true);
    const resOn = v.setGridVisible(true);
    expect(resOn.ok).toBe(true);
    v.dispose();
  });

  it('fails clearly before a model is loaded', () => {
    const v = new ThreeViewerAdapter({ createRenderer: fakeRenderer, manualRender: true });
    const r = v.fitToView();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('not-loaded');
  });
});
