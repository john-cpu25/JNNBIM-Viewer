import { test, expect } from '@playwright/test';
import { openViewer } from './helpers';
import * as path from 'path';

test.describe('Clash Detective UI, Results & Viewer interaction', () => {
  test('creates clash test, runs detection, inspects clash result with red/green highlight & section box', async ({
    page,
  }) => {
    await openViewer(page);

    // 1. Switch to Clash tab
    const clashTab = page.getByTestId('tab-clash-btn');
    await expect(clashTab).toBeVisible();
    await clashTab.click();

    // 2. Clash panel should be displayed
    const clashPanel = page.getByTestId('clash-panel');
    await expect(clashPanel).toBeVisible();

    // 3. Add a new test
    const addBtn = page.getByTestId('add-test-btn');
    await addBtn.click();

    // Apply preset
    const presetBtn = page.getByTestId('preset-btn-0');
    await presetBtn.click();

    // 4. Click Run
    const runBtn = page.getByTestId('run-test-btn');
    await expect(runBtn).toBeEnabled();
    await runBtn.click();

    // 5. Detection completes and automatically switches to results table
    const resultsTable = page.getByTestId('clash-results-table');
    await expect(resultsTable).toBeVisible({ timeout: 15_000 });

    // Check that at least one row exists
    const firstRow = page.getByTestId(/clash-row-/).first();
    await expect(firstRow).toBeVisible();

    // Click on the clash row to inspect and highlight
    await firstRow.click();

    // Inspector should be visible
    const inspector = page.getByTestId('clash-inspector');
    await expect(inspector).toBeVisible();

    // Turn on section box
    const sectionBoxCheck = page.getByTestId('section-box-checkbox');
    await sectionBoxCheck.check();

    // Change status to Reviewed
    const reviewedBtn = page.getByTestId('set-status-reviewed');
    await reviewedBtn.click();
    await expect(page.getByTestId('clash-inspector')).toContainText('Reviewed');

    // Settle camera / renderer
    await page.waitForTimeout(500);

    // Take screenshot showing red/green highlight and clash inspector
    const screenshotDir = path.resolve(process.cwd(), '../../../TODO/2_Review');
    const screenshotPath = path.join(screenshotDir, 'T13.2_clash_view.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // 6. Test persistence across reload
    await page.reload();
    await expect(page.getByTestId('viewer-host')).toHaveAttribute('data-status', 'ready', {
      timeout: 20_000,
    });

    await page.getByTestId('tab-clash-btn').click();
    await expect(page.getByTestId('test-list')).toContainText('Kết cấu × Kiến trúc (Hard)');
  });
});
