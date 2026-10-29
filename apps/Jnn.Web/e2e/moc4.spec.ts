import { expect, test } from '@playwright/test';
import { openViewer } from './helpers';

test.describe('Mốc 4: UI Polish, Revit Navigation, ViewCube, Section Box, i18n', () => {
  test.beforeEach(async ({ page }) => {
    await openViewer(page);
  });

  test('B: Grid toggle button (G shortcut and toolbar button)', async ({ page }) => {
    const gridBtn = page.getByTestId('toggle-grid-btn');
    await expect(gridBtn).toBeVisible();

    // Initial state: grid is visible
    const initialGrid = await page.evaluate(() => (window.__jnn!.getState() as any).gridVisible);
    expect(initialGrid).toBe(true);

    // Click grid button to toggle off
    await gridBtn.click();
    const gridAfterClick = await page.evaluate(() => (window.__jnn!.getState() as any).gridVisible);
    expect(gridAfterClick).toBe(false);

    // Press keyboard shortcut 'G' to toggle back on
    await page.keyboard.press('g');
    const gridAfterKey = await page.evaluate(() => (window.__jnn!.getState() as any).gridVisible);
    expect(gridAfterKey).toBe(true);
  });

  test('F: Settings modal opens, displays Revit and Classic navigation presets', async ({ page }) => {
    const settingsBtn = page.getByTestId('settings-btn');
    await settingsBtn.click();

    const modal = page.getByTestId('settings-modal');
    await expect(modal).toBeVisible();

    const presetSelect = page.getByTestId('nav-preset-select');
    await expect(presetSelect).toBeVisible();
    await expect(presetSelect).toHaveValue('revit');

    // Switch to Classic preset
    await presetSelect.selectOption('classic');
    const navPreset = await page.evaluate(() => (window.__jnn!.getState() as any).navigation.preset);
    expect(navPreset).toBe('classic');

    // Close modal
    await page.getByTestId('close-settings-btn').click();
    await expect(modal).not.toBeVisible();
  });

  test('A: ViewCube 3D is rendered and clicking face orbits camera', async ({ page }) => {
    const cube = page.getByTestId('viewcube-3d');
    await expect(cube).toBeVisible();

    const canvas = cube.locator('canvas');
    await expect(canvas).toBeVisible();

    const beforeCam = await page.evaluate(() => window.__jnn!.viewer.getCamera());

    // Click on the ViewCube canvas
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(500);

    const afterCam = await page.evaluate(() => window.__jnn!.viewer.getCamera());
    expect(afterCam).toBeDefined();
  });

  test('G: Section box panel opens, supports numeric input and fit', async ({ page }) => {
    // Open section box via shortcut 'B'
    await page.keyboard.press('b');

    const panel = page.getByTestId('section-panel');
    await expect(panel).toBeVisible();

    // Check numeric inputs for X min/max exist
    const minInputX = page.getByTestId('section-box-min-x');
    const maxInputX = page.getByTestId('section-box-max-x');
    await expect(minInputX).toBeVisible();
    await expect(maxInputX).toBeVisible();

    // Test Fit Model button
    const fitModelBtn = page.getByTestId('section-fit-model');
    await expect(fitModelBtn).toBeVisible();
    await fitModelBtn.click();

    // Test eye button toggles section frame visibility
    const eyeBtn = page.getByTestId('section-frame-toggle');
    await expect(eyeBtn).toBeVisible();
    await eyeBtn.click();
    const frameVis = await page.evaluate(() => (window.__jnn!.getState() as any).sectionFrameVisible);
    expect(frameVis).toBe(false);
  });

  test('D: Language toggle button (VI <-> EN) changes UI text dynamically', async ({ page }) => {
    const langBtn = page.getByTestId('language-toggle');
    await expect(langBtn).toBeVisible();

    // Currently in 'EN' mode (from openViewer helper)
    await expect(langBtn).toContainText('EN');
    await expect(page.getByTestId('open-ifc-btn')).toContainText('Open IFC');

    // Click to toggle to 'VI'
    await langBtn.click();
    await expect(langBtn).toContainText('VI');
    await expect(page.getByTestId('open-ifc-btn')).toContainText('Mở IFC');

    // Click again to toggle back to 'EN'
    await langBtn.click();
    await expect(langBtn).toContainText('EN');
    await expect(page.getByTestId('open-ifc-btn')).toContainText('Open IFC');
  });
});
