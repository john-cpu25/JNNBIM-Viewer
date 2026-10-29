export * from './types';
export * from './vi';
export * from './en';
export * from './I18nProvider';
export * from './useTranslation';

import type { Locale, TranslationKey } from './types';
import { vi } from './vi';
import { en } from './en';

export function translate(
  key: TranslationKey,
  params?: Record<string, string | number>,
  locale: Locale = 'vi',
): string {
  const dict = locale === 'en' ? en : vi;
  let str = dict[key] || vi[key] || (key as string);
  if (params) {
    for (const [pKey, pVal] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal));
    }
  }
  return str;
}

