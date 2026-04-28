import React, { useMemo, useRef, useState } from 'react';

interface UploadResponse {
  status: string;
  file_id: string;
}

interface ScanReport {
  rows: number;
  columns: string[];
  outliers: Record<string, number>;
  missing_values: Record<string, number>;
  frequency: string;
  display_frequency: string;
  missing_dates_count: number;
  missing_dates: string[];
  dataset_preview: Array<Record<string, unknown>>;
}

export const DataQualityView: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ScanReport | null>(null);

  const [selectedOutlierCol, setSelectedOutlierCol] = useState<string | null>(null);
  const [isOutlierModalOpen, setIsOutlierModalOpen] = useState(false);
  const [outlierStrategy, setOutlierStrategy] = useState('clip_iqr');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const [fileId, setFileId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

        const uploadResponse = await fetch('http://127.0.0.1:8000/api/upload', {
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

      const scanResponse = await fetch('http://127.0.0.1:8000/api/dq/scan', {
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
    setSelectedOutlierCol(column);
    setOutlierStrategy('clip_iqr');
    setIsOutlierModalOpen(true);
  };

  const handleApplyOutlierStrategy = async () => {
    if (!selectedOutlierCol) return;

    setIsProcessingAction(true);
    setError(null);

    try {
      let currentFileId = fileId;
      
      if (!currentFileId && file) {
        const uploadResponse = await fetch('http://127.0.0.1:8000/api/upload', {
          method: 'POST',
          body: (() => { const fd = new FormData(); fd.append('file', file); return fd; })(),
        });

        if (!uploadResponse.ok) throw new Error('Upload failed');
        const uploadResult = await uploadResponse.json() as UploadResponse;
        currentFileId = uploadResult.file_id;
        setFileId(currentFileId);
      }
      
      if (!currentFileId) throw new Error('No file available for processing');

      const actionRes = await fetch('http://127.0.0.1:8000/api/dq/handle-outliers', {
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
      await handleScan(true); // Rescan existing file_id, don't re-upload local file

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsProcessingAction(false);
    }
  };

  return (
    <div className="flex-1 h-full bg-slate-100 p-4 md:p-8 overflow-auto">
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
              <a
                href={`http://127.0.0.1:8000/api/dq/download/${fileId}`}
                download={`dataset_${fileId}.csv`}
                className="inline-flex items-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
                title="Download the updated dataset"
              >
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                </svg>
                Download Updated Dataset
              </a>
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

        {report && (
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1.6fr]">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
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
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Detected Outlier Columns</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{Object.keys(report.outliers ?? {}).length}</p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-700">Missing Values</h4>
                  <ul className="mt-2 space-y-2">
                    {Object.entries(report.missing_values ?? {}).map(([column, count]) => (
                      <li key={column} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <span className="font-medium text-slate-700">{column}</span>
                        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${count > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                          {count}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-slate-700">Outliers</h4>
                  {Object.keys(report.outliers ?? {}).length > 0 ? (
                    <ul className="mt-2 space-y-2">
                      {Object.entries(report.outliers).map(([column, count]) => (
                        <li 
                          key={column} 
                          onClick={() => handleOutlierClick(column)}
                          className="group flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 hover:border-sky-200 transition-all"
                          title="Click to handle outliers"
                        >
                          <span className="font-medium text-slate-700">{column}</span>
                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">{count}</span>
                            <svg className="h-4 w-4 text-slate-400 group-hover:text-sky-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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

            <article className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Dataset Preview</h3>
                  <p className="mt-1 text-sm text-slate-500">First rows from the uploaded dataset.</p>
                </div>
              </div>

              <div className="w-full overflow-x-auto overflow-y-auto max-h-[60vh] rounded-xl border border-slate-200">
                <table className="min-w-full border-collapse text-sm">
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
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <h2 className="text-xl font-bold text-slate-800">Handle Outliers</h2>
              <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                Column: <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs">{selectedOutlierCol}</span>
              </p>

              <div className="mt-5">
                <label htmlFor="outlier-strategy" className="mb-2 block text-sm font-medium text-slate-700">
                  Select Strategy
                </label>
                <select
                  id="outlier-strategy"
                  value={outlierStrategy}
                  onChange={(e) => setOutlierStrategy(e.target.value)}
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
          </div>
        )}
      </div>
    </div>
  );
};
