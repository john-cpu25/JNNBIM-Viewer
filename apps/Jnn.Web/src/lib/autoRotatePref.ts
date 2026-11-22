/** Lựa chọn tự xoay, lưu localStorage `jnn-auto-rotate` ('on' | 'off'). */
export const AUTO_ROTATE_KEY = 'jnn-auto-rotate';

export function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Giá trị khởi tạo:
 * - đã lưu → dùng giá trị đã lưu;
 * - chưa lưu → tắt nếu hệ điều hành bật giảm chuyển động, ngược lại bật.
 */
export function loadAutoRotate(): boolean {
  try {
    const raw = localStorage.getItem(AUTO_ROTATE_KEY);
    if (raw === 'on') return true;
    if (raw === 'off') return false;
  } catch {}
  return !prefersReducedMotion();
}

export function saveAutoRotate(on: boolean): void {
  try {
    localStorage.setItem(AUTO_ROTATE_KEY, on ? 'on' : 'off');
  } catch {}
}
