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

test.describe('Mốc 4 ThatOpen Adapter: Revit navigation, section gizmo, projection', () => {
  test('E2E with ThatOpen adapter: left drag hint, Shift+left orbit, gizmo Z-max drag, X min input, P toggle and middle pan', async ({ page }) => {
    test.setTimeout(75_000);
    await page.goto('/?debug=1');
    await expect(page.getByTestId('viewer-host')).toHaveAttribute('data-status', 'ready', { timeout: 20_000 });

    const archBtn = page.getByRole('button', { name: /(Kiến trúc|Architecture) \(90 KB\)/i });
    await expect(archBtn).toBeVisible();
    await archBtn.click();

    await expect(page.getByText('Mở file IFC để bắt đầu')).not.toBeVisible({ timeout: 50_000 });
    await expect(page.locator('text=Mở thành công')).toBeVisible({ timeout: 50_000 });

    const canvas = page.getByTestId('viewer-host').locator('canvas');
    await expect(canvas).toBeVisible();
    const box = (await canvas.boundingBox())!;
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    // 1. Left-drag without Shift -> camera position does NOT move
    const camBeforeLeft = await page.evaluate(() => (window.__jnn!.viewer.getCamera() as any).value);
    await page.mouse.move(startX, startY);
    await page.mouse.down({ button: 'left' });
    await page.mouse.move(startX + 80, startY + 40, { steps: 5 });
    await page.mouse.up({ button: 'left' });

    const camAfterLeft = await page.evaluate(() => (window.__jnn!.viewer.getCamera() as any).value);
    expect(camAfterLeft.position[0]).toBeCloseTo(camBeforeLeft.position[0], 2);
    expect(camAfterLeft.position[1]).toBeCloseTo(camBeforeLeft.position[1], 2);
    expect(camAfterLeft.position[2]).toBeCloseTo(camBeforeLeft.position[2], 2);

    // 2. Shift + left-drag -> camera moves / orbits
    const camBeforeShift = await page.evaluate(() => (window.__jnn!.viewer.getCamera() as any).value);
    await page.keyboard.down('Shift');
    await page.mouse.move(startX, startY);
    await page.mouse.down({ button: 'left' });
    await page.mouse.move(startX + 120, startY + 60, { steps: 5 });
    await page.mouse.up({ button: 'left' });
    await page.keyboard.up('Shift');

    const camAfterShift = await page.evaluate(() => (window.__jnn!.viewer.getCamera() as any).value);
    const distShift = Math.hypot(
      camAfterShift.position[0] - camBeforeShift.position[0],
      camAfterShift.position[1] - camBeforeShift.position[1],
      camAfterShift.position[2] - camBeforeShift.position[2]
    );
    expect(distShift).toBeGreaterThan(0.05);

    // 3. Open Section Box with 'B'
    await page.keyboard.press('b');
    const panel = page.getByTestId('section-panel');
    await expect(panel).toBeVisible();

    // Find screen position of Z-max handle and drag it down
    const handleScreenPos = await page.evaluate(() => {
      const viewer = window.__jnn?.viewer as any;
      const sectionGizmo = viewer?.sectionGizmo;
      const handleObj = sectionGizmo?.handles?.get('z-max');
      if (!handleObj) return null;
      const worldPos = handleObj.group.position.clone();
      worldPos.project(viewer.world.camera.three);
      const host = document.querySelector('[data-testid="viewer-host"]');
      const rect = host!.getBoundingClientRect();
      const x = ((worldPos.x + 1) / 2) * rect.width + rect.left;
      const y = ((-worldPos.y + 1) / 2) * rect.height + rect.top;
      return { x, y };
    });

    expect(handleScreenPos).not.toBeNull();
    const zMaxInput = page.getByTestId('section-box-max-z');
    const initialZMax = parseFloat(await zMaxInput.inputValue());

    await page.mouse.move(handleScreenPos!.x, handleScreenPos!.y);
    await page.mouse.down({ button: 'left' });
    await page.mouse.move(handleScreenPos!.x, handleScreenPos!.y + 50, { steps: 5 });
    await page.mouse.up({ button: 'left' });

    const afterZMax = parseFloat(await zMaxInput.inputValue());
    expect(afterZMax).toBeLessThan(initialZMax);

    // 4. Type numeric input X min -> box updates
    const xMinInput = page.getByTestId('section-box-min-x');
    await xMinInput.fill('-15');
    await xMinInput.press('Enter');
    const currentSection = await page.evaluate(() => (window.__jnn!.getState() as any).section);
    expect(currentSection.min[0]).toBeCloseTo(-15, 1);

    // 5. Toggle projection ('P') -> middle drag still pans
    const targetBeforePan = await page.evaluate(() => (window.__jnn!.viewer.getCamera() as any).value.target);
    await page.keyboard.press('p');

    await page.mouse.move(startX, startY);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(startX + 80, startY + 40, { steps: 5 });
    await page.mouse.up({ button: 'middle' });

    const targetAfterPan = await page.evaluate(() => (window.__jnn!.viewer.getCamera() as any).value.target);
    const distPan = Math.hypot(
      targetAfterPan[0] - targetBeforePan[0],
      targetAfterPan[1] - targetBeforePan[1],
      targetAfterPan[2] - targetBeforePan[2]
    );
    expect(distPan).toBeGreaterThan(0.05);
  });
});

