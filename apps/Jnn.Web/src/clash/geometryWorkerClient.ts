import type {
  BuildBVHMessage,
  BuildBVHSuccessResponse,
  GeometryWorkerResponse,
} from './geometry.worker';
import { processBuildBVH } from './geometry.worker';

export interface IGeometryWorker {
  postMessage(message: BuildBVHMessage, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<GeometryWorkerResponse>) => void) | null;
  onerror: ((event: any) => void) | null;
  terminate(): void;
}

/**
 * Creates a Geometry worker.
 * In a browser environment, uses new Worker(..., { type: 'module' }).
 * In Node/Vitest where Worker is not present, creates an async bridge that executes processBuildBVH off the caller's call stack.
 */
export function createGeometryWorker(): IGeometryWorker {
  if (typeof Worker !== 'undefined') {
    return new Worker(new URL('./geometry.worker.ts', import.meta.url), { type: 'module' });
  }

  // Simulated Web Worker for Vitest/headless Node testing
  let isTerminated = false;
  const bridge: IGeometryWorker = {
    onmessage: null,
    onerror: null,
    postMessage(message: BuildBVHMessage, _transfer?: Transferable[]) {
      if (isTerminated) return;
      // Transfer semantics: emulate detach by transferring or copying
      const positionsCopy = message.positions.slice(0);
      const indicesCopy = message.indices.slice(0);

      // Async dispatch simulating Web Worker event loop
      setTimeout(() => {
        if (isTerminated) return;
        try {
          const res = processBuildBVH({
            ...message,
            positions: positionsCopy,
            indices: indicesCopy,
          });
          bridge.onmessage?.({ data: res } as MessageEvent<GeometryWorkerResponse>);
        } catch (err: any) {
          if (bridge.onerror) {
            bridge.onerror(err);
          } else {
            bridge.onmessage?.({
              data: {
                type: 'BUILD_BVH_ERROR',
                id: message.id,
                error: err.message,
              },
            } as MessageEvent<GeometryWorkerResponse>);
          }
        }
      }, 0);
    },
    terminate() {
      isTerminated = true;
    },
  };
  return bridge;
}

export class GeometryWorkerClient {
  private worker: IGeometryWorker;

  constructor() {
    this.worker = createGeometryWorker();
  }

  public buildBVH(
    id: string | number,
    positions: Float32Array,
    indices: Uint32Array,
  ): Promise<BuildBVHSuccessResponse> {
    return new Promise((resolve, reject) => {
      const handleMessage = (e: MessageEvent<GeometryWorkerResponse>) => {
        const data = e.data;
        if (data.id === id) {
          if (data.type === 'BUILD_BVH_SUCCESS') {
            resolve(data);
          } else {
            reject(new Error(data.error));
          }
        }
      };

      this.worker.onmessage = handleMessage;
      this.worker.onerror = (err: any) => reject(err);

      // Pass buffers as Transferable
      const posBuffer = positions.slice().buffer as ArrayBuffer;
      const idxBuffer = indices.slice().buffer as ArrayBuffer;

      this.worker.postMessage(
        {
          type: 'BUILD_BVH',
          id,
          positions: posBuffer,
          indices: idxBuffer,
        },
        [posBuffer, idxBuffer],
      );
    });
  }

  public terminate(): void {
    this.worker.terminate();
  }
}
