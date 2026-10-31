import { describe, expect, it } from 'vitest';
import { escapeHtml } from './escapeHtml';

describe('escapeHtml utility', () => {
  it('escapes 5 dangerous HTML characters (&, <, >, ", \')', () => {
    expect(escapeHtml('<script>alert("xss")&\'test\'</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&amp;&#039;test&#039;&lt;/script&gt;',
    );
  });

  it('handles null, undefined and empty string by returning empty string', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml('')).toBe('');
  });

  it('handles numbers correctly', () => {
    expect(escapeHtml(0)).toBe('0');
    expect(escapeHtml(123.45)).toBe('123.45');
    expect(escapeHtml(-42)).toBe('-42');
  });

  it('preserves safe text intact', () => {
    expect(escapeHtml('Hello world 123')).toBe('Hello world 123');
    expect(escapeHtml('Mô hình BIM kết cấu tầng 2')).toBe('Mô hình BIM kết cấu tầng 2');
  });
});
