import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { Locale, TranslationKey } from './types';
import { vi } from './vi';
import { en } from './en';

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'jnn-locale';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'vi' || saved === 'en') return saved;
    } catch {}
    return 'vi'; // Default: Vietnamese
  });

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    try {
      localStorage.setItem(STORAGE_KEY, nextLocale);
    } catch {}
  }, []);

  const translations = useMemo(() => (locale === 'en' ? en : vi), [locale]);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      let str = translations[key] || vi[key] || (key as string);
      if (params) {
        for (const [pKey, pVal] of Object.entries(params)) {
          str = str.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal));
        }
      }
      return str;
    },
    [translations],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

const fallbackTranslate = (key: TranslationKey, params?: Record<string, string | number>): string => {
  let str = vi[key] || (key as string);
  if (params) {
    for (const [pKey, pVal] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal));
    }
  }
  return str;
};

const fallbackValue: I18nContextValue = {
  locale: 'vi',
  setLocale: () => {},
  t: fallbackTranslate,
};

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  return ctx || fallbackValue;
}
