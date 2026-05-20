import React, { useEffect, useRef, useState } from 'react';

interface ChartActionButtonsProps {
  onDownload: () => void;
  isDownloadDisabled?: boolean;
  chartCode: string;
}

export const ChartActionButtons: React.FC<ChartActionButtonsProps> = ({
  onDownload,
  isDownloadDisabled = false,
  chartCode,
}) => {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    if (!chartCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(chartCode);
      setCopied(true);

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy chart code.', err);
    }
  };

  const copyDisabled = !chartCode;

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onDownload}
        disabled={isDownloadDisabled}
        className="text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Download Image
      </button>
      <button
        type="button"
        onClick={handleCopy}
        disabled={copyDisabled}
        className="text-emerald-600 hover:text-emerald-700 text-sm font-medium flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {copied ? (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 5h8a2 2 0 012 2v10a2 2 0 01-2 2H8a2 2 0 01-2-2V7a2 2 0 012-2z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 5V4a2 2 0 012-2h4a2 2 0 012 2v1" />
          </svg>
        )}
        {copied ? 'Copied!' : 'Copy Code'}
      </button>
    </div>
  );
};
