import { test, expect } from '@playwright/test';
import { openViewer } from './helpers';
import * as path from 'path';

test.describe('Clash Detective UI & persistence', () => {
  test('creates clash test, runs detection, persists via IndexedDB and captures UI screenshot', async ({
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

    // Rename the test
    const nameInput = page.getByTestId('test-name-input');
    await nameInput.fill('E2E Test - Walls vs Beams');

    // Apply preset
    const presetBtn = page.getByTestId('preset-btn-0');
    await presetBtn.click();

    // 4. Click Run
    const runBtn = page.getByTestId('run-test-btn');
    await expect(runBtn).toBeEnabled();
    await runBtn.click();

    // Wait for completed banner
    const completedBanner = page.getByTestId('test-completed-banner');
    await expect(completedBanner).toBeVisible({ timeout: 15_000 });

    // 5. Take screenshot of the Clash Detective UI
    const screenshotDir = path.resolve(process.cwd(), '../../../TODO/2_Review');
    const screenshotPath = path.join(screenshotDir, 'T12.3_ui.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // 6. Reload and verify persistence in IndexedDB
    await page.reload();
    await expect(page.getByTestId('viewer-host')).toHaveAttribute('data-status', 'ready', {
      timeout: 20_000,
    });

    // Re-open clash tab
    await page.getByTestId('tab-clash-btn').click();
    await expect(page.getByTestId('test-list')).toContainText('Kết cấu × Kiến trúc (Hard)');
  });
});
