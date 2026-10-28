import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RulePanel } from './RulePanel';
import { AppContext } from '../state/AppContext';
import { createInitialState } from '../state/store';
import type { JnnModel, JnnElement } from '../domain/model';
import * as clashExport from '../clash/clashExport';

describe('RulePanel Component', () => {
  let mockModel: JnnModel;
  let mockViewer: any;
  let mockDispatch: any;

  beforeEach(() => {
    vi.restoreAllMocks();

    const sampleElements: JnnElement[] = [
      {
        modelId: 'test-model',
        modelRevisionId: 'rev-1',
        sourceFormat: 'IFC',
        sourceElementId: 'src-1',
        globalId: 'guid-ok-wall',
        id: 'el-ok-wall',
        name: 'W-200-Exterior',
        category: 'IfcWall',
        type: 'Wall Standard',
        material: 'Concrete',
        storey: 'Level 1',
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        geometryStatus: 'ok',
        importWarnings: [],
        meshRefs: [
          {
            bundleId: 'b1',
            chunk: 0,
            primitive: { kind: 'box', center: [2.5, 0.1, 1.5], size: [5, 0.2, 3], rotationZ: 0 },
          },
        ],
        quantities: [],
        properties: [
          {
            name: 'Dimensions',
            properties: {
              Width: 0.2,
              Height: 3.0,
            },
          },
        ],
      },
      {
        modelId: 'test-model',
        modelRevisionId: 'rev-1',
        sourceFormat: 'IFC',
        sourceElementId: 'src-2',
        globalId: 'guid-bad-wall',
        id: 'el-bad-wall',
        name: 'Basic Wall: Generic - 200mm', // Vi phạm R-NAM-01
        category: 'IfcWall',
        type: 'Wall Standard',
        material: 'Concrete',
        storey: '', // Vi phạm R-SPA-01
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        geometryStatus: 'ok',
        importWarnings: [],
        meshRefs: [
          {
            bundleId: 'b1',
            chunk: 1,
            primitive: { kind: 'box', center: [12.5, 10.1, 1.5], size: [5, 0.2, 3], rotationZ: 0 },
          },
        ],
        quantities: [],
        properties: [], // Vi phạm R-PROP-01
      },
      {
        modelId: 'test-model',
        modelRevisionId: 'rev-1',
        sourceFormat: 'IFC',
        sourceElementId: 'src-3',
        globalId: 'guid-bad-geom',
        id: 'el-bad-geom',
        name: 'C-300-Column',
        category: 'IfcColumn',
        type: 'Column Standard',
        material: 'Concrete',
        storey: 'Level 2',
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        geometryStatus: 'ok',
        importWarnings: [],
        meshRefs: [
          {
            bundleId: 'b1',
            chunk: 2,
            primitive: { kind: 'box', center: [0, 0, 0], size: [0, 0, 0], rotationZ: 0 }, // Vi phạm R-GEO-01
          },
        ],
        quantities: [],
        properties: [
          {
            name: 'Dimensions',
            properties: {
              Width: 0.3,
              Depth: 0.3,
            },
          },
        ],
      },
    ];

    mockModel = {
      schemaVersion: '1.0',
      modelId: 'test-model',
      modelRevisionId: 'rev-1',
      name: 'Test Model.ifc',
      projectName: 'Test Project',
      siteName: 'Test Site',
      buildingName: 'Test Building',
      sourceFormat: 'IFC',
      units: 'm',
      upAxis: 'Z',
      elements: sampleElements,
      storeys: [
        { id: 'lvl-1', name: 'Level 1', elevation: 0 },
        { id: 'lvl-2', name: 'Level 2', elevation: 3.5 },
      ],
    };

    mockViewer = {
      highlight: vi.fn(),
      fitToView: vi.fn(),
    };

    mockDispatch = vi.fn();
  });

  const renderWithContext = (stateOverride?: any) => {
    const initialState = createInitialState(mockModel, 'light');
    const state = {
      ...initialState,
      ...stateOverride,
    };

    return render(
      <AppContext.Provider
        value={{
          state,
          dispatch: mockDispatch,
          viewer: mockViewer,
        }}
      >
        <RulePanel />
      </AppContext.Provider>,
    );
  };

  it('renders rule list with 5 built-in rules initially enabled', () => {
    renderWithContext();

    expect(screen.getByTestId('rule-panel')).toBeDefined();
    expect(screen.getByText('Kiểm tra Quy tắc')).toBeDefined();
    expect(screen.getByTestId('run-rules-btn')).toBeDefined();
    expect(screen.getByTestId('export-rules-html-btn')).toBeDefined();

    // Check all 5 rules rendered
    expect(screen.getByTestId('rule-toggle-R-GEO-01')).toBeDefined();
    expect(screen.getByTestId('rule-toggle-R-SPA-01')).toBeDefined();
    expect(screen.getByTestId('rule-toggle-R-NAM-01')).toBeDefined();
    expect(screen.getByTestId('rule-toggle-R-PROP-01')).toBeDefined();
    expect(screen.getByTestId('rule-toggle-R-DUP-01')).toBeDefined();

    // All checkboxes should be checked
    const toggleGeo = screen.getByTestId('rule-toggle-R-GEO-01') as HTMLInputElement;
    expect(toggleGeo.checked).toBe(true);
  });

  it('toggles rule checkboxes and toggle all button', () => {
    renderWithContext();

    const toggleGeo = screen.getByTestId('rule-toggle-R-GEO-01') as HTMLInputElement;
    fireEvent.click(toggleGeo);
    expect(toggleGeo.checked).toBe(false);

    const toggleAllBtn = screen.getByTestId('toggle-all-rules-btn');
    // First click to select all
    fireEvent.click(toggleAllBtn);
    expect(toggleGeo.checked).toBe(true);

    // Second click to deselect all
    fireEvent.click(toggleAllBtn);
    expect(toggleGeo.checked).toBe(false);

    // When all rules deselected, run button should be disabled
    const runBtn = screen.getByTestId('run-rules-btn');
    expect(runBtn.hasAttribute('disabled')).toBe(true);
  });

  it('runs rule check, displays violation statistics and issues list', async () => {
    renderWithContext();

    const runBtn = screen.getByTestId('run-rules-btn');
    fireEvent.click(runBtn);

    // Wait for check execution
    await waitFor(() => {
      expect(screen.getByTestId('stat-total-violations')).toBeDefined();
    });

    const totalViolations = screen.getByTestId('stat-total-violations');
    const errors = screen.getByTestId('stat-errors');
    const warnings = screen.getByTestId('stat-warnings');

    // el-bad-geom vi phạm R-GEO-01 (1 Error)
    // el-bad-wall vi phạm R-SPA-01 (1 Warning), R-NAM-01 (1 Warning), R-PROP-01 (1 Warning)
    // Tổng = 4 vi phạm (1 Error, 3 Warnings)
    expect(Number(totalViolations.textContent)).toBe(4);
    expect(Number(errors.textContent)).toBe(1);
    expect(Number(warnings.textContent)).toBe(3);

    // Check specific issues rendered
    expect(screen.getAllByText('Basic Wall: Generic - 200mm').length).toBeGreaterThan(0);
    expect(screen.getByText('C-300-Column')).toBeDefined();
  });

  it('filters issues by severity and search query', async () => {
    renderWithContext();

    fireEvent.click(screen.getByTestId('run-rules-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('stat-total-violations')).toBeDefined();
    });

    const severitySelect = screen.getByTestId('rule-severity-filter');
    const searchInput = screen.getByTestId('rule-search-input');

    // Filter by Error only
    fireEvent.change(severitySelect, { target: { value: 'Error' } });
    expect(screen.getByText('C-300-Column')).toBeDefined();
    expect(screen.queryByText('Basic Wall: Generic - 200mm')).toBeNull();

    // Reset severity and search by keyword
    fireEvent.change(severitySelect, { target: { value: 'ALL' } });
    fireEvent.change(searchInput, { target: { value: 'Generic' } });

    expect(screen.getAllByText('Basic Wall: Generic - 200mm').length).toBeGreaterThan(0);
    expect(screen.queryByText('C-300-Column')).toBeNull();
  });

  it('interacts with 3D viewer on issue click (highlight and fitToView)', async () => {
    renderWithContext();

    fireEvent.click(screen.getByTestId('run-rules-btn'));

    await waitFor(() => {
      expect(screen.getByText('C-300-Column')).toBeDefined();
    });

    const issueCard = screen.getByText('C-300-Column').closest('[data-testid^="rule-issue-"]')!;
    fireEvent.click(issueCard);

    expect(mockViewer.highlight).toHaveBeenCalledWith(new Map([['el-bad-geom', '#ef4444']]));
    expect(mockViewer.fitToView).toHaveBeenCalledWith(['el-bad-geom']);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'select',
      ids: ['el-bad-geom'],
      mode: 'replace',
    });
  });

  it('exports standalone HTML report on export button click', async () => {
    const downloadSpy = vi.spyOn(clashExport, 'downloadFile').mockImplementation(() => {});

    renderWithContext();

    // Export button initially disabled before run
    const exportBtn = screen.getByTestId('export-rules-html-btn');
    expect(exportBtn.hasAttribute('disabled')).toBe(true);

    // Run check
    fireEvent.click(screen.getByTestId('run-rules-btn'));

    await waitFor(() => {
      expect(exportBtn.hasAttribute('disabled')).toBe(false);
    });

    fireEvent.click(exportBtn);

    expect(downloadSpy).toHaveBeenCalledTimes(1);
    const call = downloadSpy.mock.calls[0];
    expect(call).toBeDefined();
    const [htmlContent, filename] = call!;
    expect(typeof htmlContent).toBe('string');
    expect(htmlContent).toContain('Báo cáo Kiểm tra Chất lượng Mô hình BIM');
    expect(htmlContent).toContain('Test Model.ifc');
    expect(filename).toMatch(/Bao_cao_kiem_tra_quy_tac_.*\.html/);
  });
});
