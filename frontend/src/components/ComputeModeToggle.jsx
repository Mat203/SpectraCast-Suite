import React, { useEffect } from 'react';
import { useComputeMode } from '../lib/ComputeModeContext';
import { useHybridCompute } from '../lib/useHybridCompute';

export const ComputeModeToggle = () => {
  const { isLocalMode, setIsLocalMode } = useComputeMode();
  const {
    localRuntimeStatus,
    localRuntimeError,
    warmupLocalRuntime,
  } = useHybridCompute();

  const isRuntimeLoading = isLocalMode && localRuntimeStatus === 'loading';

  useEffect(() => {
    if (!isLocalMode) return;
    warmupLocalRuntime().catch(() => undefined);
  }, [isLocalMode, warmupLocalRuntime]);

  return (
    <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={isLocalMode}
        onChange={(event) => setIsLocalMode(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-2 focus:ring-sky-200"
      />
      <span>
        <span className="block font-semibold text-slate-900">Local computations</span>
        <span className="block text-xs text-slate-500">
          Run Python/pandas locally in the browser via Web Worker (Pyodide) instead of the API.
        </span>
        {isLocalMode && (
          <span className="mt-2 inline-flex items-center gap-2 text-xs text-slate-600">
            <svg
              className="h-3.5 w-3.5 text-slate-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 11V7a4.5 4.5 0 10-9 0v4m-2 0h13a2 2 0 012 2v6a2 2 0 01-2 2h-13a2 2 0 01-2-2v-6a2 2 0 012-2z"
              />
            </svg>
            <span>{isRuntimeLoading ? 'Loading local runtime...' : 'Running locally'}</span>
            {isRuntimeLoading && (
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" className="opacity-80" />
              </svg>
            )}
          </span>
        )}
        {isLocalMode && localRuntimeStatus === 'error' && (
          <span className="mt-1 block text-xs text-rose-600">
            {localRuntimeError || 'Local runtime failed to load. Try toggling off and on.'}
          </span>
        )}
      </span>
    </label>
  );
};
