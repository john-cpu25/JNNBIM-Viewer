import type {
  ClashWorkerIncomingMessage,
  ClashWorkerOutgoingMessage,
  SerializedElementPayload,
} from './clash.worker';
import {
  loadElementsIntoWorker,
  executeTestInWorker,
  cancelWorkerTest,
} from './clash.worker';
import type { ClashProgress, ClashRunSummary, ClashTestConfig } from './engine';
import type { ClashResult } from './narrowphase';

export interface IClashWorker {
  postMessage(message: ClashWorkerIncomingMessage, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<ClashWorkerOutgoingMessage>) => void) | null;
  onerror: ((event: any) => void) | null;
  terminate(): void;
}

export function createClashWorker(): IClashWorker {
  if (typeof Worker !== 'undefined') {
    return new Worker(new URL('./clash.worker.ts', import.meta.url), { type: 'module' });
  }

  // Simulated Web Worker bridge for Vitest / Node test runner
  let isTerminated = false;
  const bridge: IClashWorker = {
    onmessage: null,
    onerror: null,
    postMessage(message: ClashWorkerIncomingMessage) {
      if (isTerminated) return;

      setTimeout(async () => {
        if (isTerminated) return;
        try {
          if (message.type === 'LOAD_ELEMENTS') {
            const count = loadElementsIntoWorker(message.elements);
            bridge.onmessage?.({ data: { type: 'ELEMENTS_LOADED', count } } as MessageEvent<ClashWorkerOutgoingMessage>);
          } else if (message.type === 'CLEAR_ELEMENTS') {
            // clear
          } else if (message.type === 'RUN_TEST') {
            await executeTestInWorker(
              message.testConfig,
              (outMsg) => {
                if (!isTerminated) {
                  bridge.onmessage?.({ data: outMsg } as MessageEvent<ClashWorkerOutgoingMessage>);
                }
              },
              message.batchSize,
            );
          } else if (message.type === 'CANCEL_TEST') {
            cancelWorkerTest();
          }
        } catch (err: any) {
          if (bridge.onerror) {
            bridge.onerror(err);
          } else {
            bridge.onmessage?.({ data: { type: 'ERROR', error: err.message } } as MessageEvent<ClashWorkerOutgoingMessage>);
          }
        }
      }, 0);
    },
    terminate() {
      isTerminated = true;
      cancelWorkerTest();
    },
  };
  return bridge;
}

export class ClashWorkerClient {
  private worker: IClashWorker;

  constructor() {
    this.worker = createClashWorker();
  }

  public loadElements(elements: SerializedElementPayload[]): Promise<number> {
    return new Promise((resolve, reject) => {
      const handler = (e: MessageEvent<ClashWorkerOutgoingMessage>) => {
        if (e.data.type === 'ELEMENTS_LOADED') {
          resolve(e.data.count);
        } else if (e.data.type === 'ERROR') {
          reject(new Error(e.data.error));
        }
      };
      this.worker.onmessage = handler;
      this.worker.onerror = reject;

      // Collect transferable buffers
      const transfer: Transferable[] = [];
      for (const el of elements) {
        if (el.positions instanceof ArrayBuffer) transfer.push(el.positions);
        if (el.indices instanceof ArrayBuffer) transfer.push(el.indices);
      }

      this.worker.postMessage({ type: 'LOAD_ELEMENTS', elements }, transfer);
    });
  }

  public runTest(
    testConfig: ClashTestConfig,
    callbacks?: {
      onProgress?: (progress: ClashProgress) => void;
      onBatch?: (batch: ClashResult[]) => void;
    },
    batchSize = 50,
  ): Promise<ClashRunSummary> {
    return new Promise((resolve, reject) => {
      this.worker.onmessage = (e: MessageEvent<ClashWorkerOutgoingMessage>) => {
        const data = e.data;
        if (data.type === 'PROGRESS') {
          callbacks?.onProgress?.(data.progress);
        } else if (data.type === 'BATCH_RESULTS') {
          callbacks?.onBatch?.(data.batch);
        } else if (data.type === 'COMPLETED') {
          resolve(data.summary);
        } else if (data.type === 'ERROR') {
          reject(new Error(data.error));
        }
      };
      this.worker.onerror = reject;

      this.worker.postMessage({ type: 'RUN_TEST', testConfig, batchSize });
    });
  }

  public cancel(): void {
    this.worker.postMessage({ type: 'CANCEL_TEST' });
  }

  public terminate(): void {
    this.worker.terminate();
  }
}

