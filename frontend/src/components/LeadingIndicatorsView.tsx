import React, { useMemo, useRef, useState } from 'react';

interface UploadResponse {
  status: string;
  file_id: string;
}

interface LeadingIndicatorsResponse {
  status: string;
  queries_generated: string[];
  trends_file: string;
  correlations_file: string;
  top_results: Record<string, unknown>[];
}

export const LeadingIndicatorsView: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);

  const [targetColumn, setTargetColumn] = useState('');
  const [region, setRegion] = useState('');
  const [geoCode, setGeoCode] = useState('UA');
  const [extraContext, setExtraContext] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LeadingIndicatorsResponse | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

      setColumns(parsedHeaders);
      setTargetColumn(parsedHeaders[0] ?? '');
    };

    reader.onerror = () => {
      setError('Could not read CSV headers. Try another file.');
      setColumns([]);
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
    setFile(nextFile);
    parseColumnsFromFile(nextFile);
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

  const extractApiError = async (response: Response, fallbackPrefix: string) => {
    try {
      const errorData = (await response.json()) as { detail?: string; message?: string };
      const detail = errorData.detail || errorData.message;
      return detail ? `${fallbackPrefix}: ${detail}` : `${fallbackPrefix} (HTTP ${response.status})`;
    } catch {
      return `${fallbackPrefix} (HTTP ${response.status})`;
    }
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
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch('http://127.0.0.1:8000/api/upload/', {
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

      const runResponse = await fetch('http://127.0.0.1:8000/api/li/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_id: uploadData.file_id,
          target_col: targetColumn,
          region: region.trim(),
          geo: geoCode.trim() || 'UA',
          extra_info: extraContext.trim(),
        }),
      });

      if (!runResponse.ok) {
        throw new Error(await extractApiError(runResponse, 'Leading Indicators analysis failed'));
      }

      const runData = (await runResponse.json()) as LeadingIndicatorsResponse;
      setResult(runData);
    } catch (submitError) {
      const message =
        submitError instanceof TypeError
          ? 'Could not reach API at http://127.0.0.1:8000. Start the backend server and try again.'
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

  const getDownloadUrl = (pathFromBackend: string) => {
    const fileName = pathFromBackend.split('/').pop() || pathFromBackend;
    return `http://127.0.0.1:8000/api/li/download/${encodeURIComponent(fileName)}`;
  };

  return (
    <div className="flex-1 h-full bg-slate-100 p-4 md:p-8 overflow-auto">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6 md:mb-8">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">Leading Indicators Module</h2>
          <p className="mt-2 text-slate-600 max-w-3xl">
            Upload your dataset, select a target metric, and discover external leading indicators powered by LLM query generation and Google Trends.
          </p>
        </div>

        {!result ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div
                className={`w-full rounded-xl border-2 border-dashed p-8 md:p-10 text-center transition-colors ${isDragging ? 'border-sky-500 bg-sky-50' : 'border-slate-300 hover:border-sky-400 bg-white'}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleBrowseClick}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleBrowseClick();
                  }
                }}
              >
                <svg className="mx-auto mb-4 h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>

                <p className="text-lg font-semibold text-slate-800">{file ? file.name : 'Click or drag a CSV file here'}</p>
                <p className="mt-1 text-sm text-slate-500">{file ? `${(file.size / 1024).toFixed(1)} KB selected` : 'Only .csv files are accepted'}</p>

                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".csv"
                  onChange={(event) => handleFileSelect(event.target.files?.[0] ?? null)}
                />
              </div>

              {file && (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                    Target Column <span className="text-rose-600">*</span>
                    <select
                      value={targetColumn}
                      onChange={(event) => setTargetColumn(event.target.value)}
                      required
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
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
                    {columns.length === 0 && (
                      <span className="text-xs font-normal text-amber-700">Could not detect CSV headers. Please verify file format.</span>
                    )}
                  </label>

                  <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                    Region <span className="text-rose-600">*</span>
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

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="submit"
                  disabled={!file || !columns.length || isLoading}
                  className={`inline-flex items-center rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors ${!file || !columns.length || isLoading ? 'bg-slate-300 text-slate-600 cursor-not-allowed' : 'bg-sky-600 text-white hover:bg-sky-700'}`}
                >
                  {isLoading ? (
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
                <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
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
                <a
                  href={getDownloadUrl(result.trends_file)}
                  className="inline-flex items-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
                >
                  Download Raw Trends CSV
                </a>
                <a
                  href={getDownloadUrl(result.correlations_file)}
                  className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Download Correlations CSV
                </a>
              </div>

              {error && (
                <p className="mt-4 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
              )}
            </article>
          </section>
        )}
      </div>
    </div>
  );
};