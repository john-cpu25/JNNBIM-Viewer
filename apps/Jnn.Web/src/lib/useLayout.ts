import { useSyncExternalStore } from 'react';

export type Layout = 'wide' | 'medium' | 'narrow';

const WIDE = '(min-width: 1280px)';
const NARROW = '(max-width: 767px)';

export function readLayout(): Layout {
  if (typeof window === 'undefined' || !window.matchMedia) return 'wide';
  if (window.matchMedia(WIDE).matches) return 'wide';
  if (window.matchMedia(NARROW).matches) return 'narrow';
  return 'medium';
}

function subscribe(cb: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const qs = [window.matchMedia(WIDE), window.matchMedia(NARROW)];
  qs.forEach((q) => q.addEventListener('change', cb));
  return () => qs.forEach((q) => q.removeEventListener('change', cb));
}

/** Breakpoints: wide ≥1280 (docked panels), medium 768–1279 (drawers), narrow <768 (sheets). */
export function useLayout(): Layout {
  return useSyncExternalStore(subscribe, readLayout, () => 'wide');
}
