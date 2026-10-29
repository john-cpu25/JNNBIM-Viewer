import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ViewCube } from './ViewCube';
import { AppContext } from '../state/AppContext';
import { createSampleModel } from '../domain/sampleModel';
import { createInitialState } from '../state/store';

describe('ViewCube 3D component', () => {
  it('renders 3D ViewCube container and canvas', () => {
    const model = createSampleModel();
    const state = createInitialState(model, 'light');
    render(
      <AppContext.Provider value={{ state, dispatch: () => {}, viewer: null }}>
        <ViewCube />
      </AppContext.Provider>,
    );

    const cube = screen.getByTestId('viewcube-3d');
    expect(cube).toBeInTheDocument();
    expect(screen.getByTestId('viewcube-canvas')).toBeInTheDocument();
  });

  it('handles pointer events on canvas without crashing', () => {
    const model = createSampleModel();
    const state = createInitialState(model, 'light');
    const fakeViewer: any = {
      getCamera: () => ({ ok: true, value: { position: [10, 10, 10], target: [0, 0, 0], projection: 'perspective' } }),
      on: () => () => {},
      orbitBy: () => ({ ok: true }),
      setViewPreset: () => ({ ok: true }),
    };

    render(
      <AppContext.Provider value={{ state, dispatch: () => {}, viewer: fakeViewer }}>
        <ViewCube />
      </AppContext.Provider>,
    );

    const canvas = screen.getByTestId('viewcube-canvas');
    canvas.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 50 }));
    canvas.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 60, clientY: 50 }));
    canvas.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 60, clientY: 50 }));
    expect(canvas).toBeInTheDocument();
  });
});
