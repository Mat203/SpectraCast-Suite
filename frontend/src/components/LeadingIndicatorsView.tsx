import React, { useEffect, useMemo, useRef } from 'react';
import { apiFetch, downloadFile } from '../lib/api';
import { useHybridCompute } from '../lib/useHybridCompute';
import { useComputeMode } from '../lib/ComputeModeContext.jsx';
import { LOCAL_LI_RUN_CODE } from '../lib/localComputeScripts';
import { useAppStore } from '../store/useAppStore';
import type { AppStoreState } from '../store/useAppStore';
import { FileUpload } from './FileUpload';

interface UploadResponse {
  status: string;
  file_id: string;
}

interface RecentDataset {
  file_id: string;
  original_filename?: string | null;
  is_modified?: boolean;
  created_at?: string | null;
}

interface LeadingIndicatorsResponse {
  status: string;
  queries_generated: string[];
  trends_file: string;
  correlations_file: string;
  top_results: Record<string, unknown>[];
  trends_csv?: string;
  correlations_csv?: string;
  is_local?: boolean;
}

export const LeadingIndicatorsView: React.FC = () => {
  const activeDataset = useAppStore((state: AppStoreState) => state.activeDataset) as AppStoreState['activeDataset'];
  const setActiveDataset = useAppStore((state: AppStoreState) => state.setActiveDataset) as AppStoreState['setActiveDataset'];
  const setDatasetColumns = useAppStore((state: AppStoreState) => state.setDatasetColumns) as AppStoreState['setDatasetColumns'];
  const leadingIndicators = useAppStore((state: AppStoreState) => state.leadingIndicators) as AppStoreState['leadingIndicators'];
  const setLeadingIndicators = useAppStore((state: AppStoreState) => state.setLeadingIndicators) as AppStoreState['setLeadingIndicators'];
  const leadingIndicatorsUi = useAppStore((state: AppStoreState) => state.leadingIndicatorsUi) as AppStoreState['leadingIndicatorsUi'];
  const setLeadingIndicatorsUi = useAppStore((state: AppStoreState) => state.setLeadingIndicatorsUi) as AppStoreState['setLeadingIndicatorsUi'];

  const { isLocalMode, setIsLocalMode } = useComputeMode() as {
    isLocalMode: boolean;
    setIsLocalMode: (value: boolean) => void;
  };
  const { execute: executeHybrid } = useHybridCompute();
  const triggerLeadingIndicatorsStream = useAppStore((state: AppStoreState) => state.triggerLeadingIndicatorsStream);
  const isStreaming = useAppStore((state: AppStoreState) => state.leadingIndicatorsStream.isProcessing);

  const localCsvRef = useRef<string | null>(null);
  const localFileIdRef = useRef<string>('local-dataset');

  const { file, fileId, columns } = activeDataset;
  const { targetColumn, region, geoCode, extraContext } = leadingIndicators;

  const setTargetColumn = (value: string) => setLeadingIndicators({ targetColumn: value });
  const setRegion = (value: string) => setLeadingIndicators({ region: value });
  const setGeoCode = (value: string) => setLeadingIndicators({ geoCode: value });
  const setExtraContext = (value: string) => setLeadingIndicators({ extraContext: value });

  const loadRecentDatasets = useAppStore((state: AppStoreState) => state.loadRecentDatasets);

  const {
    isDragging,
    isLoading,
    error,
    result: resultState,
    recentDatasets: recentDatasetsState,
    isLoadingRecent,
    recentError,
  } = leadingIndicatorsUi;

  const result = resultState as LeadingIndicatorsResponse | null;
  const recentDatasets = recentDatasetsState as RecentDataset[];

  const setIsDragging = (value: boolean) => setLeadingIndicatorsUi({ isDragging: value });
  const setIsLoading = (value: boolean) => setLeadingIndicatorsUi({ isLoading: value });
  const setError = (value: string | null) => setLeadingIndicatorsUi({ error: value });
  const setResult = (value: LeadingIndicatorsResponse | null) => setLeadingIndicatorsUi({ result: value });
  const setRecentDatasets = (value: RecentDataset[]) => setLeadingIndicatorsUi({ recentDatasets: value });
  const setIsLoadingRecent = (value: boolean) => setLeadingIndicatorsUi({ isLoadingRecent: value });
  const setRecentError = (value: string | null) => setLeadingIndicatorsUi({ recentError: value });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const ensureLocalCsv = async () => {
    if (localCsvRef.current) {
      return localCsvRef.current;
    }
    if (!file) {
      throw new Error('Please upload a CSV file first.');
    }
    const csvData = await file.text();
    localCsvRef.current = csvData;
    return csvData;
  };

  const downloadLocalCsv = (csvData: string, filename: string) => {
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    loadRecentDatasets();
  }, [loadRecentDatasets]);

  useEffect(() => {
    if (!columns.length) {
      return;
    }

    if (!targetColumn || !columns.includes(targetColumn)) {
      setLeadingIndicators({ targetColumn: columns[0] ?? '' });
    }
  }, [columns, targetColumn, setLeadingIndicators]);

  const topResultsHeaders = useMemo(() => {
    if (!result?.top_results?.length) {
      return [];
    }
    return Object.keys(result.top_results[0]);
  }, [result]);

  const parseColumnsFromFile = (nextFile: File) => {
    const reader = new FileReader();

    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const firstLine = text.split(/\r?\n/)[0] ?? '';
      const parsedHeaders = firstLine
        .replace(/^\uFEFF/, '')
        .split(',')
        .map((header) => header.trim().replace(/^"|"$/g, ''))
        .filter(Boolean);

      setDatasetColumns(parsedHeaders);
      setTargetColumn(parsedHeaders[0] ?? '');
    };

    reader.onerror = () => {
      setError('Could not read CSV headers. Try another file.');
      setDatasetColumns([]);
      setTargetColumn('');
    };

    reader.readAsText(nextFile.slice(0, 64 * 1024));
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
    setResult(null);
    setActiveDataset({
      file: nextFile,
      fileId: null,
      originalFilename: nextFile.name,
      columns: [],
    });
    parseColumnsFromFile(nextFile);
    localCsvRef.current = null;
  };



  const handleSelectRecentDataset = async (dataset: RecentDataset) => {
    setError(null);
    setResult(null);
    localCsvRef.current = null;

    try {
      const response = await apiFetch(`/api/dq/download/${dataset.file_id}`);
      if (!response.ok) {
        throw new Error('Could not load the selected dataset');
      }

      const blob = await response.blob();
      const restoredFile = new File(
        [blob],
        dataset.original_filename || `${dataset.file_id}.csv`,
        { type: 'text/csv' },
      );

      setActiveDataset({
        file: restoredFile,
        fileId: dataset.file_id,
        originalFilename: dataset.original_filename || restoredFile.name,
        columns: [],
      });
      parseColumnsFromFile(restoredFile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the selected dataset');
    }
  };

  const extractApiError = async (response: Response, fallbackPrefix: string) => {
    try {
      const errorData = (await response.json()) as { detail?: string; message?: string };
      const detail = errorData.detail || errorData.message;
      return detail ? `${fallbackPrefix}: ${detail}` : `${fallbackPrefix} (HTTP ${response.status})`;
    } catch {
      return `${fallbackPrefix} (HTTP ${response.status})`;
    }
  };

  const getByokHeaders = (): Record<string, string> => {
    const enabled = localStorage.getItem('user_llm_byok_enabled') === 'true';
    const apiKey = localStorage.getItem('user_llm_api_key');
    if (enabled && apiKey) {
      return { 'x-llm-api-key': apiKey };
    }
    return {};
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!file) {
      setError('Please upload a CSV file first.');
      return;
    }

    if (!targetColumn) {
      setError('Target Column is required.');
      return;
    }

    if (!region.trim()) {
      setError('Region is required.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (isLocalMode) {
        const csvData = await ensureLocalCsv();
        const localResult = await executeHybrid(
          null,
          {
            csvData,
            target_col: targetColumn,
            region: region.trim(),
            geo: geoCode.trim() || 'UA',
            extra_info: extraContext.trim(),
          },
          { code: LOCAL_LI_RUN_CODE },
        );

        const nextResult: LeadingIndicatorsResponse = {
          status: localResult?.status || 'success',
          queries_generated: (localResult?.queries_generated as string[]) || [],
          trends_file: 'local_trends.csv',
          correlations_file: 'local_correlations.csv',
          top_results: (localResult?.top_results as Record<string, unknown>[]) || [],
          trends_csv: localResult?.trends_csv as string | undefined,
          correlations_csv: localResult?.correlations_csv as string | undefined,
          is_local: true,
        };

        setActiveDataset({
          fileId: localFileIdRef.current,
          originalFilename: file?.name || null,
        });
        setResult(nextResult);
        return;
      }

      let fileIdToUse = fileId;

      if (!fileIdToUse) {
        const formData = new FormData();
        formData.append('file', file);

        const uploadResponse = await apiFetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error(await extractApiError(uploadResponse, 'Upload failed'));
        }

        const uploadData = (await uploadResponse.json()) as UploadResponse;

        if (!uploadData.file_id) {
          throw new Error('Upload succeeded but no file_id was returned by the server.');
        }

        fileIdToUse = uploadData.file_id;
        setActiveDataset({
          fileId: fileIdToUse,
          originalFilename: file?.name || null,
        });
      }

      triggerLeadingIndicatorsStream(
        {
          file_id: fileIdToUse,
          target_col: targetColumn,
          region: region.trim(),
          geo: geoCode.trim() || 'UA',
          extra_info: extraContext.trim(),
        },
        getByokHeaders(),
      );
      setIsLoading(false);
      return;
    } catch (submitError) {
      const message =
        submitError instanceof TypeError
          ? 'Could not reach the API. Check VITE_API_URL and confirm the backend server is reachable.'
          : submitError instanceof Error
            ? submitError.message
            : 'Request failed unexpectedly.';
      console.error('Leading Indicators error:', submitError);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunAnother = () => {
    setResult(null);
    setError(null);
  };

  const handleDownload = async (pathFromBackend: string, fallbackName: string, localCsv?: string) => {
    const shouldUseLocal = (isLocalMode || result?.is_local) && typeof localCsv === 'string';
    if (shouldUseLocal) {
      setError(null);
      try {
        downloadLocalCsv(localCsv as string, fallbackName);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Download failed.');
      }
      return;
    }

    const fileName = pathFromBackend.split('/').pop() || fallbackName;
    setError(null);

    try {
      await downloadFile(`/api/li/download/${encodeURIComponent(fileName)}`, fileName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed.');
    }
  };

  return (
    <div className="flex-1 h-full bg-slate-100 p-4 md:p-8 overflow-auto">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6 md:mb-8">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">Leading Indicators Module</h2>
          <p className="mt-2 text-slate-600 max-w-3xl">
            Upload your dataset, select a target metric, and discover external leading indicators powered by LLM query generation and Google Trends.
          </p>
          <div className="mt-4">
            <span className="group relative inline-flex">
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-amber-300 bg-amber-100 text-xs font-bold text-amber-800"
                aria-label="Leading Indicators info"
              >
                i
              </span>
              <span className="pointer-events-none absolute left-0 top-full z-10 mt-2 w-80 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
                This module depends on external services (LLM and the Google Trends API). Their availability can be unstable, especially during peak hours (evening or around noon). If the module fails to start, please try again later.
              </span>
            </span>
          </div>
        </div>

        {!result ? (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 p-8 md:p-10">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
                <div>
                  <FileUpload
                    file={file}
                    isDragging={isDragging}
                    onFileSelect={handleFileSelect}
                    setIsDragging={setIsDragging}
                    accentColor="sky"
                  />

                  <div className="mt-5 flex flex-wrap items-center gap-4">
                    <button
                      type="submit"
                      disabled={!file || !columns.length || isLoading || isStreaming}
                      className={`inline-flex items-center rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors ${!file || !columns.length || isLoading || isStreaming ? 'bg-slate-300 text-slate-600 cursor-not-allowed' : 'bg-sky-600 text-white hover:bg-sky-700'}`}
                    >
                      {isLoading || isStreaming ? (
                        <>
                          <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" className="opacity-90" />
                          </svg>
                          Generating queries and fetching trends...
                        </>
                      ) : (
                        'Run Leading Indicators Analysis'
                      )}
                    </button>

                    {file && <span className="text-sm text-slate-500">Ready with {file.name}</span>}
                  </div>

                  {error && (
                    <div className="mt-4 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      <p>{error}</p>
                      {isLocalMode && (
                        <button
                          type="button"
                          onClick={() => setIsLocalMode(false)}
                          className="mt-2 inline-flex items-center rounded-md border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                        >
                          Run via API
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-800">Recent Datasets</h3>

                  {isLoadingRecent && (
                    <div className="mt-4 space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-16 rounded-lg bg-slate-100 animate-pulse" />
                      ))}
                    </div>
                  )}

                  {!isLoadingRecent && recentError && (
                    <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{recentError}</p>
                  )}

                  {!isLoadingRecent && recentDatasets.length === 0 && !recentError && (
                    <div className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-6 text-center">
                      <svg className="mx-auto h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="mt-2 text-sm font-medium text-slate-600">No recent datasets</p>
                      <p className="mt-1 text-xs text-slate-500">Upload a file to get started</p>
                    </div>
                  )}

                  {!isLoadingRecent && recentDatasets.length > 0 && (
                    <div className="mt-4 flex-1 max-h-44 space-y-2 overflow-y-auto pr-1">
                      {recentDatasets.map((dataset) => (
                        <button
                          key={dataset.file_id}
                          type="button"
                          onClick={() => handleSelectRecentDataset(dataset)}
                          disabled={isLoading}
                          className="w-full text-left rounded-lg border border-slate-200 bg-white px-4 py-3 transition-all hover:bg-sky-50 hover:border-sky-300 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <svg className="h-4 w-4 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4h10l6 6v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14 4v6h6" />
                              </svg>
                              <p className="truncate text-sm font-medium text-slate-800">
                                {dataset.original_filename || dataset.file_id}
                              </p>
                            </div>
                            {dataset.is_modified && (
                              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700 flex-shrink-0 whitespace-nowrap">
                                Modified
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {file && (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                    <span className="inline-flex items-center gap-1">
                      Target Column <span className="text-rose-600">*</span>
                    </span>
                    <div className="relative">
                      <select
                        value={targetColumn}
                        onChange={(event) => setTargetColumn(event.target.value)}
                        required
                        className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-10 text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                      >
                        <option value="" disabled>
                          Select target column
                        </option>
                        {columns.map((column) => (
                          <option key={column} value={column}>
                            {column}
                          </option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                        </svg>
                      </span>
                    </div>
                    {columns.length === 0 && (
                      <span className="text-xs font-normal text-amber-700">Could not detect CSV headers. Please verify file format.</span>
                    )}
                  </label>

                  <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                    <span className="inline-flex items-center gap-1">
                      Region <span className="text-rose-600">*</span>
                    </span>
                    <input
                      type="text"
                      value={region}
                      onChange={(event) => setRegion(event.target.value)}
                      required
                      placeholder="Ukraine"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    />
                  </label>

                  <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 md:col-span-1">
                    Geo Code
                    <input
                      type="text"
                      value={geoCode}
                      onChange={(event) => setGeoCode(event.target.value)}
                      placeholder="UA"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    />
                  </label>

                  <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                    Extra Context
                    <textarea
                      value={extraContext}
                      onChange={(event) => setExtraContext(event.target.value)}
                      rows={4}
                      placeholder="Optional context for LLM query generation..."
                      className="resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    />
                  </label>
                </div>
              )}
            </form>
          </section>
        ) : (
          <section className="space-y-6">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Leading Indicators Results</h3>
                  <p className="mt-1 text-sm text-slate-500">Generated query candidates and strongest correlation signals.</p>
                </div>

                <button
                  type="button"
                  onClick={handleRunAnother}
                  className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Run Another Analysis
                </button>
              </div>

              <div className="mt-5 space-y-3">
                <h4 className="text-sm font-semibold text-slate-700">Queries Generated</h4>
                {result.queries_generated.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {result.queries_generated.map((query) => (
                      <span
                        key={query}
                        className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700"
                      >
                        {query}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No query suggestions returned.</p>
                )}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
              <h4 className="text-lg font-bold text-slate-900">Top Results</h4>
              <p className="mt-1 text-sm text-slate-500">Highest-ranking leading indicators from the backend analysis output.</p>

              {result.top_results.length > 0 && topResultsHeaders.length > 0 ? (
                <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full border-collapse text-sm">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        {topResultsHeaders.map((header) => (
                          <th
                            key={header}
                            className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-left font-semibold"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.top_results.map((row, rowIndex) => (
                        <tr key={`result-row-${rowIndex}`} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          {topResultsHeaders.map((header) => (
                            <td key={`${rowIndex}-${header}`} className="whitespace-nowrap border-b border-slate-100 px-4 py-3 text-slate-700">
                              {row[header] === null || row[header] === undefined ? '—' : String(row[header])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  The backend did not return any top results rows.
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleDownload(result.trends_file, 'raw_trends.csv', result.trends_csv)}
                  className="inline-flex items-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
                >
                  Download Raw Trends CSV
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(result.correlations_file, 'correlations.csv', result.correlations_csv)}
                  className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Download Correlations CSV
                </button>
              </div>

              {error && (
                <div className="mt-4 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  <p>{error}</p>
                  {isLocalMode && (
                    <button
                      type="button"
                      onClick={() => setIsLocalMode(false)}
                      className="mt-2 inline-flex items-center rounded-md border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      Run via API
                    </button>
                  )}
                </div>
              )}
            </article>
          </section>
        )}
      </div>
    </div>
  );
};