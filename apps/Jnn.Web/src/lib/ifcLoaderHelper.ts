import type { Dispatch } from 'react';
import type { Action } from '../state/store';
import type { ViewerAdapter } from '../viewer/ViewerAdapter';
import { JNN_SCHEMA_VERSION, type JnnModel } from '../domain/model';
import { translate, type Locale } from '../i18n';

function getCurrentLocale(): Locale {
  try {
    const saved = localStorage.getItem('jnn-locale');
    if (saved === 'vi' || saved === 'en') return saved;
  } catch {}
  return 'vi';
}

export interface LoadIfcOptions {
  onProgress?: (percent: number, status?: string) => void;
  append?: boolean;
}

export async function loadIfcFile(
  fileOrUrl: File | string,
  viewer: ViewerAdapter | null,
  dispatch: Dispatch<Action>,
  options?: LoadIfcOptions,
): Promise<boolean> {
  const loc = getCurrentLocale();

  if (!viewer) {
    dispatch({ type: 'notify', tone: 'error', text: translate('loader.notReady', undefined, loc) });
    return false;
  }

  let filename: string;
  let buffer: Uint8Array;

  try {
    if (typeof fileOrUrl === 'string') {
      const url = fileOrUrl;
      filename = url.split('/').pop()?.split('?')[0] || 'model.ifc';
      dispatch({ type: 'notify', tone: 'info', text: translate('loader.downloadingSample', { filename }, loc) });
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const arrayBuffer = await res.arrayBuffer();
      buffer = new Uint8Array(arrayBuffer);
    } else {
      const file = fileOrUrl;
      filename = file.name;
      if (!filename.toLowerCase().endsWith('.ifc')) {
        dispatch({ type: 'notify', tone: 'error', text: translate('loader.notIfc', { filename }, loc) });
        return false;
      }
      dispatch({
        type: 'notify',
        tone: 'info',
        text: translate('loader.readingFile', { filename, size: (file.size / 1024).toFixed(1) }, loc),
      });
      const arrayBuffer = await file.arrayBuffer();
      buffer = new Uint8Array(arrayBuffer);
    }

    if (!viewer.loadIfc) {
      dispatch({ type: 'notify', tone: 'error', text: translate('loader.notSupported', undefined, loc) });
      return false;
    }

    dispatch({
      type: 'notify',
      tone: 'info',
      text: options?.append
        ? translate('loader.addingModel', { filename }, loc)
        : translate('loader.loadingModel', { filename }, loc),
    });

    const result = await viewer.loadIfc(
      buffer,
      filename,
      (percent, status) => {
        options?.onProgress?.(percent, status);
      },
      { append: options?.append },
    );

    if (!result.ok) {
      dispatch({ type: 'notify', tone: 'error', text: result.message });
      return false;
    }

    const ifcModel: JnnModel = result.value.model ?? {
      schemaVersion: JNN_SCHEMA_VERSION,
      modelId: filename,
      name: filename,
      projectName: 'IFC Project',
      siteName: 'Default Site',
      buildingName: 'Default Building',
      modelRevisionId: 'rev-001',
      sourceFormat: 'IFC',
      units: 'm',
      upAxis: 'Z',
      storeys: [],
      elements: [],
    };

    const fromCacheNote = result.value.fromCache ? translate('loader.fromCache', undefined, loc) : '';
    if (options?.append) {
      dispatch({ type: 'appendModel', model: ifcModel });
      dispatch({
        type: 'notify',
        tone: 'info',
        text: translate(
          'loader.appendedSuccess',
          { filename, count: result.value.elementCount, cache: fromCacheNote },
          loc,
        ),
      });
    } else {
      dispatch({ type: 'setModel', model: ifcModel });
      dispatch({
        type: 'notify',
        tone: 'info',
        text: translate(
          'loader.openedSuccess',
          { filename, count: result.value.elementCount, cache: fromCacheNote },
          loc,
        ),
      });
    }
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    dispatch({
      type: 'notify',
      tone: 'error',
      text: translate('loader.errorOpening', { message }, loc),
    });
    return false;
  }
}
