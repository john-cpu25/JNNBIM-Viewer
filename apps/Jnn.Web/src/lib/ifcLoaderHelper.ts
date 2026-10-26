import type { Dispatch } from 'react';
import type { Action } from '../state/store';
import type { ViewerAdapter } from '../viewer/ViewerAdapter';
import { JNN_SCHEMA_VERSION, type JnnModel } from '../domain/model';

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
  if (!viewer) {
    dispatch({ type: 'notify', tone: 'error', text: 'Viewer chưa sẵn sàng để nạp file.' });
    return false;
  }

  let filename: string;
  let buffer: Uint8Array;

  try {
    if (typeof fileOrUrl === 'string') {
      const url = fileOrUrl;
      filename = url.split('/').pop()?.split('?')[0] || 'model.ifc';
      dispatch({ type: 'notify', tone: 'info', text: `Đang tải file mẫu ${filename}...` });
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const arrayBuffer = await res.arrayBuffer();
      buffer = new Uint8Array(arrayBuffer);
    } else {
      const file = fileOrUrl;
      filename = file.name;
      if (!filename.toLowerCase().endsWith('.ifc')) {
        dispatch({ type: 'notify', tone: 'error', text: `File "${filename}" không phải định dạng IFC.` });
        return false;
      }
      dispatch({ type: 'notify', tone: 'info', text: `Đang đọc file ${filename} (${(file.size / 1024).toFixed(1)} KB)...` });
      const arrayBuffer = await file.arrayBuffer();
      buffer = new Uint8Array(arrayBuffer);
    }

    if (!viewer.loadIfc) {
      dispatch({ type: 'notify', tone: 'error', text: 'Viewer hiện tại không hỗ trợ đọc file IFC.' });
      return false;
    }

    dispatch({
      type: 'notify',
      tone: 'info',
      text: `${options?.append ? 'Đang thêm' : 'Đang nạp'} mô hình IFC: ${filename}...`,
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

    if (options?.append) {
      dispatch({ type: 'appendModel', model: ifcModel });
      dispatch({
        type: 'notify',
        tone: 'info',
        text: `Đã thêm mô hình "${filename}" với ${result.value.elementCount} cấu kiện.`,
      });
    } else {
      dispatch({ type: 'setModel', model: ifcModel });
      dispatch({
        type: 'notify',
        tone: 'info',
        text: `Mở thành công "${filename}" với ${result.value.elementCount} cấu kiện.`,
      });
    }
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    dispatch({ type: 'notify', tone: 'error', text: `Lỗi khi mở IFC: ${message}` });
    return false;
  }
}
