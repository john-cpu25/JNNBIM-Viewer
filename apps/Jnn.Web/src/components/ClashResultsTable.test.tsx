import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ClashResultsTable } from './ClashResultsTable';
import type { ClashRecord } from '../clash/clashResults';
import { AppContext, type AppContextValue } from '../state/AppContext';
import { createInitialState } from '../state/store';
import { createEmptyModel } from '../domain/model';
import type { ViewerAdapter } from '../viewer/ViewerAdapter';

const mockViewer = {
  highlight: vi.fn(),
  fitToView: vi.fn(),
  setSection: vi.fn(),
} as unknown as ViewerAdapter;

const mockCtx: AppContextValue = {
  state: createInitialState(createEmptyModel(), 'light'),
  dispatch: vi.fn(),
  viewer: mockViewer,
};

function renderWithApp(ui: React.ReactElement) {
  return render(<AppContext.Provider value={mockCtx}>{ui}</AppContext.Provider>);
}

const mockRecords: ClashRecord[] = [
  {
    clashId: 'c1',
    testId: 't1',
    name: 'Clash 1',
    status: 'New',
    type: 'Hard',
    distance: 0,
    aId: 'el-1',
    bId: 'el-2',
    aName: 'Column C1',
    bName: 'Beam B1',
    aStorey: 'Level 1',
    point: [1, 2, 3],
    firstFoundAt: 1000,
    lastFoundAt: 1000,
  },
  {
    clashId: 'c2',
    testId: 't1',
    name: 'Clash 2',
    status: 'Active',
    type: 'Clearance',
    distance: 0.025,
    aId: 'el-3',
    bId: 'el-4',
    aName: 'HVAC Duct',
    bName: 'Slab S1',
    aStorey: 'Level 2',
    point: [4, 5, 6],
    firstFoundAt: 1000,
    lastFoundAt: 2000,
  },
  {
    clashId: 'c3',
    testId: 't1',
    name: 'Clash 3',
    status: 'Resolved',
    type: 'Hard',
    distance: 0,
    aId: 'el-5',
    bId: 'el-6',
    aName: 'Pipe P1',
    bName: 'Wall W1',
    aStorey: 'Level 1',
    point: [7, 8, 9],
    firstFoundAt: 1000,
    lastFoundAt: 1000,
  },
];

describe('ClashResultsTable component & interactive review', () => {
  it('renders table columns, rows and status badges', () => {
    renderWithApp(
      <ClashResultsTable
        testId="t1"
        records={mockRecords}
        selectedClashId={null}
        onSelectClash={vi.fn()}
        onUpdateRecord={vi.fn()}
      />,
    );

    expect(screen.getByText('Clash 1')).toBeInTheDocument();
    expect(screen.getByText('Clash 2')).toBeInTheDocument();
    expect(screen.getByText('Clash 3')).toBeInTheDocument();

    expect(screen.getByText('Column C1')).toBeInTheDocument();
    expect(screen.getByText('HVAC Duct')).toBeInTheDocument();
    expect(screen.getByText('0.025 m')).toBeInTheDocument();
  });

  it('filters rows by status and search query', async () => {
    const user = userEvent.setup();
    renderWithApp(
      <ClashResultsTable
        testId="t1"
        records={mockRecords}
        selectedClashId={null}
        onSelectClash={vi.fn()}
        onUpdateRecord={vi.fn()}
      />,
    );

    // Filter by status Active
    const statusSelect = screen.getByTestId('status-filter-select');
    await user.selectOptions(statusSelect, 'Active');

    expect(screen.queryByText('Clash 1')).not.toBeInTheDocument();
    expect(screen.getByText('Clash 2')).toBeInTheDocument();
    expect(screen.queryByText('Clash 3')).not.toBeInTheDocument();

    // Reset status filter and search query
    await user.selectOptions(statusSelect, 'ALL');
    const searchInput = screen.getByTestId('clash-search-input');
    await user.type(searchInput, 'Pipe');

    expect(screen.queryByText('Clash 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Clash 2')).not.toBeInTheDocument();
    expect(screen.getByText('Clash 3')).toBeInTheDocument();
  });

  it('selects a clash and updates status, comments, assignedTo', async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();
    const handleUpdate = vi.fn();

    renderWithApp(
      <ClashResultsTable
        testId="t1"
        records={mockRecords}
        selectedClashId="c1"
        onSelectClash={handleSelect}
        onUpdateRecord={handleUpdate}
      />,
    );

    // Inspector is visible for selected clash c1
    expect(screen.getByTestId('clash-inspector')).toBeInTheDocument();

    // Click quick status button Reviewed
    const reviewedBtn = screen.getByTestId('set-status-reviewed');
    await user.click(reviewedBtn);
    expect(handleUpdate).toHaveBeenCalledWith('c1', { status: 'Reviewed' });

    // Type comment
    const commentsInput = screen.getByTestId('comments-input');
    fireEvent.change(commentsInput, { target: { value: 'Needs redesign' } });
    expect(handleUpdate).toHaveBeenCalledWith('c1', { comments: 'Needs redesign' });
  });

  it('supports keyboard navigation with arrow keys and 1-5 status keys with benchmark < 100ms/clash', () => {
    // Generate 50 mock clashes to test benchmark
    const fiftyClashes: ClashRecord[] = Array.from({ length: 50 }, (_, i) => ({
      clashId: `clash_${i + 1}`,
      testId: 't1',
      name: `Clash ${i + 1}`,
      status: 'New',
      type: 'Hard',
      distance: 0,
      aId: `a_${i}`,
      bId: `b_${i}`,
      aName: `Element A ${i}`,
      bName: `Element B ${i}`,
      point: [i, i, i],
      firstFoundAt: 1000,
      lastFoundAt: 1000,
    }));

    let currentSelectedId: string | null = 'clash_1';
    const handleSelect = vi.fn((id: string | null) => {
      currentSelectedId = id;
    });
    const handleUpdate = vi.fn();

    const { rerender } = render(
      <AppContext.Provider value={mockCtx}>
        <ClashResultsTable
          testId="t1"
          records={fiftyClashes}
          selectedClashId={currentSelectedId}
          onSelectClash={handleSelect}
          onUpdateRecord={handleUpdate}
        />
      </AppContext.Provider>,
    );

    const tableHost = screen.getByTestId('clash-results-container');

    // Benchmark 50 sequential Down arrow navigation events
    const t0 = performance.now();
    for (let i = 0; i < 50; i++) {
      fireEvent.keyDown(tableHost, { key: 'ArrowDown', code: 'ArrowDown' });
      rerender(
        <AppContext.Provider value={mockCtx}>
          <ClashResultsTable
            testId="t1"
            records={fiftyClashes}
            selectedClashId={currentSelectedId}
            onSelectClash={handleSelect}
            onUpdateRecord={handleUpdate}
          />
        </AppContext.Provider>,
      );
    }
    const tTotal = performance.now() - t0;
    const avgTimePerClash = tTotal / 50;

    console.log(
      `[Benchmark T13.3] Navigating 50 clashes: Total ${tTotal.toFixed(2)}ms, Avg ${avgTimePerClash.toFixed(3)}ms/clash`,
    );

    // Criterion: nav mượt (< 100ms/clash)
    expect(avgTimePerClash).toBeLessThan(100);

    // Test shortcut key '3' for Reviewed status
    fireEvent.keyDown(tableHost, { key: '3', code: 'Digit3' });
    expect(handleUpdate).toHaveBeenCalledWith(expect.any(String), { status: 'Reviewed' });
  });
});
