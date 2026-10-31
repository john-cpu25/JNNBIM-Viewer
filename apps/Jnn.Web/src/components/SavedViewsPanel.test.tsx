import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SavedViewsPanel } from './SavedViewsPanel';
import { AppContext } from '../state/AppContext';
import { createInitialState } from '../state/store';
import { createSampleModel } from '../domain/sampleModel';
import type { AppState } from '../state/store';
import type { ViewerAdapter } from '../viewer/ViewerAdapter';
import type { SavedView } from '../lib/savedViews';

function renderWithContext(
  ui: React.ReactElement,
  stateOverrides: Partial<AppState> = {},
  viewerOverrides: Partial<ViewerAdapter> = {},
) {
  const model = createSampleModel();
  const baseState = createInitialState(model, 'light');
  const state: AppState = { ...baseState, ...stateOverrides };
  const dispatch = vi.fn((action) => {
    if (action.type === 'addSavedView') {
      state.savedViews = [action.view, ...state.savedViews];
    } else if (action.type === 'deleteSavedView') {
      state.savedViews = state.savedViews.filter((v) => v.id !== action.id);
    } else if (action.type === 'renameSavedView') {
      state.savedViews = state.savedViews.map((v) => (v.id === action.id ? { ...v, name: action.name } : v));
    }
  });

  const mockViewer: ViewerAdapter = {
    getCamera: vi.fn().mockReturnValue({
      ok: true,
      value: { position: [10, 20, 30], target: [0, 0, 0], projection: 'perspective' },
    }),
    setCamera: vi.fn(),
    setSection: vi.fn(),
    isolate: vi.fn(),
    setHidden: vi.fn(),
    setXray: vi.fn(),
    captureScreenshot: vi.fn().mockResolvedValue('data:image/jpeg;base64,sample'),
    on: vi.fn().mockReturnValue(() => {}),
    ...viewerOverrides,
  } as unknown as ViewerAdapter;

  const result = render(
    <AppContext.Provider value={{ state, dispatch, viewer: mockViewer }}>
      {ui}
    </AppContext.Provider>,
  );

  return { ...result, dispatch, state, mockViewer };
}

describe('SavedViewsPanel', () => {
  it('renders empty state initially', () => {
    renderWithContext(<SavedViewsPanel />, { savedViews: [] });

    expect(screen.getByTestId('save-view-btn')).toBeInTheDocument();
    expect(screen.getByText(/Chưa có góc nhìn nào/i)).toBeInTheDocument();
  });

  it('renders saved views list with cards', () => {
    const sampleView: SavedView = {
      id: 'v-1',
      name: 'Góc nhìn kiểm tra',
      camera: { position: [1, 2, 3], target: [0, 0, 0], projection: 'perspective' },
      section: null,
      visibility: { hidden: [], isolated: [] },
      xray: false,
      thumbnail: '',
      createdAt: Date.now(),
    };

    renderWithContext(<SavedViewsPanel />, { savedViews: [sampleView] });

    expect(screen.getByTestId('saved-views-list')).toBeInTheDocument();
    expect(screen.getByText('Góc nhìn kiểm tra')).toBeInTheDocument();
    expect(screen.getByTestId('rename-view-btn')).toBeInTheDocument();
    expect(screen.getByTestId('delete-view-btn')).toBeInTheDocument();
  });

  it('applies saved view when card is clicked', () => {
    const sampleView: SavedView = {
      id: 'v-1',
      name: 'Góc nhìn 1',
      camera: { position: [10, 20, 30], target: [0, 0, 0], projection: 'perspective' },
      section: null,
      visibility: { hidden: [], isolated: [] },
      xray: false,
      thumbnail: '',
      createdAt: Date.now(),
    };

    const { mockViewer, dispatch } = renderWithContext(<SavedViewsPanel />, { savedViews: [sampleView] });

    const card = screen.getByTestId('saved-view-card');
    fireEvent.click(card);

    expect(mockViewer.setCamera).toHaveBeenCalledWith(sampleView.camera, true);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'applySavedView', view: sampleView }));
  });

  it('deletes saved view when delete button is clicked', () => {
    const sampleView: SavedView = {
      id: 'v-delete',
      name: 'Góc nhìn xóa',
      camera: { position: [1, 2, 3], target: [0, 0, 0], projection: 'perspective' },
      section: null,
      visibility: { hidden: [], isolated: [] },
      xray: false,
      thumbnail: '',
      createdAt: Date.now(),
    };

    const { dispatch } = renderWithContext(<SavedViewsPanel />, { savedViews: [sampleView] });

    const deleteBtn = screen.getByTestId('delete-view-btn');
    fireEvent.click(deleteBtn);

    expect(dispatch).toHaveBeenCalledWith({ type: 'deleteSavedView', id: 'v-delete' });
  });

  it('renames saved view with inline input', () => {
    const sampleView: SavedView = {
      id: 'v-rename',
      name: 'Tên cũ',
      camera: { position: [1, 2, 3], target: [0, 0, 0], projection: 'perspective' },
      section: null,
      visibility: { hidden: [], isolated: [] },
      xray: false,
      thumbnail: '',
      createdAt: Date.now(),
    };

    const { dispatch } = renderWithContext(<SavedViewsPanel />, { savedViews: [sampleView] });

    const renameBtn = screen.getByTestId('rename-view-btn');
    fireEvent.click(renameBtn);

    const input = screen.getByTestId('view-name-input');
    fireEvent.change(input, { target: { value: 'Tên mới' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(dispatch).toHaveBeenCalledWith({ type: 'renameSavedView', id: 'v-rename', name: 'Tên mới' });
  });
});
