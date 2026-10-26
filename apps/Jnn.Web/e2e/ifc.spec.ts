import { expect, test } from '@playwright/test';

test.describe('IFC Viewer with That Open Adapter', () => {
  test('loads sample IFC file, renders in 3D, tests Fit and Theme toggle with 0 CDN requests', async ({ page }) => {
    const cdnRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (!url.startsWith('http://localhost') && !url.startsWith('http://127.0.0.1')) {
        cdnRequests.push(url);
      }
    });

    const pageErrors: string[] = [];
    page.on('pageerror', (err) => {
      console.log('PAGE ERROR:', err.message, err.stack);
      pageErrors.push(err.message);
    });
    page.on('console', (msg) => console.log('PAGE CONSOLE:', msg.type(), msg.text()));

    await page.goto('/?debug=1');

    // 1. Initial empty state
    await expect(page.getByTestId('viewer-host')).toHaveAttribute('data-status', 'ready', { timeout: 20_000 });
    await expect(page.getByText('Mở file IFC để bắt đầu')).toBeVisible();

    // 2. Click "Kiến trúc (90 KB)" sample button
    const archBtn = page.getByRole('button', { name: /Kiến trúc \(90 KB\)/i });
    await expect(archBtn).toBeVisible();
    await archBtn.click();

    // 3. Wait for conversion to complete and empty state to disappear
    await expect(page.getByText('Mở file IFC để bắt đầu')).not.toBeVisible({ timeout: 25_000 });
    await expect(page.locator('text=Mở thành công')).toBeVisible({ timeout: 20_000 });

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
});
