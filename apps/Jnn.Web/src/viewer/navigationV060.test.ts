import { afterEach, describe, expect, it, vi } from 'vitest';
import CameraControls from 'camera-controls';
import {
  AUTO_ROTATE_MAX_DT,
  AUTO_ROTATE_RAD_PER_SEC,
  autoRotateStep,
  baseMapping,
  dollyToCursorFor,
  intentOnDown,
  isPlanPolar,
  shouldPauseAutoRotate,
  smoothTimeFor,
  usesPivotAnchoring,
  type AutoRotatePauseState,
} from './navigation';
import { DEFAULT_NAV } from './ViewerAdapter';
import { migrateNavSettings, NAV_SETTINGS_VERSION } from '../state/store';
import { AUTO_ROTATE_KEY, loadAutoRotate, saveAutoRotate } from '../lib/autoRotatePref';

const A = CameraControls.ACTION;

describe('v0.6.0 standard preset', () => {
  it('is the default preset', () => {
    expect(DEFAULT_NAV.preset).toBe('standard');
  });

  it('maps LMB orbit, MMB/RMB pan, wheel dolly (zoom in ortho)', () => {
    expect(baseMapping('standard', false)).toEqual({ left: A.ROTATE, middle: A.TRUCK, right: A.TRUCK, wheel: A.DOLLY });
    expect(baseMapping('standard', true).wheel).toBe(A.ZOOM);
  });

  it('intent: LMB orbit immediately, Ctrl+LMB box-select, MMB/RMB pan, Shift ignored', () => {
    expect(intentOnDown('standard', 0, false)).toBe('orbit');
    expect(intentOnDown('standard', 0, true)).toBe('orbit');
    expect(intentOnDown('standard', 0, false, true)).toBe('none');
    expect(intentOnDown('standard', 1, false)).toBe('pan');
    expect(intentOnDown('standard', 1, true)).toBe('pan');
    expect(intentOnDown('standard', 2, false)).toBe('pan');
  });

  it('legacy presets keep their behaviour', () => {
    expect(intentOnDown('revit', 0, false)).toBe('none');
    expect(intentOnDown('revit', 0, true)).toBe('orbit-pending');
    expect(intentOnDown('classic', 0, false)).toBe('orbit-pending');
  });

  it('orbits around view centre, zooms to screen centre with slight inertia', () => {
    expect(usesPivotAnchoring('standard')).toBe(false);
    expect(usesPivotAnchoring('revit')).toBe(true);
    expect(dollyToCursorFor('standard')).toBe(false);
    expect(dollyToCursorFor('classic')).toBe(true);
    expect(smoothTimeFor('standard')).toBeGreaterThan(smoothTimeFor('revit'));
  });
});

describe('nav settings migration v1 → v2', () => {
  it('switches old saved revit preset to standard, keeps speeds', () => {
    const { settings, migrated } = migrateNavSettings({ ...DEFAULT_NAV, preset: 'revit', rotateSpeed: 0.8, zoomSpeed: 1.5 });
    expect(migrated).toBe(true);
    expect(settings.preset).toBe('standard');
    expect(settings.rotateSpeed).toBe(0.8);
    expect(settings.zoomSpeed).toBe(1.5);
    expect((settings as any).version).toBeUndefined();
  });

  it('keeps an explicit choice saved with version 2', () => {
    const { settings, migrated } = migrateNavSettings({ ...DEFAULT_NAV, preset: 'revit', version: NAV_SETTINGS_VERSION });
    expect(migrated).toBe(false);
    expect(settings.preset).toBe('revit');
  });

  it('falls back to default for garbage', () => {
    expect(migrateNavSettings(null).settings).toEqual(DEFAULT_NAV);
    expect(migrateNavSettings({ preset: 'weird', version: 2 }).settings.preset).toBe('standard');
  });
});

describe('auto-rotate', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('step: 1 turn / 60 s, clamped dt, ignores bad dt', () => {
    expect(AUTO_ROTATE_RAD_PER_SEC * 60).toBeCloseTo(2 * Math.PI);
    expect(autoRotateStep(1 / 60)).toBeCloseTo(-AUTO_ROTATE_RAD_PER_SEC / 60);
    expect(autoRotateStep(5)).toBeCloseTo(-AUTO_ROTATE_RAD_PER_SEC * AUTO_ROTATE_MAX_DT);
    expect(autoRotateStep(0)).toBe(0);
    expect(autoRotateStep(-1)).toBe(0);
    expect(autoRotateStep(Number.NaN)).toBe(0);
  });

  it('pauses on any interaction / animation / hidden tab / no model / ortho plan view', () => {
    const idle: AutoRotatePauseState = {
      userControlling: false,
      gestureActive: false,
      gizmoDrag: false,
      walkMode: false,
      measureTool: false,
      cameraAnimating: false,
      documentHidden: false,
      hasModel: true,
      orthoPlanView: false,
    };
    expect(shouldPauseAutoRotate(idle)).toBe(false);
    for (const key of Object.keys(idle) as (keyof AutoRotatePauseState)[]) {
      const s = { ...idle, [key]: !idle[key] };
      expect(shouldPauseAutoRotate(s), key).toBe(true);
    }
  });

  it('plan view detection', () => {
    expect(isPlanPolar(0.01)).toBe(true);
    expect(isPlanPolar(Math.PI - 0.01)).toBe(true);
    expect(isPlanPolar(Math.PI / 3)).toBe(false);
  });

  it('default: on without reduced motion, off with reduced motion; saved choice wins', () => {
    const mm = (reduce: boolean) => vi.fn().mockReturnValue({ matches: reduce });
    vi.stubGlobal('matchMedia', mm(false));
    expect(loadAutoRotate()).toBe(true);
    vi.stubGlobal('matchMedia', mm(true));
    expect(loadAutoRotate()).toBe(false);

    saveAutoRotate(true);
    expect(localStorage.getItem(AUTO_ROTATE_KEY)).toBe('on');
    expect(loadAutoRotate()).toBe(true);
    vi.stubGlobal('matchMedia', mm(false));
    saveAutoRotate(false);
    expect(loadAutoRotate()).toBe(false);
  });
});
