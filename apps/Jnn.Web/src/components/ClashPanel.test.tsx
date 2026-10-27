import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from '../App';

describe('ClashPanel UI & Clash Detective workflow', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('switches between Properties and Clash tabs', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Default tab is Properties
    expect(screen.getByTestId('properties-body')).toBeInTheDocument();

    // Click Clash tab
    const clashTabBtn = screen.getByTestId('tab-clash-btn');
    await user.click(clashTabBtn);

    // Clash panel is rendered
    expect(screen.getByTestId('clash-panel')).toBeInTheDocument();
    expect(screen.getByText('Clash Detective')).toBeInTheDocument();

    // Switch back to Properties
    const propTabBtn = screen.getByTestId('tab-properties-btn');
    await user.click(propTabBtn);
    expect(screen.getByTestId('properties-body')).toBeInTheDocument();
  });

  it('performs CRUD operations on clash tests: add, rename, duplicate, delete', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Switch to Clash panel
    await user.click(screen.getByTestId('tab-clash-btn'));
    expect(screen.getByTestId('clash-panel')).toBeInTheDocument();

    // Add a new test
    const addBtn = screen.getByTestId('add-test-btn');
    await user.click(addBtn);

    // Should now have at least 2 tests in list
    const testList = screen.getByTestId('test-list');
    expect(within(testList).getByText('Test 2')).toBeInTheDocument();

    // Rename the active test
    const nameInput = screen.getByTestId('test-name-input');
    await user.clear(nameInput);
    await user.type(nameInput, 'Custom Test A');
    expect(within(testList).getByText('Custom Test A')).toBeInTheDocument();

    // Duplicate test
    const duplicateBtns = screen.getAllByTitle('Nhân bản bài test này');
    await user.click(duplicateBtns[duplicateBtns.length - 1]!);
    expect(within(testList).getByText('Custom Test A (Copy)')).toBeInTheDocument();

    // Delete test
    const deleteBtns = screen.getAllByTitle('Xóa bài test này');
    const countBefore = screen.getAllByTestId(/test-item-/).length;
    await user.click(deleteBtns[deleteBtns.length - 1]!);
    const countAfter = screen.getAllByTestId(/test-item-/).length;
    expect(countAfter).toBe(countBefore - 1);
  });

  it('validates tolerance input and disables run button on invalid input', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('tab-clash-btn'));

    const toleranceInput = screen.getByTestId('tolerance-input');
    const runBtn = screen.getByTestId('run-test-btn');

    // Valid initially
    expect(screen.queryByTestId('validation-error')).not.toBeInTheDocument();
    expect(runBtn).not.toBeDisabled();

    // Enter negative tolerance
    await user.clear(toleranceInput);
    await user.type(toleranceInput, '-0.05');

    // Shows validation error and disables run button
    expect(screen.getByTestId('validation-error')).toHaveTextContent(
      'Dung sai (tolerance) không được là số âm hoặc rỗng',
    );
    expect(runBtn).toBeDisabled();

    // Fix tolerance
    await user.clear(toleranceInput);
    await user.type(toleranceInput, '0.02');
    expect(screen.queryByTestId('validation-error')).not.toBeInTheDocument();
    expect(runBtn).not.toBeDisabled();
  });

  it('applies preset templates to active test', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('tab-clash-btn'));

    // Click MEP x MEP clearance preset
    const presetBtn = screen.getByTestId('preset-btn-2');
    await user.click(presetBtn);

    const nameInput = screen.getByTestId('test-name-input');
    expect(nameInput).toHaveValue('MEP × MEP (Clearance 50mm)');

    const typeSelect = screen.getByTestId('clash-type-select');
    expect(typeSelect).toHaveValue('Clearance');

    const tolInput = screen.getByTestId('tolerance-input');
    expect(tolInput).toHaveValue(0.05);

    const sameModelCheck = screen.getByTestId('ignore-same-model-checkbox');
    expect(sameModelCheck).toBeChecked();
  });
});
