import React from 'react';
import { useComputeMode } from '../lib/ComputeModeContext';

export const ComputeModeToggle = () => {
  const { isLocalMode, setIsLocalMode } = useComputeMode();

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
      </span>
    </label>
  );
};
