import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, downloadFile } from '../lib/api';
import { STRATEGY_DESCRIPTIONS } from '../lib/outlierStrategies';
import type { OutlierStrategyKey } from '../lib/outlierStrategies';
import { MISSING_VALUES_DESCRIPTIONS } from '../lib/missingValueStrategies';
import type { MissingStrategyKey } from '../lib/missingValueStrategies';

interface UploadResponse {
  status: string;
  file_id: string;
  original_filename?: string;
}

interface PreviewSeries {
  x: string[];
  before: Array<number | null>;
  after: Array<number | null>;
}

interface OutlierPreviewResponse {
  column: string;
  strategy: string;
  x: string[];
  before: Array<number | null>;
  after: Array<number | null>;
}

interface MissingPreviewResponse {
  column: string;
  strategy: string;
  x: string[];
  before: Array<number | null>;
  after: Array<number | null>;
}

interface ScanReport {
  rows: number;
  columns: string[];
  outliers: Record<string, number>;
  outlier_strategy_recommendations?: Record<
    string,
    {
      skew: number;
      strategy: string;
      reasoning: string;
    }
  >;
  missing_values: Record<string, number>;
  missing_value_strategy_recommendations?: Record<
    string,
    {
      strategy_code: MissingStrategyKey;
      strategy: string;
      reasoning: string;
      metrics?: {
        cv?: number;
        autocorr_lag1?: number;
        seasonal_corr?: number;
        missing_ratio?: number;
        max_corr?: number;
      };
    }
  >;
  frequency: string;
  display_frequency: string;
  missing_dates_count: number;
  missing_dates: string[];
  dataset_preview: Array<Record<string, unknown>>;
  time_series_message?: string;
  has_datetime_axis?: boolean;
}

export const DataQualityView: React.FC = () => {
  const WarningBanner = ({ message }: { message: string }) => (
    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
      {message}
    </div>
  );
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ScanReport | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isFixingTimestamps, setIsFixingTimestamps] = useState(false);
  const [originalFilename, setOriginalFilename] = useState<string | null>(null);

  const [selectedOutlierCol, setSelectedOutlierCol] = useState<string | null>(null);
  const [isOutlierModalOpen, setIsOutlierModalOpen] = useState(false);
  const [outlierStrategy, setOutlierStrategy] = useState<OutlierStrategyKey>('clip_iqr');
  const [strategyPreview, setStrategyPreview] = useState<OutlierStrategyKey>('clip_iqr');
  const [isStrategyPanelVisible, setIsStrategyPanelVisible] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [previewData, setPreviewData] = useState<OutlierPreviewResponse | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [selectedMissingCol, setSelectedMissingCol] = useState<string | null>(null);
  const [isMissingModalOpen, setIsMissingModalOpen] = useState(false);
  const [missingStrategy, setMissingStrategy] = useState<MissingStrategyKey>('3'); // Default: Forward Fill
  const [missingStrategyPreview, setMissingStrategyPreview] = useState<MissingStrategyKey>('3');
  const [isMissingPanelVisible, setIsMissingPanelVisible] = useState(false);
  const [missingPreviewData, setMissingPreviewData] = useState<MissingPreviewResponse | null>(null);
  const [isMissingPreviewLoading, setIsMissingPreviewLoading] = useState(false);
  const [missingPreviewError, setMissingPreviewError] = useState<string | null>(null);

  const [fileId, setFileId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const previewColumns = useMemo(() => {
    if (!report?.dataset_preview?.length) {
      return [];
    }

    return Array.from(
      report.dataset_preview.reduce((keys, row) => {
        Object.keys(row).forEach((key) => keys.add(key));
        return keys;
      }, new Set<string>()),
    );
  }, [report]);

  const formatCellValue = (value: unknown) => {
    if (value === null || value === undefined) {
      return '—';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  };

  const hasDatetimeAxis = report?.has_datetime_axis !== false;

  const renderPreviewChart = (data: PreviewSeries | null, showBefore: boolean = true) => {
    if (!data) {
      return null;
    }

    const combinedValues = [...(showBefore ? data.before : []), ...data.after].filter(
      (value): value is number => typeof value === 'number' && !Number.isNaN(value),
    );

    if (combinedValues.length === 0) {
      return (
        <div className="flex h-40 items-center justify-center text-xs text-slate-500">
          Not enough numeric values to plot.
        </div>
      );
    }

    const minY = Math.min(...combinedValues);
    const maxY = Math.max(...combinedValues);
    const range = maxY - minY || 1;
    const width = 440;
    const height = 176;

    const formatXAxisLabel = (value: string) => {
      if (!value) {
        return '';
      }
      const [datePart] = value.split('T');
      return datePart || value;
    };

    const startLabel = formatXAxisLabel(data.x[0] ?? '');
    const endLabel = formatXAxisLabel(data.x[data.x.length - 1] ?? '');

    const buildPath = (values: Array<number | null>) => {
      let path = '';
      let started = false;
      const lastIndex = values.length - 1;

      values.forEach((value, index) => {
        if (value === null || Number.isNaN(value)) {
          started = false;
          return;
        }

        const x = lastIndex === 0 ? 0 : (index / lastIndex) * width;
        const y = height - ((value - minY) / range) * height;

        if (!started) {
          path += `M ${x} ${y}`;
          started = true;
        } else {
          path += ` L ${x} ${y}`;
        }
      });

      return path;
    };

    return (
      <div className="space-y-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full">
          {showBefore && (
            <path
              d={buildPath(data.before)}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          )}
          <path
            d={buildPath(data.after)}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={2.5}
          />
        </svg>
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>{startLabel}</span>
          <span className="uppercase tracking-[0.2em]">Time</span>
          <span>{endLabel}</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-slate-500">
          {showBefore && (
            <span className="flex items-center gap-2">
              <span className="h-0.5 w-6 border-b-2 border-dashed border-slate-400" />
              Before
            </span>
          )}
          <span className="flex items-center gap-2">
            <span className="h-0.5 w-6 bg-blue-500" />
            After applying strategy
          </span>
        </div>
      </div>
    );
  };

  const handleFileSelect = (nextFile: File | null) => {
    if (!nextFile) {
      return;
    }

    if (!nextFile.name.toLowerCase().endsWith('.csv')) {
      setError('Only .csv files are supported.');
      return;
    }

    setError(null);
    setReport(null);
    setFileId(null);
    setOriginalFilename(nextFile.name);
    setFile(nextFile);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files?.[0] ?? null;
    handleFileSelect(droppedFile);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleScan = async (useExistingFile: boolean = false) => {
    if (!file && !useExistingFile) {
      setError('Select a .csv file before scanning.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let currentFileId = fileId;

      if (!useExistingFile || !currentFileId) {
        if (!file) throw new Error('No file selected.');
        const formData = new FormData();
        formData.append('file', file);

        const uploadResponse = await apiFetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed (${uploadResponse.status})`);
        }

        const uploadResult = (await uploadResponse.json()) as UploadResponse;

        if (!uploadResult.file_id) {
          throw new Error('Upload succeeded but file_id was missing.');
        }

        currentFileId = uploadResult.file_id;
        setFileId(currentFileId);
      }

      const scanResponse = await apiFetch('/api/dq/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file_id: currentFileId }),
      });

      if (!scanResponse.ok) {
        let errorBody = 'Unknown error';
        try {
          const errorData = (await scanResponse.json()) as { detail?: string };
          errorBody = errorData.detail || `HTTP ${scanResponse.status}`;
        } catch {
          errorBody = `HTTP ${scanResponse.status}`;
        }
        throw new Error(`Scan failed: ${errorBody}`);
      }

      const scanResult = (await scanResponse.json()) as ScanReport;
      setReport(scanResult);
    } catch (scanError) {
      const message =
        scanError instanceof TypeError
          ? 'Could not reach API at http://127.0.0.1:8000. Start the backend server and try again.'
          : scanError instanceof Error
            ? scanError.message
            : 'Request failed unexpectedly.';
      console.error('Scan error:', scanError);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOutlierClick = (column: string) => {
    const recommendation = report?.outlier_strategy_recommendations?.[column]?.strategy;
    const resolvedStrategy = recommendation === 'iqr_clip' ? 'clip_iqr' : recommendation;
    setSelectedOutlierCol(column);
    const nextStrategy = (resolvedStrategy || 'clip_iqr') as OutlierStrategyKey;
    setOutlierStrategy(nextStrategy);
    setStrategyPreview(nextStrategy);
    setIsStrategyPanelVisible(true);
    setPreviewData(null);
    setPreviewError(null);
    setIsOutlierModalOpen(true);
  };

  const resolveFileId = async () => {
    let currentFileId = fileId;

    if (!currentFileId && file) {
      const uploadResponse = await apiFetch('/api/upload', {
        method: 'POST',
        body: (() => { const fd = new FormData(); fd.append('file', file); return fd; })(),
      });

      if (!uploadResponse.ok) throw new Error('Upload failed');
      const uploadResult = await uploadResponse.json() as UploadResponse;
      currentFileId = uploadResult.file_id;
      setFileId(currentFileId);
      setOriginalFilename(uploadResult.original_filename || file?.name || null);
      setOriginalFilename(uploadResult.original_filename || file?.name || null);
    }

    if (!currentFileId) throw new Error('No file available for processing');
    return currentFileId;
  };

  const handleApplyOutlierStrategy = async () => {
    if (!selectedOutlierCol) return;

    setIsProcessingAction(true);
    setError(null);

    try {
      const currentFileId = await resolveFileId();

      const actionRes = await apiFetch('/api/dq/handle-outliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: currentFileId,
          column: selectedOutlierCol,
          strategy: outlierStrategy
        })
      });

      if (!actionRes.ok) {
        const errorData = await actionRes.json() as { detail?: string };
        throw new Error(errorData.detail || 'Failed to handle outliers');
      }

      setIsOutlierModalOpen(false);
      await handleScan(true);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handlePreviewOutliers = async () => {
    if (!selectedOutlierCol) return;
    setIsPreviewLoading(true);
    setPreviewError(null);

    try {
      const currentFileId = await resolveFileId();
      const response = await apiFetch('/api/dq/preview-outliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: currentFileId,
          column: selectedOutlierCol,
          strategy: outlierStrategy,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as { detail?: string };
        throw new Error(errorData.detail || 'Preview failed');
      }

      const previewResult = (await response.json()) as OutlierPreviewResponse;
      setPreviewData(previewResult);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleMissingClick = (column: string) => {
    const recommendation = report?.missing_value_strategy_recommendations?.[column]?.strategy_code;
    const nextStrategy = recommendation || '3';
    setSelectedMissingCol(column);
    setMissingStrategy(nextStrategy);
    setMissingStrategyPreview(nextStrategy);
    setIsMissingPanelVisible(true);
    setMissingPreviewData(null);
    setMissingPreviewError(null);
    setIsMissingModalOpen(true);
  };

  const handleApplyMissingStrategy = async () => {
    if (!selectedMissingCol) return;

    setIsProcessingAction(true);
    setError(null);

    try {
      let currentFileId = fileId;
      
      if (!currentFileId && file) {
        const uploadResponse = await apiFetch('/api/upload', {
          method: 'POST',
          body: (() => { const fd = new FormData(); fd.append('file', file); return fd; })(),
        });

        if (!uploadResponse.ok) throw new Error('Upload failed');
        const uploadResult = await uploadResponse.json() as UploadResponse;
        currentFileId = uploadResult.file_id;
        setFileId(currentFileId);
      }
      
      if (!currentFileId) throw new Error('No file available for processing');

      const actionRes = await apiFetch('/api/dq/handle-missing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: currentFileId,
          column: selectedMissingCol,
          strategy: missingStrategy
        })
      });

      if (!actionRes.ok) {
        const errorData = await actionRes.json() as { detail?: string };
        throw new Error(errorData.detail || 'Failed to handle missing values');
      }

      setIsMissingModalOpen(false);
      await handleScan(true);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handlePreviewMissing = async () => {
    if (!selectedMissingCol) return;
    setIsMissingPreviewLoading(true);
    setMissingPreviewError(null);

    try {
      const currentFileId = await resolveFileId();
      const response = await apiFetch('/api/dq/preview-missing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: currentFileId,
          column: selectedMissingCol,
          strategy: missingStrategy,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as { detail?: string };
        throw new Error(errorData.detail || 'Preview failed');
      }

      const previewResult = (await response.json()) as MissingPreviewResponse;
      setMissingPreviewData(previewResult);
    } catch (err) {
      setMissingPreviewError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setIsMissingPreviewLoading(false);
    }
  };

  const handleFixTimestamps = async () => {
    if (!report || report.missing_dates_count === 0) {
      return;
    }

    setIsFixingTimestamps(true);
    setError(null);

    try {
      const currentFileId = await resolveFileId();
      const response = await apiFetch('/api/dq/fix-timestamps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: currentFileId }),
      });

      if (!response.ok) {
        const errorData = await response.json() as { detail?: string };
        throw new Error(errorData.detail || 'Fix timestamps failed');
      }

      const result = await response.json() as { inserted_rows: number };
      setToastMessage(
        `Time axis restored! ${result.inserted_rows} empty rows inserted. Please select an imputation strategy to fill data gaps.`,
      );

      await handleScan(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fix timestamps failed');
    } finally {
      setIsFixingTimestamps(false);
    }
  };

  const handleDownloadDataset = async () => {
    if (!fileId) {
      return;
    }

    setError(null);

    try {
      await downloadFile(`/api/dq/download/${fileId}`, `dataset_${fileId}.csv`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed.');
    }
  };

  return (
    <div className="flex-1 h-full bg-slate-100 p-4 md:p-8 overflow-auto">
      {toastMessage && (
        <div className="fixed right-6 top-6 z-50 max-w-md rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-xl">
          {toastMessage}
        </div>
      )}
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6 md:mb-8">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">Data Quality Module</h2>
          <p className="mt-2 text-slate-600 max-w-3xl">
            Upload a dataset and run an automated scan to detect missing values, outliers, and time-series consistency issues.
          </p>
        </div>

        <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 ${report ? 'mb-6 p-5' : 'p-8 md:p-10'}`}>
          <div
            className={`w-full rounded-xl border-2 border-dashed p-8 md:p-12 text-center transition-colors ${isDragging ? 'border-sky-500 bg-sky-50' : 'border-slate-300 hover:border-sky-400 bg-white'}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleBrowseClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleBrowseClick();
              }
            }}
          >
            <svg className="mx-auto mb-4 h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>

            <p className="text-lg font-semibold text-slate-800">
              {file ? file.name : 'Click or drag a CSV file here'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {file ? `${(file.size / 1024).toFixed(1)} KB selected` : 'Only .csv files are accepted'}
            </p>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".csv"
              onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => handleScan(false)}
              disabled={!file || isLoading}
              className={`inline-flex items-center rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors ${!file || isLoading ? 'bg-slate-300 text-slate-600 cursor-not-allowed' : 'bg-sky-600 text-white hover:bg-sky-700'}`}
            >
              {isLoading ? (
                <>
                  <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" className="opacity-90" />
                  </svg>
                  Scanning...
                </>
              ) : (
                'Upload & Scan'
              )}
            </button>

            {fileId && report && (
              <button
                type="button"
                onClick={handleDownloadDataset}
                className="inline-flex items-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
                title="Download the updated dataset"
              >
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                </svg>
                Download Updated Dataset
              </button>
            )}

            {file && (
              <span className="text-sm text-slate-500">
                Ready to scan {file.name}
              </span>
            )}
          </div>

          {error && (
            <p className="mt-4 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}
        </section>

        {report && !hasDatetimeAxis && (
          <WarningBanner message="Time column not detected. The report is running in General Data mode." />
        )}

        {report && (
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(340px,1.05fr)_minmax(0,1.95fr)]">
            <article className="min-w-[340px] rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900">Data Quality Report</h3>
              <p className="mt-1 text-sm text-slate-500">Core metrics extracted from your latest scan.</p>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Rows</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{report.rows}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Frequency</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{report.display_frequency ?? report.frequency}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Date Gaps</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{report.missing_dates_count}</p>
                  <button
                    type="button"
                    onClick={handleFixTimestamps}
                    disabled={isFixingTimestamps || report.missing_dates_count === 0}
                    className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isFixingTimestamps ? 'Inserting...' : 'Insert Dates'}
                  </button>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Detected Outlier Columns</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{Object.keys(report.outliers ?? {}).length}</p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-700">Missing Values</h4>
                  {Object.keys(report.missing_values ?? {}).length > 0 ? (
                    <ul className="mt-2 space-y-2">
                      {Object.entries(report.missing_values).map(([column, count]) => (
                        <li 
                          key={column} 
                          onClick={() => count > 0 && handleMissingClick(column)}
                          className={`group flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm ${count > 0 ? 'cursor-pointer hover:bg-slate-50 hover:border-amber-200 transition-all' : ''}`}
                          title={count > 0 ? "Click to handle missing values" : "No missing values"}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-700">{column}</span>
                            {report.missing_value_strategy_recommendations?.[column] && (
                              <span className="text-xs text-slate-500">
                                Recommended: {report.missing_value_strategy_recommendations[column].strategy}
                              </span>
                            )}
                          </div>
                          {count > 0 ? (
                            <div className="flex items-center gap-2">
                              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                                {count}
                              </span>
                              <svg className="h-4 w-4 text-slate-400 group-hover:text-amber-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                              </svg>
                            </div>
                          ) : (
                            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                              0
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      No missing values detected.
                    </p>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-slate-700">Outliers</h4>
                  {Object.keys(report.outliers ?? {}).length > 0 ? (
                    <ul className="mt-2 space-y-2">
                      {Object.entries(report.outliers).map(([column, count]) => (
                        <li 
                          key={column} 
                          onClick={() => handleOutlierClick(column)}
                          className={`group flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 transition-all ${
                            hasDatetimeAxis ? 'hover:border-sky-200' : 'hover:border-amber-200'
                          }`}
                          title="Click to handle outliers"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-700">{column}</span>
                            {report.outlier_strategy_recommendations?.[column] && (
                              <span className="text-xs text-slate-500">
                                Recommended: {report.outlier_strategy_recommendations[column].strategy}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">{count}</span>
                            <svg className={`h-4 w-4 text-slate-400 transition-colors ${hasDatetimeAxis ? 'group-hover:text-sky-500' : 'group-hover:text-amber-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      No extreme outliers detected.
                    </p>
                  )}
                </div>
              </div>
            </article>

            <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm flex flex-col">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Dataset Preview</h3>
                  <p className="mt-1 text-sm text-slate-500">First rows from the uploaded dataset.</p>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4h10l6 6v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14 4v6h6" />
                  </svg>
                  <span>{originalFilename || file?.name || fileId || 'Dataset'}</span>
                </div>
              </div>

              <div className="w-full max-w-full overflow-x-auto overflow-y-auto flex-1 min-h-0 rounded-xl border border-slate-200 scs-scrollbar">
                <table className="min-w-full w-max border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm text-slate-700">
                    <tr>
                      {previewColumns.map((column) => (
                        <th key={column} className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-left font-semibold">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.dataset_preview?.map((row, rowIndex) => (
                      <tr key={`row-${rowIndex}`} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        {previewColumns.map((column) => (
                          <td key={`${rowIndex}-${column}`} className="whitespace-nowrap font-mono text-sm border-b border-slate-100 px-4 py-3 text-slate-700">
                            {formatCellValue(row[column])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        )}

        {isOutlierModalOpen && selectedOutlierCol && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-7xl grid gap-4 lg:grid-cols-[1.1fr_0.95fr_0.9fr]">
              <div className="rounded-2xl bg-white p-7 shadow-2xl">
                <h3 className="text-lg font-semibold text-slate-900">Preview</h3>
                <p className="mt-1 text-xs text-slate-500">Compare before vs after for this strategy.</p>

                <div className="relative mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  {previewData ? (
                    renderPreviewChart(previewData)
                  ) : (
                    <div className="space-y-3 blur-sm">
                      <div className="h-3 w-3/4 rounded-full bg-slate-200" />
                      <div className="h-3 w-5/6 rounded-full bg-slate-200" />
                      <div className="h-28 rounded-lg bg-slate-100" />
                      <div className="h-3 w-2/3 rounded-full bg-slate-200" />
                    </div>
                  )}

                  {!previewData && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-sm">
                      <button
                        type="button"
                        onClick={handlePreviewOutliers}
                        disabled={isPreviewLoading}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isPreviewLoading ? 'Generating preview...' : 'Preview data for this strategy'}
                      </button>
                    </div>
                  )}
                </div>

                {previewError && (
                  <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {previewError}
                  </p>
                )}

              </div>

              <div className="rounded-2xl bg-white p-7 shadow-2xl">
                <h2 className="text-xl font-bold text-slate-800">Handle Outliers</h2>
                <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                  Column: <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs">{selectedOutlierCol}</span>
                </p>
                {report?.outlier_strategy_recommendations?.[selectedOutlierCol] && (
                  <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">Recommended:</span>{' '}
                    {report.outlier_strategy_recommendations[selectedOutlierCol].strategy} —{' '}
                    {report.outlier_strategy_recommendations[selectedOutlierCol].reasoning}
                  </p>
                )}

                <div className="mt-5">
                  <label htmlFor="outlier-strategy" className="mb-2 block text-sm font-medium text-slate-700">
                    Select Strategy
                  </label>
                  <select
                    id="outlier-strategy"
                    value={outlierStrategy}
                    onChange={(e) => {
                      const nextValue = e.target.value as OutlierStrategyKey;
                      setOutlierStrategy(nextValue);
                      setStrategyPreview(nextValue);
                      setIsStrategyPanelVisible(true);
                      setPreviewData(null);
                      setPreviewError(null);
                    }}
                    onFocus={() => setIsStrategyPanelVisible(true)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="clip_iqr">Clip to IQR Bounds</option>
                    <option value="mean">Replace with Mean</option>
                    <option value="median">Replace with Median</option>
                    <option value="drop">Drop Rows</option>
                  </select>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsOutlierModalOpen(false)}
                    disabled={isProcessingAction}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyOutlierStrategy}
                    disabled={isProcessingAction}
                    className="inline-flex items-center rounded-lg bg-sky-600 px-5 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:bg-sky-400"
                  >
                    {isProcessingAction ? (
                      <>
                        <svg className="mr-2 h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Applying...
                      </>
                    ) : (
                      'Apply & Rescan'
                    )}
                  </button>
                </div>
              </div>

              <aside
                className={`rounded-2xl border border-slate-800/60 bg-slate-900 px-7 py-6 text-xs text-slate-100 shadow-2xl transition-all duration-200 ${
                  isStrategyPanelVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
                }`}
              >
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Strategy Guide</p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {STRATEGY_DESCRIPTIONS[strategyPreview].title}
                </p>
                <p className="mt-2 text-[12px] text-slate-200">
                  {STRATEGY_DESCRIPTIONS[strategyPreview].math}
                </p>
                <p className="mt-4 text-[12px] text-slate-300">
                  {STRATEGY_DESCRIPTIONS[strategyPreview].when}
                </p>
              </aside>
            </div>
          </div>
        )}

        {isMissingModalOpen && selectedMissingCol && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-7xl grid gap-4 lg:grid-cols-[1.1fr_0.95fr_0.9fr]">
              <div className="rounded-2xl bg-white p-7 shadow-2xl">
                <h3 className="text-lg font-semibold text-slate-900">Preview</h3>
                <p className="mt-1 text-xs text-slate-500">Compare before vs after for this strategy.</p>

                <div className="relative mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  {missingPreviewData ? (
                    renderPreviewChart(missingPreviewData, false)
                  ) : (
                    <div className="space-y-3 blur-sm">
                      <div className="h-3 w-3/4 rounded-full bg-slate-200" />
                      <div className="h-3 w-5/6 rounded-full bg-slate-200" />
                      <div className="h-28 rounded-lg bg-slate-100" />
                      <div className="h-3 w-2/3 rounded-full bg-slate-200" />
                    </div>
                  )}

                  {!missingPreviewData && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-sm">
                      <button
                        type="button"
                        onClick={handlePreviewMissing}
                        disabled={isMissingPreviewLoading}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isMissingPreviewLoading ? 'Generating preview...' : 'Preview data for this strategy'}
                      </button>
                    </div>
                  )}
                </div>

                {missingPreviewError && (
                  <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {missingPreviewError}
                  </p>
                )}
              </div>

              <div className="rounded-2xl bg-white p-7 shadow-2xl">
                <h2 className="text-xl font-bold text-slate-800">Handle Missing Values</h2>
                <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                  Column: <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs">{selectedMissingCol}</span>
                </p>
                {report?.missing_value_strategy_recommendations?.[selectedMissingCol] && (
                  <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">Recommended:</span>{' '}
                    {report.missing_value_strategy_recommendations[selectedMissingCol].strategy} —{' '}
                    {report.missing_value_strategy_recommendations[selectedMissingCol].reasoning}
                  </p>
                )}

                <div className="mt-5">
                  <label htmlFor="missing-strategy" className="mb-2 block text-sm font-medium text-slate-700">
                    Select Strategy
                  </label>
                  <select
                    id="missing-strategy"
                    value={missingStrategy}
                    onChange={(e) => {
                      const nextValue = e.target.value as MissingStrategyKey;
                      setMissingStrategy(nextValue);
                      setMissingStrategyPreview(nextValue);
                      setIsMissingPanelVisible(true);
                      setMissingPreviewData(null);
                      setMissingPreviewError(null);
                    }}
                    onFocus={() => setIsMissingPanelVisible(true)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="1">Linear Interpolation</option>
                    <option value="2">Spline Interpolation</option>
                    <option value="3">Forward Fill</option>
                    <option value="5">Seasonal Mean Fill</option>
                    <option value="6">KNN Imputer (Auto)</option>
                    <option value="7">Do Nothing</option>
                  </select>
                  {!hasDatetimeAxis && ['1', '2', '3'].includes(missingStrategy) && (
                    <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
                      <svg className="mt-0.5 h-3.5 w-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 18a6 6 0 100-12 6 6 0 000 12z" />
                      </svg>
                      <span>Ця стратегія базується на припущенні про часову залежність, яка не виявлена у вашому файлі.</span>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsMissingModalOpen(false)}
                    disabled={isProcessingAction}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyMissingStrategy}
                    disabled={isProcessingAction}
                    className="inline-flex items-center rounded-lg bg-amber-600 px-5 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:bg-amber-400"
                  >
                    {isProcessingAction ? (
                      <>
                        <svg className="mr-2 h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Applying...
                      </>
                    ) : (
                      'Apply & Rescan'
                    )}
                  </button>
                </div>
              </div>

              <aside
                className={`rounded-2xl border border-amber-800/50 bg-amber-950 px-7 py-6 text-xs text-amber-100 shadow-2xl transition-all duration-200 ${
                  isMissingPanelVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
                }`}
              >
                <p className="text-[11px] uppercase tracking-[0.2em] text-amber-300">Strategy Guide</p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {MISSING_VALUES_DESCRIPTIONS[missingStrategyPreview].title}
                </p>
                <p className="mt-2 text-[12px] text-amber-100">
                  {MISSING_VALUES_DESCRIPTIONS[missingStrategyPreview].what}
                </p>
                <p className="mt-4 text-[12px] text-amber-200">
                  {MISSING_VALUES_DESCRIPTIONS[missingStrategyPreview].when}
                </p>
              </aside>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
