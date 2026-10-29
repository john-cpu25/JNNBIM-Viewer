import React, { createContext, useContext, useState, useMemo } from 'react';
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

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    try {
      localStorage.setItem(STORAGE_KEY, nextLocale);
    } catch {}
  };

  const translations = useMemo(() => (locale === 'en' ? en : vi), [locale]);

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    let str = translations[key] || vi[key] || (key as string);
    if (params) {
      for (const [pKey, pVal] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal));
      }
    }
    return str;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: 'vi',
      setLocale: () => {},
      t: (key: TranslationKey, params?: Record<string, string | number>) => {
        let str = vi[key] || (key as string);
        if (params) {
          for (const [pKey, pVal] of Object.entries(params)) {
            str = str.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal));
          }
        }
        return str;
      },
    };
  }
  return ctx;
}
