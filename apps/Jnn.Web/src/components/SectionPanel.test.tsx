import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SectionPanel } from './SectionPanel';
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
    getModelBounds: vi.fn().mockReturnValue({ ok: true, value: { min: [-10, -10, 0], max: [10, 10, 10] } }),
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

describe('SectionPanel component', () => {
  it('renders section box with X, Y, Z inputs and range sliders', () => {
    const { getByTestId, getAllByRole } = renderWithContext(
      <SectionPanel />,
      {
        section: { kind: 'box', min: [-5, -5, 0], max: [5, 5, 4] },
      }
    );

    expect(getByTestId('section-panel')).toBeDefined();
    expect(getByTestId('section-box-min-x')).toBeDefined();
    expect(getByTestId('section-box-max-x')).toBeDefined();
    expect(getByTestId('section-fit-selection')).toBeDefined();
    expect(getByTestId('section-fit-model')).toBeDefined();

    const rangeSliders = getAllByRole('slider');
    expect(rangeSliders.length).toBeGreaterThanOrEqual(6); // 2 thumbs * 3 axes
  });

  it('dispatches setSectionFrameVisible when frame toggle eye button is clicked', () => {
    const { getByTestId, dispatch } = renderWithContext(
      <SectionPanel />,
      {
        section: { kind: 'box', min: [-5, -5, 0], max: [5, 5, 4] },
        sectionFrameVisible: true,
      }
    );

    const toggleBtn = getByTestId('section-frame-toggle');
    fireEvent.click(toggleBtn);

    expect(dispatch).toHaveBeenCalledWith({
      type: 'setSectionFrameVisible',
      visible: false,
    });
  });

  it('dispatches setSection when fit model button is clicked', () => {
    const { getByTestId, dispatch } = renderWithContext(
      <SectionPanel />,
      {
        section: { kind: 'box', min: [-5, -5, 0], max: [5, 5, 4] },
      }
    );

    const fitModelBtn = getByTestId('section-fit-model');
    fireEvent.click(fitModelBtn);

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'setSection',
        section: expect.objectContaining({ kind: 'box' }),
      })
    );
  });

  it('renders plane controls when section kind is plane', () => {
    const { getByTestId, getByText } = renderWithContext(
      <SectionPanel />,
      {
        section: { kind: 'plane', axis: 'z', offset: 1.2, flipped: false },
      }
    );

    expect(getByTestId('section-panel')).toBeDefined();
    expect(getByTestId('section-offset')).toBeDefined();
    expect(getByText(/Cắt theo mặt/i)).toBeDefined();
  });
});
