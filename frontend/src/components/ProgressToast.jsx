import React from 'react';

export const ProgressToast = ({ isOpen, mode, currentStage, errorText, onClose }) => {
  if (!isOpen) return null;

  const isDone = mode === 'done';
  const isError = mode === 'error';

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[280px] rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-2 top-2 rounded-md p-1 text-slate-400 hover:text-slate-600"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="flex items-center gap-3 pr-4">
        {isDone ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
        ) : isError ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
            </svg>
          </span>
        ) : (
          <svg className="h-4 w-4 animate-spin text-slate-600" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" className="opacity-80" />
          </svg>
        )}
        <div className="text-sm text-slate-700">
          {isDone ? 'Done!' : isError ? (errorText || 'Error processing.') : currentStage || 'Working...'}
        </div>
      </div>
    </div>
  );
};
