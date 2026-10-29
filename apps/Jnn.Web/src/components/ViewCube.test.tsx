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
});
