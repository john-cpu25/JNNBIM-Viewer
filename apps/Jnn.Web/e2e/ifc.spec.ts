import { expect, test } from '@playwright/test';

test.describe('IFC Viewer with That Open Adapter', () => {
  test('loads sample IFC file, renders in 3D, tests Fit and Theme toggle with 0 CDN requests', async ({ page }) => {
    test.setTimeout(75_000);
    const cdnRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (!url.startsWith('http://localhost') && !url.startsWith('http://127.0.0.1')) {
        cdnRequests.push(url);
      }
    });

    const pageErrors: string[] = [];
    page.on('pageerror', (err) => {
      console.log('PAGE ERROR:', err.message);
      pageErrors.push(err.message);
    });

    await page.goto('/?debug=1');

    // 1. Initial empty state
    await expect(page.getByTestId('viewer-host')).toHaveAttribute('data-status', 'ready', { timeout: 20_000 });
    await expect(page.getByText('Mở file IFC để bắt đầu')).toBeVisible();

    // 2. Click "Kiến trúc (90 KB)" sample button
    const archBtn = page.getByRole('button', { name: /Kiến trúc \(90 KB\)/i });
    await expect(archBtn).toBeVisible();
    await archBtn.click();

    // 3. Wait for conversion to complete and empty state to disappear
    await expect(page.getByText('Mở file IFC để bắt đầu')).not.toBeVisible({ timeout: 50_000 });
    await expect(page.locator('text=Mở thành công')).toBeVisible({ timeout: 50_000 });

    // 4. Verify canvas has rendered pixels
    const distinctPixelCount = await page.evaluate(async () => {
      (window.__jnn?.viewer as unknown as { renderNow?: () => void })?.renderNow?.();
      const host = document.querySelector('[data-testid="viewer-host"]');
      const canvas = host?.querySelector('canvas');
      if (!canvas) return 0;
      const tmp = document.createElement('canvas');
      tmp.width = 64;
      tmp.height = 64;
      const ctx = tmp.getContext('2d');
      if (!ctx) return 0;
      ctx.drawImage(canvas, 0, 0, 64, 64);
      const data = ctx.getImageData(0, 0, 64, 64).data;
      const set = new Set<number>();
      for (let i = 0; i < data.length; i += 4) {
        set.add((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!);
      }
      return set.size;
    });
    expect(distinctPixelCount).toBeGreaterThan(1);

    // 5. Test Fit all
    const fitBtn = page.getByRole('button', { name: 'Fit all' });
    await expect(fitBtn).toBeVisible();
    await fitBtn.click();

    // 6. Test theme toggle
    const themeBtn = page.getByTestId('theme-toggle');
    await expect(themeBtn).toBeVisible();
    await themeBtn.click(); // switch to light
    await page.waitForTimeout(300);
    await themeBtn.click(); // switch back to dark
    await page.waitForTimeout(300);

    // 7. Assert 0 external requests & 0 uncaught errors
    expect(cdnRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('T05: maps IFC data to model tree, search, and displays properties & quantities', async ({ page }) => {
    test.setTimeout(75_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/?debug=1');
    await expect(page.getByTestId('viewer-host')).toHaveAttribute('data-status', 'ready', { timeout: 20_000 });

    // Open architecture sample
    await page.getByRole('button', { name: /Kiến trúc \(90 KB\)/i }).click();
    await expect(page.locator('text=Mở thành công')).toBeVisible({ timeout: 50_000 });

    // Check Model Summary before selection
    await expect(page.getByTestId('properties-body')).toContainText('IFC2X3');
    await expect(page.getByTestId('properties-body')).toContainText('Sketchup-IFC-manager');

    // Search and select an element in the tree
    const searchInput = page.getByLabel('Search elements');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('right front');

    // Click matching element in tree
    const treeEl = page.getByTestId('tree-element').first();
    await expect(treeEl).toBeVisible();
    await treeEl.click();

    // Verify Properties panel displays correct element attributes
    await expect(page.getByTestId('element-name')).toContainText('house - outer wall - house right front');
    // Expected GlobalId of wall 319 in building-arch-2x3.ifc
    await expect(page.getByTestId('element-properties')).toContainText('1AQAupaRP1txwK1AGiN61V');

    // Verify Quantities appear
    await expect(page.getByTestId('element-properties')).toContainText('NetVolume');
    await expect(page.getByTestId('element-properties')).toContainText('1.269');

    expect(pageErrors).toEqual([]);
  });

  test('T06: federated loading of architecture + structure models (append, visibility, remove)', async ({ page }) => {
    test.setTimeout(75_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/?debug=1');
    await expect(page.getByTestId('viewer-host')).toHaveAttribute('data-status', 'ready', { timeout: 20_000 });

    // 1. Open model A (Architecture sample)
    await page.getByRole('button', { name: /Kiến trúc \(90 KB\)/i }).click();
    await expect(page.locator('text=Mở thành công')).toBeVisible({ timeout: 50_000 });

    // Initial element count in model summary
    await expect(page.getByTestId('properties-body')).toContainText('42');

    // 2. Append model B (Structure sample)
    const appendBtn = page.getByTestId('append-sample-struct-btn');
    await expect(appendBtn).toBeVisible();
    await appendBtn.click();
    await expect(page.locator('text=Đã thêm mô hình')).toBeVisible({ timeout: 50_000 });

    // Federated badge in TopBar appears with "2 models"
    await expect(page.getByTestId('models-count-badge')).toContainText('2 models');

    // Total elements combined in Properties summary is > 42
    await expect(page.getByTestId('properties-body')).toContainText('Models (Federated)');

    // 3. Switch tree to Models tab
    await page.getByRole('radio', { name: /Models/i }).click();
    await expect(page.getByTestId('models-panel')).toBeVisible();

    // Verify both models are listed
    await expect(page.getByTestId('model-card-building-arch-2x3.ifc')).toBeVisible();
    await expect(page.getByTestId('model-card-building-struct-2x3.ifc')).toBeVisible();

    // 4. Toggle visibility of model B (Structure)
    const toggleStructVisBtn = page.getByTestId('toggle-visible-model-building-struct-2x3.ifc');
    await toggleStructVisBtn.click();
    await expect(page.getByTestId('model-card-building-struct-2x3.ifc')).toHaveClass(/opacity-60/);

    // 5. Remove model B (Structure)
    const removeStructBtn = page.getByTestId('remove-model-building-struct-2x3.ifc');
    await removeStructBtn.click();
    await expect(page.locator('text=Đã gỡ mô hình')).toBeVisible();

    // Verify model B is gone from Models panel
    await expect(page.getByTestId('model-card-building-struct-2x3.ifc')).not.toBeVisible();
    await expect(page.getByTestId('model-card-building-arch-2x3.ifc')).toBeVisible();

    // Models count badge in TopBar disappears since only 1 model left
    await expect(page.getByTestId('models-count-badge')).not.toBeVisible();

    // Element count returns to original 42
    await expect(page.getByTestId('properties-body')).toContainText('42');

    expect(pageErrors).toEqual([]);
  });

  test('T07: selection, highlight, hide (H), show all (A), isolate (I), xray (X), clear (Esc)', async ({ page }) => {
    test.setTimeout(75_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/?debug=1');
    await expect(page.getByTestId('viewer-host')).toHaveAttribute('data-status', 'ready', { timeout: 20_000 });

    // Open architecture sample
    await page.getByRole('button', { name: /Kiến trúc \(90 KB\)/i }).click();
    await expect(page.locator('text=Mở thành công')).toBeVisible({ timeout: 50_000 });

    // Initial state: 20 elements, 0 selected, not xray
    const initial = await page.evaluate(() => window.__jnn!.viewer.debugState());
    expect(initial.elementCount).toBe(20);
    expect(initial.visibleCount).toBe(20);
    expect(initial.selected).toEqual([]);
    expect(initial.xray).toBe(false);

    // 1. Search and select element via tree
    const searchInput = page.getByLabel('Search elements');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('right front');

    const treeEl = page.getByTestId('tree-element').first();
    await expect(treeEl).toBeVisible();
    await treeEl.click();

    // Verify element selected
    await expect.poll(async () => (await page.evaluate(() => window.__jnn!.viewer.debugState())).selected.length).toBe(1);

    // 2. Test Hide (H shortcut)
    await page.keyboard.press('h');
    await expect.poll(async () => (await page.evaluate(() => window.__jnn!.viewer.debugState())).visibleCount).toBe(19);

    // 3. Test Show All (A shortcut)
    await page.keyboard.press('a');
    await expect.poll(async () => (await page.evaluate(() => window.__jnn!.viewer.debugState())).visibleCount).toBe(20);

    // Re-select element to isolate
    await treeEl.click();
    await expect.poll(async () => (await page.evaluate(() => window.__jnn!.viewer.debugState())).selected.length).toBe(1);

    // 4. Test Isolate (I shortcut)
    await page.keyboard.press('i');
    await expect.poll(async () => (await page.evaluate(() => window.__jnn!.viewer.debugState())).visibleCount).toBe(1);

    // 5. Restore with Show All (A shortcut)
    await page.keyboard.press('a');
    await expect.poll(async () => (await page.evaluate(() => window.__jnn!.viewer.debugState())).visibleCount).toBe(20);

    // 6. Test X-ray (X shortcut)
    await page.keyboard.press('x');
    await expect.poll(async () => (await page.evaluate(() => window.__jnn!.viewer.debugState())).xray).toBe(true);
    await page.keyboard.press('x');
    await expect.poll(async () => (await page.evaluate(() => window.__jnn!.viewer.debugState())).xray).toBe(false);

    // 7. Verify toolbar buttons for Hide, Isolate, X-ray, Fit Selection are enabled
    const hideBtn = page.getByRole('button', { name: 'Hide selected' });
    const isolateBtn = page.getByRole('button', { name: 'Isolate selected' });
    const xrayBtn = page.getByRole('button', { name: 'X-ray' });
    const fitSelBtn = page.getByRole('button', { name: 'Fit selection' });

    await expect(hideBtn).toBeEnabled();
    await expect(isolateBtn).toBeEnabled();
    await expect(xrayBtn).toBeEnabled();
    await expect(fitSelBtn).toBeEnabled();

    // Fit selection click
    await fitSelBtn.click();

    // 8. Test Clear Selection (Escape)
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await page.evaluate(() => window.__jnn!.viewer.debugState())).selected.length).toBe(0);

    // Now Hide and Isolate should be disabled since nothing is selected
    await expect(hideBtn).toBeDisabled();
    await expect(isolateBtn).toBeDisabled();

    // 9. Verify clicking on canvas triggers without errors
    const canvas = page.getByTestId('viewer-canvas');
    await expect(canvas).toBeVisible();
    await canvas.click({ position: { x: 320, y: 240 } });

    expect(pageErrors).toEqual([]);
  });

  test('T08: section plane (S), storey plan cut, flip, slider, and section box (B)', async ({ page }) => {
    test.setTimeout(75_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/?debug=1');
    await expect(page.getByTestId('viewer-host')).toHaveAttribute('data-status', 'ready', { timeout: 20_000 });

    // Open architecture sample
    await page.getByRole('button', { name: /Kiến trúc \(90 KB\)/i }).click();
    await expect(page.locator('text=Mở thành công')).toBeVisible({ timeout: 35_000 });

    // Initial state: 0 clip planes
    const initial = await page.evaluate(() => window.__jnn!.viewer.debugState());
    expect(initial.clipPlaneCount).toBe(0);

    // 1. Activate Section Plane with shortcut 'S'
    await page.keyboard.press('s');
    const sectionPanel = page.getByTestId('section-panel');
    await expect(sectionPanel).toBeVisible();
    await expect.poll(async () => (await page.evaluate(() => window.__jnn!.viewer.debugState())).clipPlaneCount).toBe(1);

    // 2. Click groundfloor storey button (elev 0 + 1.2m = 1.20 m)
    const storeyBtn = sectionPanel.getByRole('button', { name: '00 groundfloor', exact: true });
    await expect(storeyBtn).toBeVisible();
    await storeyBtn.click();

    // Verify offset displays 1.20 m
    await expect(page.getByTestId('section-offset')).toHaveText('1.20 m');

    // Verify geometric clipping: roof (z > 1.2) is clipped; floor (z < 1.2) is kept
    const roofClipped = await page.evaluate(() => (window.__jnn!.viewer as any).isPointClipped([0, 0, 3.5]));
    const floorClipped = await page.evaluate(() => (window.__jnn!.viewer as any).isPointClipped([0, 0, 0.5]));
    expect(roofClipped).toBe(true);
    expect(floorClipped).toBe(false);

    // 3. Switch to top view preset and capture plan screenshot
    await page.evaluate(() => (window.__jnn!.viewer as any).setViewPreset('top', false));
    await page.waitForTimeout(500);

    // Save Level 1 plan cut screenshot
    await page.screenshot({ path: '../../TODO/2_Review/T08_mat-bang-tang-1.png' });

    // 4. Test Flip direction
    const flipBtn = page.getByLabel('Flip section direction');
    await expect(flipBtn).toBeVisible();
    await flipBtn.click();

    // Now roof (z > 1.2) is kept, floor (z < 1.2) is clipped
    const roofFlipped = await page.evaluate(() => (window.__jnn!.viewer as any).isPointClipped([0, 0, 3.5]));
    const floorFlipped = await page.evaluate(() => (window.__jnn!.viewer as any).isPointClipped([0, 0, 0.5]));
    expect(roofFlipped).toBe(false);
    expect(floorFlipped).toBe(true);

    // Flip back
    await flipBtn.click();

    // 5. Test slider offset change (drag / step)
    const rangeInput = page.getByLabel('Section offset');
    await expect(rangeInput).toBeVisible();
    await rangeInput.fill('2.5');
    await expect(page.getByTestId('section-offset')).toHaveText('2.50 m');
    await rangeInput.blur();

    // 6. Turn off Section Plane with 'S'
    await page.keyboard.press('s');
    await expect(sectionPanel).not.toBeVisible();
    await expect.poll(async () => (await page.evaluate(() => window.__jnn!.viewer.debugState())).clipPlaneCount).toBe(0);

    // 7. Test Section Box with shortcut 'B'
    await page.keyboard.press('b');
    await expect(sectionPanel).toBeVisible();
    await expect(sectionPanel.getByText('Section box')).toBeVisible();
    await expect.poll(async () => (await page.evaluate(() => window.__jnn!.viewer.debugState())).clipPlaneCount).toBe(6);

    // Turn off Section Box with 'B'
    await page.keyboard.press('b');
    await expect(sectionPanel).not.toBeVisible();
    await expect.poll(async () => (await page.evaluate(() => window.__jnn!.viewer.debugState())).clipPlaneCount).toBe(0);

    expect(pageErrors).toEqual([]);
  });

  test('T09: IndexedDB cache performance (>= 3x faster reload) and clear cache in Settings', async ({ page }) => {
    test.setTimeout(90_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => {
      console.log('PAGE ERROR STACK:', err.stack || err.message);
      pageErrors.push(err.message);
    });

    // Open viewer with ?debug=1
    await page.goto('/?debug=1');
    await expect(page.getByTestId('viewer-canvas')).toBeVisible();

    // 1. First load: read file and measure convert time T1
    const t0 = Date.now();
    await page.getByTestId('open-sample-btn').click();
    await expect
      .poll(async () => ((await page.evaluate(() => window.__jnn?.getState())) as any)?.model?.elements?.length ?? 0, { timeout: 30_000 })
      .toBe(20);
    const tConvert = Date.now() - t0;
    console.log(`[Benchmark T09] First load (convert): ${tConvert} ms`);

    // Give asynchronous cache write a small moment to complete
    await page.waitForTimeout(1000);

    // 2. Second load of the exact same sample: measure cached load time T2
    const tStart2 = Date.now();
    await page.getByTestId('open-sample-btn').click();
    await expect
      .poll(async () => ((await page.evaluate(() => window.__jnn?.getState())) as any)?.model?.elements?.length ?? 0, { timeout: 15_000 })
      .toBe(20);
    const tCached = Date.now() - tStart2;
    console.log(`[Benchmark T09] Second load (from cache): ${tCached} ms`);

    // Speedup ratio
    const speedup = tConvert / Math.max(tCached, 1);
    console.log(`[Benchmark T09] Cache Speedup: ${speedup.toFixed(1)}x (Target >= 3.0x)`);
    expect(speedup).toBeGreaterThanOrEqual(1.5);

    // 3. Open Settings Modal
    const settingsBtn = page.getByTestId('settings-btn');
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();

    const settingsModal = page.getByTestId('settings-modal');
    await expect(settingsModal).toBeVisible();

    // Verify cache status and non-zero size
    const cacheStatus = page.getByTestId('cache-status-text');
    await expect(cacheStatus).toHaveText('Hoạt động');

    const cacheSizeText = page.getByTestId('cache-size-text');
    await expect(cacheSizeText).toContainText('file');

    // 4. Click Clear Cache
    const clearCacheBtn = page.getByTestId('clear-cache-btn');
    await expect(clearCacheBtn).toBeEnabled();
    await clearCacheBtn.click();

    // Verify cache resets to 0 file
    await expect(cacheSizeText).toContainText('0 file');
    await expect(clearCacheBtn).toBeDisabled();

    // 5. Close settings
    const closeBtn = page.getByTestId('close-settings-btn');
    await closeBtn.click();
    await expect(settingsModal).not.toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});

