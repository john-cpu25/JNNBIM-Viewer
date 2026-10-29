import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { I18nProvider, useTranslation } from './index';
import { vi } from './vi';
import { en } from './en';

describe('i18n internationalization framework', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('provides Vietnamese as default locale and translates correctly', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <I18nProvider>{children}</I18nProvider>
    );
    const { result } = renderHook(() => useTranslation(), { wrapper });

    expect(result.current.locale).toBe('vi');
    expect(result.current.t('topbar.openIfc')).toBe(vi['topbar.openIfc']);
    expect(result.current.t('toolbar.fitAll')).toBe(vi['toolbar.fitAll']);
  });

  it('switches to English and persists in localStorage', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <I18nProvider>{children}</I18nProvider>
    );
    const { result } = renderHook(() => useTranslation(), { wrapper });

    act(() => {
      result.current.setLocale('en');
    });

    expect(result.current.locale).toBe('en');
    expect(result.current.t('topbar.openIfc')).toBe(en['topbar.openIfc']);
    expect(localStorage.getItem('jnn-locale')).toBe('en');
  });

  it('replaces template parameters in translations', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <I18nProvider>{children}</I18nProvider>
    );
    const { result } = renderHook(() => useTranslation(), { wrapper });

    const translatedVi = result.current.t('properties.selectionCount', { count: 5 });
    expect(translatedVi).toBe('Đang chọn 5 cấu kiện');

    act(() => {
      result.current.setLocale('en');
    });

    const translatedEn = result.current.t('properties.selectionCount', { count: 5 });
    expect(translatedEn).toBe('5 elements selected');
  });

  it('has identical keys in vi and en translation bundles', () => {
    const viKeys = Object.keys(vi).sort();
    const enKeys = Object.keys(en).sort();

    expect(viKeys).toEqual(enKeys);
  });

  it('memoizes t() and prevents infinite render loops when effect triggers dispatch', async () => {
    let effectCount = 0;
    function TestConsumer({ dispatch }: { dispatch: (action: { type: string }) => void }) {
      const { t } = useTranslation();
      React.useEffect(() => {
        effectCount++;
        dispatch({ type: 'NOTIFY' });
      }, [t, dispatch]);
      return <div>{t('common.close')}</div>;
    }

    function TestApp() {
      const [state, dispatch] = React.useReducer((s: number) => s + 1, 0);
      return (
        <I18nProvider>
          <div>State: {state}</div>
          <TestConsumer dispatch={dispatch} />
        </I18nProvider>
      );
    }

    const { render } = await import('@testing-library/react');
    const { getByText } = render(<TestApp />);
    expect(getByText('State: 1')).toBeDefined();
    expect(effectCount).toBe(1);
  });
});
