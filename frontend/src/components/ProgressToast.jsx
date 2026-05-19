import React from 'react';

export const ProgressToast = ({ isProcessing, currentStage }) => {
  if (!isProcessing) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[280px] rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl">
      <div className="flex items-center gap-3">
        <svg className="h-4 w-4 animate-spin text-slate-600" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" className="opacity-80" />
        </svg>
        <div className="text-sm text-slate-700">
          {currentStage || 'Працюємо...'}
        </div>
      </div>
    </div>
  );
};
