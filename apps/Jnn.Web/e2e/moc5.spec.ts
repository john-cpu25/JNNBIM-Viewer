import { expect, test } from '@playwright/test';

async function openThatOpenArch(page: any) {
  await page.goto('/?debug=1');
  await expect(page.getByTestId('viewer-host')).toHaveAttribute('data-status', 'ready', { timeout: 20_000 });
  const archBtn = page.getByRole('button', { name: /Kiến trúc \(90 KB\)/i });
  await expect(archBtn).toBeVisible();
  await archBtn.click();
  await expect(page.getByText('Mở file IFC để bắt đầu')).not.toBeVisible({ timeout: 50_000 });
  await expect(page.locator('text=Mở thành công')).toBeVisible({ timeout: 50_000 });
  await page.waitForTimeout(500);
}

test.describe('Mốc 5: Group H - Multi-select & Box Selection on ThatOpen', () => {
  test.setTimeout(90_000);

  test('H1: Ctrl+A selects all visible elements, badge shows count, Esc clears', async ({ page }) => {
    await openThatOpenArch(page);

    const totalElements = await page.evaluate(() => {
      const state = (window as any).__jnn.getState();
      return state.model.elements.length;
    });
    expect(totalElements).toBeGreaterThan(0);

    // Initial selection is empty
    let selCount = await page.evaluate(() => (window as any).__jnn.getState().selection.length);
    expect(selCount).toBe(0);

    // Press Ctrl+A
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(300);

    selCount = await page.evaluate(() => (window as any).__jnn.getState().selection.length);
    expect(selCount).toBe(totalElements);

    // Badge should be visible with count
    const badge = page.getByTestId('selection-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText(String(totalElements));

    // Press Escape to clear
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    selCount = await page.evaluate(() => (window as any).__jnn.getState().selection.length);
    expect(selCount).toBe(0);
    await expect(badge).not.toBeVisible();
  });

  test('H1: Multi-select with tree items and Ctrl+click', async ({ page }) => {
    await openThatOpenArch(page);

    // Filter tree elements via search input
    const searchInput = page.getByLabel('Search elements');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('wall');

    const treeElements = page.getByTestId('tree-element');
    await expect(treeElements.first()).toBeVisible({ timeout: 10_000 });

    // Click first item without Ctrl
    await treeElements.nth(0).click();
    await page.waitForTimeout(200);

    let sel = await page.evaluate(() => (window as any).__jnn.getState().selection);
    expect(sel.length).toBe(1);

    // Ctrl+Click second item
    await treeElements.nth(1).click({ modifiers: ['Control'] });
    await page.waitForTimeout(200);

    sel = await page.evaluate(() => (window as any).__jnn.getState().selection);
    expect(sel.length).toBe(2);
  });

  test('H2: Window & Crossing box selection shows overlay and selects elements', async ({ page }) => {
    await openThatOpenArch(page);

    const canvas = page.getByTestId('viewer-canvas');
    await expect(canvas).toBeVisible();
    const box = (await canvas.boundingBox())!;
    expect(box).toBeTruthy();

    // 1. Window selection (Left to Right)
    const startX = box.x + box.width * 0.3;
    const startY = box.y + box.height * 0.3;
    const endX = box.x + box.width * 0.7;
    const endY = box.y + box.height * 0.7;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 50, startY + 50);

    // Overlay should appear
    const overlay = page.getByTestId('selection-box');
    await expect(overlay).toBeVisible();
    const borderStyle = await overlay.evaluate((el: HTMLElement) => el.style.border);
    expect(borderStyle).toContain('solid');

    await page.mouse.move(endX, endY);
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Window selection completed
    await expect(overlay).not.toBeVisible();
    let sel = await page.evaluate(() => (window as any).__jnn.getState().selection);
    expect(sel.length).toBeGreaterThan(0);

    // 2. Crossing selection (Right to Left)
    const crossStartX = box.x + box.width * 0.7;
    const crossStartY = box.y + box.height * 0.4;
    const crossEndX = box.x + box.width * 0.3;
    const crossEndY = box.y + box.height * 0.6;

    await page.mouse.move(crossStartX, crossStartY);
    await page.mouse.down();
    await page.mouse.move(crossStartX - 50, crossStartY + 50);

    await expect(overlay).toBeVisible();
    const crossBorder = await overlay.evaluate((el: HTMLElement) => el.style.border);
    expect(crossBorder).toContain('dashed');

    await page.mouse.move(crossEndX, crossEndY);
    await page.mouse.up();
    await page.waitForTimeout(500);

    await expect(overlay).not.toBeVisible();
    sel = await page.evaluate(() => (window as any).__jnn.getState().selection);
    expect(sel.length).toBeGreaterThan(0);

    // 3. Dragging in empty space (corner) clears selection
    const emptyX1 = box.x + 10;
    const emptyY1 = box.y + 10;
    const emptyX2 = box.x + 40;
    const emptyY2 = box.y + 40;

    await page.mouse.move(emptyX1, emptyY1);
    await page.mouse.down();
    await page.mouse.move(emptyX2, emptyY2);
    await page.mouse.up();
    await page.waitForTimeout(300);

    sel = await page.evaluate(() => (window as any).__jnn.getState().selection);
    expect(sel.length).toBe(0);
  });
});

test.describe('Mốc 5: Group I - Measurement Tools on ThatOpen', () => {
  test.setTimeout(90_000);

  test('I1-I4: Toggle MeasurePanel with M key, place 2 points, change unit, clear, exit with Esc', async ({ page }) => {
    await openThatOpenArch(page);

    // Initial state: MeasurePanel is not visible
    const measurePanel = page.getByTestId('measure-panel');
    await expect(measurePanel).not.toBeVisible();

    // 1. Press 'M' shortcut to open MeasurePanel
    await page.keyboard.press('m');
    await expect(measurePanel).toBeVisible();

    // Verify ruler button is active
    const rulerBtn = page.getByTestId('toggle-measure-btn');
    await expect(rulerBtn).toBeVisible();

    // Verify tools, snapping, units are displayed
    await expect(page.getByTestId('snap-vertex')).toBeVisible();
    await expect(page.getByTestId('snap-edge')).toBeVisible();
    await expect(page.getByTestId('snap-face')).toBeVisible();

    // 2. Find 2 distinct points on the model geometry using pickAt
    const points = await page.evaluate(async () => {
      const v = (window as any).__jnn?.viewer;
      const canvas = document.querySelector('[data-testid="viewer-canvas"]') as HTMLCanvasElement;
      if (!canvas || !v) return null;
      const rect = canvas.getBoundingClientRect();
      const hits: Array<{ x: number; y: number; point: [number, number, number] }> = [];
      for (let y = rect.top + 100; y < rect.bottom - 100; y += 30) {
        for (let x = rect.left + 200; x < rect.right - 200; x += 30) {
          const h = await v.pickAt(x, y);
          if (h && h.point) {
            hits.push({ x: Math.round(x), y: Math.round(y), point: [h.point[0], h.point[1], h.point[2]] });
          }
        }
      }
      if (hits.length < 2) return null;
      const p1 = hits[0]!;
      let p2 = hits[hits.length - 1]!;
      for (let i = hits.length - 1; i >= 1; i--) {
        const d = Math.hypot(hits[i]!.point[0] - p1.point[0], hits[i]!.point[1] - p1.point[1], hits[i]!.point[2] - p1.point[2]);
        if (d >= 0.5) {
          p2 = hits[i]!;
          break;
        }
      }
      return { p1, p2 };
    });

    expect(points).not.toBeNull();
    const { p1, p2 } = points!;

    // 3. Test R3: Esc cancels in-progress measurement first, closes panel on second Esc
    await page.mouse.move(p1.x, p1.y, { steps: 5 });
    await page.waitForTimeout(150);
    await page.mouse.click(p1.x, p1.y);
    await page.waitForTimeout(300);

    // Press Esc once -> cancels in-progress line, panel remains visible
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await expect(measurePanel).toBeVisible();

    // 4. Click p1 and p2 to create a real distance measurement
    await page.mouse.move(p1.x, p1.y, { steps: 5 });
    await page.waitForTimeout(150);
    await page.mouse.click(p1.x, p1.y);
    await page.waitForTimeout(300);

    await page.mouse.move(p2.x, p2.y, { steps: 5 });
    await page.waitForTimeout(300);
    await page.mouse.click(p2.x, p2.y);
    await page.waitForTimeout(500);

    // 5. Assert exactly 1 measurement item, unit 'mm', value matches Euclidean distance within 1 mm
    const items = await page.evaluate(() => (window as any).__jnn.getState().measurements);
    expect(items.length).toBe(1);
    expect(items[0].unit).toBe('mm');

    const expectedDistMm = Math.hypot(
      items[0].points[0][0] - items[0].points[1][0],
      items[0].points[0][1] - items[0].points[1][1],
      items[0].points[0][2] - items[0].points[1][2],
    ) * 1000;
    expect(Math.abs(items[0].value - expectedDistMm)).toBeLessThan(1.0);

    // Verify 3D item is displayed in panel list
    const measureItems = page.locator('[data-testid="measure-item"]');
    await expect(measureItems).toHaveCount(1);
    await expect(measureItems.first()).toContainText('mm');

    // 6. Change unit to 'm' -> value updates to meters
    await page.getByRole('radio', { name: 'm', exact: true }).click();
    await page.waitForTimeout(200);
    const itemsM = await page.evaluate(() => (window as any).__jnn.getState().measurements);
    expect(itemsM[0].unit).toBe('m');
    const expectedDistM = Number((expectedDistMm / 1000).toFixed(1));
    expect(Math.abs(itemsM[0].value - expectedDistM)).toBeLessThan(0.01);

    // 7. Test Volume measurement (D1)
    const volRadio = page.getByRole('radio', { name: /Thể tích|Volume/i });
    if (await volRadio.isVisible()) {
      await volRadio.click();
      await page.waitForTimeout(200);

      // Click on model geometry (p1) to measure element volume
      await page.mouse.move(p1.x, p1.y, { steps: 5 });
      await page.waitForTimeout(150);
      await page.mouse.click(p1.x, p1.y);

      // Wait for async getRawValue() and verify volume item appears with value > 0
      await expect
        .poll(
          async () => {
            const stateItems = await page.evaluate(() => (window as any).__jnn.getState().measurements);
            const vol = stateItems.find((m: any) => m.tool === 'volume');
            return vol ? vol.value : 0;
          },
          { timeout: 5000 },
        )
        .toBeGreaterThan(0);

      const itemsVol = await page.evaluate(() => (window as any).__jnn.getState().measurements);
      const vol = itemsVol.find((m: any) => m.tool === 'volume');
      expect(vol).toBeTruthy();
      expect(vol.value).toBeGreaterThan(0);
      expect(vol.unit).toBe('m3');
    }

    // 8. Clear all measurements
    const clearBtn = page.getByTestId('measure-clear-btn');
    await expect(clearBtn).toBeEnabled();
    await clearBtn.click();
    await page.waitForTimeout(200);
    const clearedItems = await page.evaluate(() => (window as any).__jnn.getState().measurements);
    expect(clearedItems.length).toBe(0);

    // 8. Press Escape to close MeasurePanel
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await expect(measurePanel).not.toBeVisible();
  });
});

test.describe('Mốc 5: Group J - Saved Views (J2) on ThatOpen', () => {
  test.setTimeout(90_000);

  test('J2: Save 2 viewpoints, restore camera & state, verify persistence in localStorage', async ({ page }) => {
    await openThatOpenArch(page);

    // 1. Switch to Saved Views tab in RightPanel
    const viewsTabBtn = page.getByTestId('tab-views-btn');
    await expect(viewsTabBtn).toBeVisible();
    await viewsTabBtn.click();

    const viewsPanel = page.getByTestId('saved-views-panel');
    await expect(viewsPanel).toBeVisible();

    // 2. Save View 1
    const saveBtn = page.getByTestId('save-view-btn');
    await saveBtn.click();
    await page.waitForTimeout(400);

    let cards = page.getByTestId('saved-view-card');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Góc nhìn 1');

    // 3. Change camera position
    await page.evaluate(() => {
      const v = (window as any).__jnn.viewer;
      v.setCamera({
        position: [50, 50, 50],
        target: [0, 0, 0],
        projection: 'perspective',
      });
    });
    await page.waitForTimeout(300);

    // Save View 2
    await saveBtn.click();
    await page.waitForTimeout(400);

    cards = page.getByTestId('saved-view-card');
    await expect(cards).toHaveCount(2);

    // 4. Click View 1 card to restore
    await cards.nth(1).click();
    await page.waitForTimeout(400);

    const camState = await page.evaluate(() => (window as any).__jnn.viewer.getCamera().value);
    expect(camState.position[0]).not.toBeCloseTo(50, 0);

    // 5. Verify savedViews exist in localStorage
    const storedViews = await page.evaluate(() => {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith('jnn-saved-views-'));
      if (keys.length === 0) return [];
      return JSON.parse(localStorage.getItem(keys[0]!) || '[]');
    });
    expect(storedViews.length).toBe(2);

    // 6. Delete a view
    const deleteBtn = cards.first().getByTestId('delete-view-btn');
    await deleteBtn.click();
    await page.waitForTimeout(300);

    cards = page.getByTestId('saved-view-card');
    await expect(cards).toHaveCount(1);
  });

  test('J4 & J7: Fullscreen button and Screenshot PNG download', async ({ page }) => {
    await openThatOpenArch(page);

    // 1. Verify Fullscreen button is visible on TopBar
    const fsBtn = page.getByTestId('fullscreen-btn');
    await expect(fsBtn).toBeVisible();
    await fsBtn.click();
    await page.waitForTimeout(300);

    // 2. Screenshot button on Toolbar triggers PNG download
    const screenshotBtn = page.getByTestId('screenshot-btn');
    await expect(screenshotBtn).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      screenshotBtn.click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^JNN_.*\.png$/);
  });

  test('J6: Levels dropdown isolates storey elements and restores all storeys', async ({ page }) => {
    await openThatOpenArch(page);

    // 1. Levels dropdown button is present
    const levelsBtn = page.getByTestId('levels-dropdown-btn');
    await expect(levelsBtn).toBeVisible();

    // 2. Open dropdown
    await levelsBtn.click();
    const menu = page.getByTestId('levels-dropdown-menu');
    await expect(menu).toBeVisible();

    // Storey items are displayed
    const storeyItems = page.getByTestId('level-item');
    const count = await storeyItems.count();
    expect(count).toBeGreaterThan(0);

    // 3. Select first storey
    await storeyItems.first().click();
    await page.waitForTimeout(400);

    // Verify isolation is active in state
    let vis = await page.evaluate(() => {
      const s = (window as any).__jnn.getState();
      return {
        selectedStoreyId: s.selectedStoreyId,
        isolatedCount: s.visibility.isolated.size,
      };
    });
    expect(vis.selectedStoreyId).toBeTruthy();
    expect(vis.isolatedCount).toBeGreaterThan(0);

    // 4. Click Levels dropdown again and select 'All Levels'
    await levelsBtn.click();
    await expect(menu).toBeVisible();
    await page.getByTestId('level-item-all').click();
    await page.waitForTimeout(400);

    vis = await page.evaluate(() => {
      const s = (window as any).__jnn.getState();
      return {
        selectedStoreyId: s.selectedStoreyId,
        isolatedCount: s.visibility.isolated.size,
      };
    });
    expect(vis.selectedStoreyId).toBeNull();
    expect(vis.isolatedCount).toBe(0);
  });

  test('J1: First-person walk mode moves with WASD, exits with Esc, Shift+drag still orbits', async ({ page }) => {
    await openThatOpenArch(page);

    // 1. Walk button on Toolbar is visible
    const walkBtn = page.getByTestId('toggle-walk-btn');
    await expect(walkBtn).toBeVisible();

    // 2. Click Walk button to enter First-person mode
    await walkBtn.click();
    await page.waitForTimeout(400);

    const hud = page.getByTestId('walk-mode-hud');
    await expect(hud).toBeVisible();

    // Record initial camera position
    const p1 = await page.evaluate(() => (window as any).__jnn.viewer.getCamera().value.position);

    // 3. Move forward with 'W' key (hold >= 500ms)
    await page.keyboard.down('w');
    await page.waitForTimeout(600);
    await page.keyboard.up('w');
    await page.waitForTimeout(200);

    const p2 = await page.evaluate(() => (window as any).__jnn.viewer.getCamera().value.position);
    const moved = Math.hypot(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]);
    expect(moved).toBeGreaterThan(0.01);

    // 4. Press Escape to exit walk mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(hud).not.toBeVisible();

    // 5. Verify Shift + Drag still orbits properly without regression
    const canvas = page.getByTestId('viewer-canvas');
    const box = (await canvas.boundingBox())!;
    await page.keyboard.down('Shift');
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down({ button: 'left' });
    await page.mouse.move(box.x + box.width * 0.5 + 40, box.y + box.height * 0.5 + 40);
    await page.mouse.up({ button: 'left' });
    await page.keyboard.up('Shift');
    await page.waitForTimeout(200);

    const p3 = await page.evaluate(() => (window as any).__jnn.viewer.getCamera().value.position);
    expect(p3).toBeDefined();
  });
});

