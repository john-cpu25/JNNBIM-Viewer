import { expect, type Page } from '@playwright/test';

export async function openViewer(page: Page, options?: { locale?: 'vi' | 'en' }) {
  await page.addInitScript((loc) => {
    try {
      localStorage.setItem('jnn-locale', loc || 'en');
    } catch {}
  }, options?.locale || 'en');
  await page.goto('/?debug=1&sample=1');
  await expect(page.getByTestId('viewer-host')).toHaveAttribute('data-status', 'ready', { timeout: 20_000 });
  // let the initial camera settle
  await page.waitForTimeout(300);
}

/** Id of the first element matching a predicate on (category, type). */
export async function findElementId(page: Page, category: string, typeIncludes = ''): Promise<string> {
  return page.evaluate(
    ([c, t]) => {
      const s = window.__jnn!.getState() as { model: { elements: { id: string; category: string; type: string }[] } };
      return s.model.elements.find((e) => e.category === c && e.type.includes(t))!.id;
    },
    [category, typeIncludes] as const,
  );
}

/** Page coordinates of an element's centre on screen. */
export async function screenPoint(page: Page, id: string) {
  const p = await page.evaluate((elId) => window.__jnn!.viewer.projectToScreen(elId), id);
  if (!p.ok) throw new Error(p.message);
  const box = (await page.getByTestId('viewer-host').boundingBox())!;
  return { x: box.x + p.value.x, y: box.y + p.value.y, onScreen: p.value.onScreen };
}

export const debugState = (page: Page) =>
  page.evaluate(() => window.__jnn!.viewer.debugState());

export const selection = (page: Page) =>
  page.evaluate(() => (window.__jnn!.getState() as { selection: string[] }).selection);
