import { expect, test } from '@playwright/test';
import { findElementId, openViewer, screenPoint, selection } from './helpers';

test('phone layout: bottom navigation drives panels', async ({ page }) => {
  await openViewer(page);
  const nav = page.getByRole('navigation', { name: 'Panels' });
  await expect(nav).toBeVisible();
  await expect(page.getByTestId('explorer-panel')).toHaveCount(0);

  // Tap an element in 3D, then open Properties.
  const roof = await findElementId(page, 'Roofs');
  const p = await screenPoint(page, roof);
  await page.mouse.click(p.x, p.y);
  await expect.poll(() => selection(page)).toEqual([roof]);
  await nav.getByRole('button', { name: /Properties/ }).click();
  await expect(page.getByTestId('element-name')).toContainText('Flat Roof');

  // Model tab: search and select.
  await nav.getByRole('button', { name: 'Model' }).click();
  await page.getByLabel('Search elements').fill('entrance door');
  await page.getByTestId('tree-element').first().click();
  await nav.getByRole('button', { name: /Properties/ }).click();
  await expect(page.getByTestId('element-name')).toContainText('Entrance Door');

  // No horizontal page scroll at phone width.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await nav.getByRole('button', { name: 'Viewer' }).click();
  await page.screenshot({ path: 'test-results/mobile-viewer.png' });
});
