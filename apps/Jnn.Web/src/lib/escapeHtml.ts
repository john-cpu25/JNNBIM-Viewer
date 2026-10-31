/**
 * Escapes special HTML characters to prevent XSS and preserve text structure.
 */
export function escapeHtml(str: string | number | null | undefined): string {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
