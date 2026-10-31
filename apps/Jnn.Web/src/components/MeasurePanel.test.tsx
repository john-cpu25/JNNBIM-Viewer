import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { MeasurePanel } from './MeasurePanel';
import { AppContext } from '../state/AppContext';
import { createInitialState } from '../state/store';
import { createSampleModel } from '../domain/sampleModel';
import type { AppState } from '../state/store';
import type { ViewerAdapter } from '../viewer/ViewerAdapter';

function renderWithContext(ui: React.ReactElement, stateOverrides: Partial<AppState> = {}, viewerOverrides: Partial<ViewerAdapter> = {}) {
  const model = createSampleModel();
  const baseState = createInitialState(model, 'light');
  const state: AppState = { ...baseState, ...stateOverrides };
  const dispatch = vi.fn();
  const mockViewer: ViewerAdapter = {
    clearMeasurements: vi.fn(),
    deleteMeasurement: vi.fn(),
    setMeasurementsVisible: vi.fn(),
    setMeasureTool: vi.fn(),
    setMeasureSettings: vi.fn(),
    on: vi.fn().mockReturnValue(() => {}),
    ...viewerOverrides,
  } as unknown as ViewerAdapter;

  const result = render(
    <AppContext.Provider value={{ state, dispatch, viewer: mockViewer }}>
      {ui}
    </AppContext.Provider>
  );

  return { ...result, dispatch, state, mockViewer };
}

describe('MeasurePanel component', () => {
  it('renders title, tool options, units, precision, and snapping checkboxes', () => {
    const { getByTestId } = renderWithContext(<MeasurePanel />);

    expect(getByTestId('measure-panel')).toBeDefined();
    expect(getByTestId('snap-vertex')).toBeDefined();
    expect(getByTestId('snap-edge')).toBeDefined();
    expect(getByTestId('snap-face')).toBeDefined();
    expect(getByTestId('measure-export-csv-btn')).toBeDefined();
    expect(getByTestId('measure-clear-btn')).toBeDefined();
  });

  it('toggles snapping checkboxes and dispatches setMeasureSettings', () => {
    const { getByTestId, dispatch } = renderWithContext(<MeasurePanel />);

    const vertexCb = getByTestId('snap-vertex');
    fireEvent.click(vertexCb);

    expect(dispatch).toHaveBeenCalledWith({
      type: 'setMeasureSettings',
      settings: expect.objectContaining({
        snap: expect.objectContaining({ vertex: false }),
      }),
    });
  });

  it('renders measurements list and handles delete item', () => {
    const { getByTestId, getAllByTestId, dispatch, mockViewer } = renderWithContext(<MeasurePanel />, {
      measurements: [
        {
          id: 'm1',
          tool: 'length',
          value: 1250,
          unit: 'mm',
          points: [
            [0, 0, 0],
            [1.25, 0, 0],
          ],
        },
      ],
    });

    const items = getAllByTestId('measure-item');
    expect(items.length).toBe(1);
    expect(items[0]?.textContent).toContain('1250.0 mm');

    const deleteBtn = getByTestId('delete-measure-m1');
    fireEvent.click(deleteBtn);

    expect(dispatch).toHaveBeenCalledWith({
      type: 'deleteMeasurement',
      id: 'm1',
    });
    expect(mockViewer.deleteMeasurement).toHaveBeenCalledWith('m1');
  });

  it('clears all measurements on clear button click', () => {
    const { getByTestId, dispatch, mockViewer } = renderWithContext(<MeasurePanel />, {
      measurements: [
        {
          id: 'm1',
          tool: 'length',
          value: 1250,
          unit: 'mm',
          points: [],
        },
      ],
    });

    const clearBtn = getByTestId('measure-clear-btn');
    fireEvent.click(clearBtn);

    expect(dispatch).toHaveBeenCalledWith({ type: 'clearMeasurements' });
    expect(mockViewer.clearMeasurements).toHaveBeenCalled();
  });

  it('dispatches setMeasurePanelOpen false on close button click', () => {
    const { getByTestId, dispatch } = renderWithContext(<MeasurePanel />);

    const closeBtn = getByTestId('measure-close-btn');
    fireEvent.click(closeBtn);

    expect(dispatch).toHaveBeenCalledWith({
      type: 'setMeasurePanelOpen',
      open: false,
    });
  });
});
