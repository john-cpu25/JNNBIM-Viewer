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
