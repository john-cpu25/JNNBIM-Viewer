import { expect, test, type Page } from '@playwright/test';

/**
 * v0.6.0 — điều hướng "Tiêu chuẩn" + tự xoay, chạy trên adapter That Open (/?debug=1 + mẫu Kiến trúc).
 * playwright.config đặt reducedMotion 'reduce' cho mọi test (tự xoay mặc định tắt);
 * các test ở đây tự chọn reducedMotion khi cần.
 */

async function loadArch(page: Page) {
  await expect(page.getByTestId('viewer-host')).toHaveAttribute('data-status', 'ready', { timeout: 20_000 });
  const archBtn = page.getByRole('button', { name: /(Kiến trúc|Architecture) \(90 KB\)/i });
  await expect(archBtn).toBeVisible();
  await archBtn.click();
  await expect(page.getByText('Mở file IFC để bắt đầu')).not.toBeVisible({ timeout: 50_000 });
  await expect(page.locator('text=Mở thành công')).toBeVisible({ timeout: 50_000 });
  await page.waitForTimeout(800);
}

const azimuth = (page: Page) =>
  page.evaluate(() => (window.__jnn!.viewer as any).world.camera.controls.azimuthAngle as number);

const camera = (page: Page) =>
  page.evaluate(() => {
    const c = (window.__jnn!.viewer as any).world.camera.controls;
    const t = c.getTarget({ x: 0, y: 0, z: 0 });
    const p = c.getPosition({ x: 0, y: 0, z: 0 });
    return { target: [t.x, t.y, t.z], position: [p.x, p.y, p.z], distance: c.distance as number, az: c.azimuthAngle as number };
  });

const dist3 = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

async function canvasBox(page: Page) {
  const canvas = page.getByTestId('viewer-host').locator('canvas').first();
  await expect(canvas).toBeVisible();
  return (await canvas.boundingBox())!;
}

/** Đợi tới khi thấy mô hình đang tự quay (azimuth đổi > 0.003 rad trong 1 giây). */
async function expectRotating(page: Page) {
  await expect
    .poll(
      async () => {
        const a = await azimuth(page);
        await page.waitForTimeout(1000);
        return Math.abs((await azimuth(page)) - a);
      },
      { timeout: 20_000, intervals: [100] },
    )
    .toBeGreaterThan(0.003);
}

/** Chờ camera đứng yên (hết quán tính / animation fit sau khi tải). */
async function settle(page: Page, ms = 900) {
  await page.waitForTimeout(ms);
  await waitStill(page);
}

/** Đợi tới khi vị trí camera không đổi trong 400 ms (khi tự xoay đang tắt). */
async function waitStill(page: Page) {
  await expect
    .poll(
      async () => {
        const a = await camera(page);
        await page.waitForTimeout(400);
        const b = await camera(page);
        return dist3(a.position, b.position) + Math.abs(a.az - b.az);
      },
      { timeout: 15_000, intervals: [100] },
    )
    .toBeLessThan(1e-5);
}

test.describe('v0.6.0 Tự xoay', () => {
  test('mặc định bật khi không giảm chuyển động; nút Dừng xoay / Xoay; nhớ sau khi tải lại', async ({ page }) => {
    test.setTimeout(150_000);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/?debug=1');
    await loadArch(page);

    const btn = page.getByTestId('auto-rotate-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Dừng xoay');
    await expect(btn).toHaveAttribute('aria-pressed', 'true');

    // Đang quay: azimuth đổi theo thời gian
    await expectRotating(page);

    // Bấm "Dừng xoay" → đứng yên
    await btn.click();
    await expect(btn).toHaveText('Xoay');
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await settle(page, 300);
    const s0 = await azimuth(page);
    await page.waitForTimeout(1200);
    expect(Math.abs((await azimuth(page)) - s0)).toBeLessThan(1e-4);
    expect(await page.evaluate(() => localStorage.getItem('jnn-auto-rotate'))).toBe('off');

    // Tải lại: vẫn đứng yên
    await page.reload();
    await loadArch(page);
    await expect(page.getByTestId('auto-rotate-btn')).toHaveText('Xoay');
    await waitStill(page);
    const r0 = await azimuth(page);
    await page.waitForTimeout(1200);
    expect(Math.abs((await azimuth(page)) - r0)).toBeLessThan(1e-4);

    // Bấm "Xoay" → quay; tải lại vẫn quay
    await page.getByTestId('auto-rotate-btn').click();
    await expect(page.getByTestId('auto-rotate-btn')).toHaveText('Dừng xoay');
    await page.reload();
    await loadArch(page);
    await expect(page.getByTestId('auto-rotate-btn')).toHaveText('Dừng xoay');
    await expectRotating(page);
  });

  test('giảm chuyển động → mặc định không tự xoay', async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?debug=1');
    await loadArch(page);
    await expect(page.getByTestId('auto-rotate-btn')).toHaveText('Xoay');
    expect(await page.evaluate(() => (window.__jnn!.getState() as any).autoRotate)).toBe(false);
    await waitStill(page);
    const a0 = await azimuth(page);
    await page.waitForTimeout(1200);
    expect(Math.abs((await azimuth(page)) - a0)).toBeLessThan(1e-4);
  });

  test('kéo và cuộn chuột không tắt tự xoay; thả ra quay tiếp', async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/?debug=1');
    await loadArch(page);
    const btn = page.getByTestId('auto-rotate-btn');
    await expect(btn).toHaveText('Dừng xoay');
    await expectRotating(page);

    const box = await canvasBox(page);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    const before = await azimuth(page);
    await page.mouse.move(cx, cy);
    await page.mouse.down({ button: 'left' });
    await page.mouse.move(cx + 150, cy + 20, { steps: 8 });
    await page.mouse.up({ button: 'left' });
    expect(Math.abs((await azimuth(page)) - before)).toBeGreaterThan(0.05);

    await page.mouse.wheel(0, -300);
    await expect(btn).toHaveText('Dừng xoay');
    expect(await page.evaluate(() => (window.__jnn!.getState() as any).autoRotate)).toBe(true);

    // Sau khi quán tính lắng xuống, tự xoay chạy tiếp
    await expectRotating(page);
  });
});

test.describe('v0.6.0 Chuột preset Tiêu chuẩn (tự xoay tắt)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?debug=1');
    await loadArch(page);
    await expect(page.getByTestId('auto-rotate-btn')).toHaveText('Xoay');
    expect(await page.evaluate(() => (window.__jnn!.getState() as any).navigation.preset)).toBe('standard');
    await waitStill(page);
  });

  test('kéo trái: xoay quanh tâm màn hình (target không đổi), không hiện chấm pivot — kể cả bấm ở góc', async ({ page }) => {
    const box = await canvasBox(page);
    for (const [fx, fy] of [
      [0.5, 0.5],
      [0.12, 0.15],
    ] as const) {
      const x = box.x + box.width * fx;
      const y = box.y + box.height * fy;
      const before = await camera(page);
      await page.mouse.move(x, y);
      await page.mouse.down({ button: 'left' });
      await page.mouse.move(x + 120, y + 40, { steps: 8 });
      const pivotVisible = await page.evaluate(() => !!(window.__jnn!.viewer as any).pivotMesh?.visible);
      await page.mouse.up({ button: 'left' });
      await settle(page);
      const after = await camera(page);
      expect(pivotVisible).toBe(false);
      expect(dist3(after.target, before.target)).toBeLessThan(1e-3);
      expect(dist3(after.position, before.position)).toBeGreaterThan(0.05);
      expect(Math.abs(after.distance - before.distance)).toBeLessThan(1e-3);
    }
  });

  test('kéo chuột giữa và chuột phải: pan (target dịch, góc xoay giữ nguyên)', async ({ page }) => {
    const box = await canvasBox(page);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    for (const button of ['middle', 'right'] as const) {
      const before = await camera(page);
      await page.mouse.move(cx, cy);
      await page.mouse.down({ button });
      await page.mouse.move(cx + 100, cy + 50, { steps: 8 });
      await page.mouse.up({ button });
      await settle(page);
      const after = await camera(page);
      expect(dist3(after.target, before.target), button).toBeGreaterThan(0.05);
      expect(Math.abs(after.az - before.az), button).toBeLessThan(5e-3);
    }
  });

  test('cuộn ở góc màn hình: zoom vào giữa (target không đổi), khoảng cách giảm', async ({ page }) => {
    const box = await canvasBox(page);
    const before = await camera(page);
    await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.15);
    await page.mouse.wheel(0, -400);
    await settle(page, 1200);
    const after = await camera(page);
    expect(after.distance).toBeLessThan(before.distance - 0.01);
    expect(dist3(after.target, before.target)).toBeLessThan(1e-3);
  });

  test('Ctrl + kéo trái: kéo khung chọn, camera không xoay', async ({ page }) => {
    const box = await canvasBox(page);
    const before = await camera(page);
    // Kéo từ phải sang trái (crossing). Tránh góc trên phải (ViewCube + nút tự xoay).
    const x0 = box.x + box.width * 0.7;
    const y0 = box.y + box.height * 0.8;
    await page.keyboard.down('Control');
    await page.mouse.move(x0, y0);
    await page.mouse.down({ button: 'left' });
    await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.3, { steps: 10 });
    await page.mouse.up({ button: 'left' });
    await page.keyboard.up('Control');
    await settle(page, 600);
    const after = await camera(page);
    expect(dist3(after.position, before.position)).toBeLessThan(1e-3);
    await expect
      .poll(async () => (await page.evaluate(() => window.__jnn!.viewer.debugState())).selected.length, { timeout: 10_000 })
      .toBeGreaterThan(0);
  });
});

test.describe('v0.6.0 Chuyển đổi cài đặt cũ', () => {
  test('preset revit đã lưu từ bản cũ (không có version) → standard; chọn lại Revit thì giữ', async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem(
          'jnn-nav-settings',
          JSON.stringify({
            preset: 'revit',
            rotateSpeed: 0.7,
            zoomSpeed: 1.0,
            orbitAroundCursor: true,
            orbitAroundSelection: true,
            showPivot: true,
          }),
        );
      }
    });
    await page.goto('/?debug=1');
    await expect(page.getByTestId('viewer-host')).toHaveAttribute('data-status', 'ready', { timeout: 20_000 });
    const nav = await page.evaluate(() => (window.__jnn!.getState() as any).navigation);
    expect(nav.preset).toBe('standard');
    expect(nav.rotateSpeed).toBe(0.7);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jnn-nav-settings') || '{}'));
    expect(saved.version).toBe(2);
    expect(saved.preset).toBe('standard');

    // Người dùng chọn lại Revit → sau khi tải lại vẫn là Revit
    await page.getByTestId('settings-btn').click();
    await page.getByTestId('nav-preset-select').selectOption('revit');
    await page.getByTestId('close-settings-btn').click();
    await page.reload();
    await expect(page.getByTestId('viewer-host')).toHaveAttribute('data-status', 'ready', { timeout: 20_000 });
    expect(await page.evaluate(() => (window.__jnn!.getState() as any).navigation.preset)).toBe('revit');
  });
});
