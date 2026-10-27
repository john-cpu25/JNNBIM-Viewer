import { expect, test } from '@playwright/test';
import { debugState, findElementId, openViewer, screenPoint, selection } from './helpers';

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openViewer(page);
  expect(errors).toEqual([]);
});

test('renders the sample model with WebGL', async ({ page }) => {
  const s = await debugState(page);
  expect(s.elementCount).toBe(278);
  expect(s.visibleCount).toBe(278);
  // The canvas must contain real rendered pixels, not a blank clear colour.
  const distinct = await page.evaluate(() => {
    // Render synchronously so the drawing buffer is valid in this task.
    (window.__jnn!.viewer as unknown as { renderNow(): void }).renderNow();
    const c = document.querySelector<HTMLCanvasElement>('[data-testid=viewer-canvas]')!;
    const tmp = document.createElement('canvas');
    tmp.width = 64;
    tmp.height = 64;
    const ctx = tmp.getContext('2d')!;
    ctx.drawImage(c, 0, 0, 64, 64);
    const d = ctx.getImageData(0, 0, 64, 64).data;
    const set = new Set<number>();
    for (let i = 0; i < d.length; i += 4) set.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
    return set.size;
  });
  expect(distinct).toBeGreaterThan(20);
});

test('click in 3D selects, reveals in tree and shows properties', async ({ page }) => {
  const roof = await findElementId(page, 'Roofs');
  const p = await screenPoint(page, roof);
  expect(p.onScreen).toBe(true);
  await page.mouse.click(p.x, p.y);
  await expect.poll(() => selection(page)).toEqual([roof]);
  await expect(page.getByTestId('element-name')).toContainText('Flat Roof: Warm Deck 300mm');
  await expect(page.locator('[data-testid=tree-element][aria-selected=true]')).toContainText('Flat Roof');
  expect((await debugState(page)).selected).toEqual([roof]);
});

test('ctrl-click adds to selection; click on empty space clears', async ({ page }) => {
  const roof = await findElementId(page, 'Roofs');
  const door = await findElementId(page, 'Doors');
  const a = await screenPoint(page, roof);
  const b = await screenPoint(page, door);
  await page.mouse.click(a.x, a.y);
  await page.keyboard.down('Control');
  await page.mouse.click(b.x, b.y);
  await page.keyboard.up('Control');
  await expect.poll(() => selection(page)).toEqual([roof, door]);
  await expect(page.getByTestId('multi-properties')).toContainText('2 elements');
  const host = (await page.getByTestId('viewer-host').boundingBox())!;
  await page.mouse.click(host.x + 30, host.y + host.height - 30); // empty background
  await expect.poll(() => selection(page)).toEqual([]);
});

test('dragging orbits the camera without selecting', async ({ page }) => {
  const before = await page.evaluate(() => window.__jnn!.viewer.getCamera());
  const host = (await page.getByTestId('viewer-host').boundingBox())!;
  const cx = host.x + host.width / 2;
  const cy = host.y + host.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 160, cy + 40, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => window.__jnn!.viewer.getCamera());
  expect(after).not.toEqual(before);
  expect(await selection(page)).toEqual([]);
});

test('hide / isolate / show all via keyboard and toolbar', async ({ page }) => {
  const roof = await findElementId(page, 'Roofs');
  const p = await screenPoint(page, roof);
  await page.mouse.click(p.x, p.y);
  await expect.poll(() => selection(page)).toEqual([roof]);
  await page.keyboard.press('h');
  await expect(page.getByTestId('status-visible')).toContainText('277');
  expect((await debugState(page)).visibleCount).toBe(277);
  await page.getByRole('button', { name: 'Show all' }).click();
  await expect(page.getByTestId('status-visible')).toContainText('278');

  await page.getByLabel('Search elements').fill('duct supply');
  await page.getByRole('button', { name: 'Select all matches' }).click();
  await page.getByRole('button', { name: 'Isolate selected' }).click();
  await expect(page.getByTestId('status-visible')).toContainText('12');
  expect((await debugState(page)).visibleCount).toBe(12);
  await page.keyboard.press('a');
  expect((await debugState(page)).visibleCount).toBe(278);
});

test('section plane clips geometry and picking respects it', async ({ page }) => {
  const roof = await findElementId(page, 'Roofs');
  const p = await screenPoint(page, roof);
  await page.keyboard.press('s');
  await expect(page.getByTestId('section-panel')).toBeVisible();
  await expect(page.getByTestId('status-bar')).toContainText('Section Z @ 1.20 m');
  expect((await debugState(page)).clipPlaneCount).toBe(1);
  // The roof is above the cut: clicking where it was must not select it.
  await page.mouse.click(p.x, p.y);
  expect(await selection(page)).not.toContain(roof);

  const slider = page.getByLabel('Section offset');
  await slider.fill('5');
  await expect(page.getByTestId('section-offset')).toHaveText('5.00 m');
  await page.getByRole('radio', { name: 'X' }).click();
  await expect(page.getByTestId('status-bar')).toContainText('Section X');
  await page.getByRole('button', { name: 'Remove section' }).click();
  expect((await debugState(page)).clipPlaneCount).toBe(0);
});

test('section box around selection, x-ray and projection toggles', async ({ page }) => {
  await page.getByLabel('Search elements').fill('entrance door');
  await page.getByRole('button', { name: 'Select all matches' }).click();
  await page.keyboard.press('b');
  await expect(page.getByTestId('section-panel')).toContainText('Section box');
  expect((await debugState(page)).clipPlaneCount).toBe(6);
  await page.keyboard.press('x');
  expect((await debugState(page)).xray).toBe(true);
  await page.keyboard.press('p');
  await expect.poll(async () => (await debugState(page)).projection).toBe('orthographic');
});

test('tree double-click fits, views and theme switch', async ({ page }) => {
  await page.getByRole('button', { name: 'Expand Level 2' }).click();
  await page.getByRole('treeitem', { name: 'Pipes' }).first().dblclick();
  await page.waitForTimeout(600);
  await page.getByRole('navigation', { name: 'Standard views' }).getByRole('button', { name: 'Top', exact: true }).click();
  await page.waitForTimeout(600);
  const cam = await page.evaluate(() => window.__jnn!.viewer.getCamera());
  if (!cam.ok) throw new Error('camera');
  expect(cam.value.position[2] - cam.value.target[2]).toBeGreaterThan(5);
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme === 'dark' ? 'light' : 'dark');
  await page.screenshot({ path: 'test-results/desktop-after-theme.png' });
});
