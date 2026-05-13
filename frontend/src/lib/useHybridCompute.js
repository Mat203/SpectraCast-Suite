import { useCallback, useMemo, useRef, useState } from 'react';
import { apiFetch } from './api';
import { useComputeMode } from './ComputeModeContext';

let sharedWorker;
let workerReady = false;
let nextRequestId = 1;
const pendingRequests = new Map();

const ensureWorker = () => {
  if (!sharedWorker) {
    sharedWorker = new Worker(
      new URL('../workers/pyodide.worker.js', import.meta.url),
      { type: 'module' },
    );
  }

  if (!workerReady) {
    sharedWorker.onmessage = (event) => {
      const { id, type, data, error, stdout, stderr } = event.data || {};
      const pending = pendingRequests.get(id);
      if (!pending) return;
      pendingRequests.delete(id);
      if (type === 'error') {
        const err = new Error(error?.message || 'Worker failed');
        err.name = error?.kind === 'memory' ? 'OutOfMemoryError' : 'WorkerError';
        pending.reject(err);
        return;
      }
      pending.resolve({ data, stdout, stderr });
    };
    sharedWorker.onerror = (event) => {
      pendingRequests.forEach((pending) => pending.reject(event.error || event.message));
      pendingRequests.clear();
    };
    workerReady = true;
  }

  return sharedWorker;
};

const runInWorker = (pythonCode, csvData, context, packages) => {
  const worker = ensureWorker();
  const id = nextRequestId++;

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    worker.postMessage({ id, pythonCode, csvData, context, packages });
  });
};

export const useHybridCompute = () => {
  const { isLocalMode } = useComputeMode();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const execute = useCallback(async (serverEndpoint, payload, localPythonCode) => {
    setIsLoading(true);
    setError(null);

    try {
      if (isLocalMode) {
        const localConfig =
          typeof localPythonCode === 'string'
            ? { code: localPythonCode }
            : localPythonCode || {};

        if (!localConfig.code) {
          throw new Error('Local compute mode requires python code.');
        }

        const csvData =
          typeof payload?.csvData === 'string'
            ? payload.csvData
            : payload?.file
              ? await payload.file.text()
              : null;

        if (!csvData) {
          throw new Error('Local compute mode requires payload.file or payload.csvData.');
        }

        const { file, ...context } = payload || {};
        const result = await runInWorker(localConfig.code, csvData, context, localConfig.packages);
        const resolved =
          result?.data && typeof result.data === 'object' && 'type' in result.data
            ? result.data.value
            : result.data;
        setData(resolved);
        return resolved;
      }

      if (!serverEndpoint) {
        throw new Error('Server endpoint is required when local mode is disabled.');
      }

      const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;
      const response = await apiFetch(serverEndpoint, {
        method: 'POST',
        headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
        body: isFormData ? payload : JSON.stringify(payload ?? {}),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `Request failed (HTTP ${response.status})`);
      }

      const json = await response.json();
      setData(json);
      return json;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected compute error';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isLocalMode]);

  return useMemo(
    () => ({
      execute,
      isLoading,
      error,
      data,
    }),
    [execute, isLoading, error, data],
  );
};
