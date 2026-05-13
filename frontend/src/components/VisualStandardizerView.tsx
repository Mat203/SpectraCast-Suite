import React, { useEffect, useRef, useState } from 'react';
import { apiFetch, downloadFile, fetchBlobUrl } from '../lib/api';
import { useHybridCompute } from '../lib/useHybridCompute';
import { useComputeMode } from '../lib/ComputeModeContext.jsx';
import { LOCAL_VS_PLOT_CODE, LOCAL_VS_STANDARDIZE_CODE } from '../lib/localComputeScripts';
import { useAppStore } from '../store/useAppStore';
import type { AppStoreState } from '../store/useAppStore';

type Tab = 'plot_generator' | 'code_standardizer' | 'style_creator';

interface GeneratePlotResponse {
  status: string;
  plot_filename: string;
}

interface RecentDataset {
  file_id: string;
  original_filename?: string | null;
  is_modified?: boolean;
}

export const VisualStandardizerView: React.FC = () => {
  const activeDataset = useAppStore((state: AppStoreState) => state.activeDataset) as AppStoreState['activeDataset'];
  const setActiveDataset = useAppStore((state: AppStoreState) => state.setActiveDataset) as AppStoreState['setActiveDataset'];
  const setDatasetColumns = useAppStore((state: AppStoreState) => state.setDatasetColumns) as AppStoreState['setDatasetColumns'];
  const visualStandardizer = useAppStore((state: AppStoreState) => state.visualStandardizer) as AppStoreState['visualStandardizer'];
  const setVisualStandardizer = useAppStore((state: AppStoreState) => state.setVisualStandardizer) as AppStoreState['setVisualStandardizer'];
  const visualStandardizerUi = useAppStore((state: AppStoreState) => state.visualStandardizerUi) as AppStoreState['visualStandardizerUi'];
  const setVisualStandardizerUi = useAppStore((state: AppStoreState) => state.setVisualStandardizerUi) as AppStoreState['setVisualStandardizerUi'];

  const { isLocalMode } = useComputeMode();
  const { execute: executeHybrid } = useHybridCompute();

  const localCsvRef = useRef<string | null>(null);

  const { file, fileId, columns } = activeDataset;
  const {
    activeTab,
    xAxis,
    yAxis,
    plotType,
    selectedStyle,
    outputFilename,
    codeStyle,
    rawCode,
  } = visualStandardizer;

  const setActiveTab = (value: Tab) => setVisualStandardizer({ activeTab: value });
  const setXAxis = (value: string) => setVisualStandardizer({ xAxis: value });
  const setYAxis = (value: string) => setVisualStandardizer({ yAxis: value });
  const setPlotType = (value: string) => setVisualStandardizer({ plotType: value });
  const setSelectedStyle = (value: string) => setVisualStandardizer({ selectedStyle: value });
  const setOutputFilename = (value: string) => setVisualStandardizer({ outputFilename: value });
  const setCodeStyle = (value: string) => setVisualStandardizer({ codeStyle: value });
  const setRawCode = (value: string) => setVisualStandardizer({ rawCode: value });

  const {
    isDragging,
    isLoading,
    error,
    styles,
    plotResult: plotResultState,
    recentDatasets: recentDatasetsState,
    isLoadingRecent,
    recentError,
    cleanedCode,
  } = visualStandardizerUi;

  const plotResult = plotResultState as GeneratePlotResponse | null;
  const recentDatasets = recentDatasetsState as RecentDataset[];

  const setIsDragging = (value: boolean) => setVisualStandardizerUi({ isDragging: value });
  const setIsLoading = (value: boolean) => setVisualStandardizerUi({ isLoading: value });
  const setError = (value: string | null) => setVisualStandardizerUi({ error: value });
  const setStyles = (value: string[]) => setVisualStandardizerUi({ styles: value });
  const setPlotResult = (value: GeneratePlotResponse | null) => setVisualStandardizerUi({ plotResult: value });
  const setRecentDatasets = (value: RecentDataset[]) => setVisualStandardizerUi({ recentDatasets: value });
  const setIsLoadingRecent = (value: boolean) => setVisualStandardizerUi({ isLoadingRecent: value });
  const setRecentError = (value: string | null) => setVisualStandardizerUi({ recentError: value });
  const setCleanedCode = (value: string) => setVisualStandardizerUi({ cleanedCode: value });

  const [plotPreviewUrl, setPlotPreviewUrl] = useState<string | null>(null);
  const [localPlotBase64, setLocalPlotBase64] = useState<string | null>(null);
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

  const resolvePlotFilename = () => {
    const trimmed = outputFilename.trim();
    if (!trimmed) {
      return 'plot.png';
    }
    return trimmed.toLowerCase().endsWith('.png') ? trimmed : `${trimmed}.png`;
  };

  const downloadBase64Image = (base64: string, filename: string) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${base64}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  useEffect(() => {
    const fetchStyles = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await apiFetch('/api/vs/styles');
        if (!res.ok) {
          throw new Error('Failed to fetch styles');
        }
        const data = await res.json();
        setStyles(data.styles || []);
        if (data.styles && data.styles.length > 0) {
          const current = useAppStore.getState().visualStandardizer;
          if (!current.selectedStyle) {
            setVisualStandardizer({ selectedStyle: data.styles[0] });
          }
          if (!current.codeStyle) {
            setVisualStandardizer({ codeStyle: data.styles[0] });
          }
        }
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Error fetching styles');
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchStyles();
  }, [setVisualStandardizer]);

  useEffect(() => {
    if (!columns.length) {
      return;
    }

    const shouldResetXAxis = !xAxis || !columns.includes(xAxis);
    const shouldResetYAxis = !yAxis || !columns.includes(yAxis);

    if (shouldResetXAxis || shouldResetYAxis) {
      const nextXAxis = columns[0] ?? '';
      const nextYAxis = columns[1] ?? columns[0] ?? '';
      setVisualStandardizer({ xAxis: nextXAxis, yAxis: nextYAxis });
    }
  }, [columns, xAxis, yAxis, setVisualStandardizer]);

  useEffect(() => {
    let isActive = true;

    const fetchRecentDatasets = async () => {
      setIsLoadingRecent(true);
      setRecentError(null);

      try {
        const response = await apiFetch('/api/users/me');
        if (!response.ok) {
          throw new Error('Failed to load recent datasets');
        }

        const data = (await response.json()) as { datasets?: RecentDataset[] };
        const recent = (data.datasets || []).slice(0, 10);

        if (isActive) {
          setRecentDatasets(recent);
        }
      } catch (err) {
        if (isActive) {
          setRecentError(err instanceof Error ? err.message : 'Failed to load recent datasets');
        }
      } finally {
        if (isActive) {
          setIsLoadingRecent(false);
        }
      }
    };

    fetchRecentDatasets();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!plotResult?.plot_filename) {
      setPlotPreviewUrl(null);
      return;
    }

    if (localPlotBase64) {
      setPlotPreviewUrl(`data:image/png;base64,${localPlotBase64}`);
      return;
    }

    if (isLocalMode) {
      setPlotPreviewUrl(null);
      return;
    }

    let isActive = true;

    const loadPreview = async () => {
      try {
        const blobUrl = await fetchBlobUrl(`/api/vs/plot/${plotResult.plot_filename}`);
        if (!isActive) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        setPlotPreviewUrl(blobUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load plot preview');
      }
    };

    loadPreview();

    return () => {
      isActive = false;
    };
  }, [plotResult, isLocalMode, localPlotBase64]);

  useEffect(() => {
    return () => {
      if (plotPreviewUrl && plotPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(plotPreviewUrl);
      }
    };
  }, [plotPreviewUrl]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

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
      if (parsedHeaders.length >= 2) {
        setXAxis(parsedHeaders[0]);
        setYAxis(parsedHeaders[1]);
      } else if (parsedHeaders.length === 1) {
        setXAxis(parsedHeaders[0]);
        setYAxis(parsedHeaders[0]);
      } else {
        setXAxis('');
        setYAxis('');
      }
    };

    reader.onerror = () => {
      setError('Could not read CSV headers. Try another file.');
      setDatasetColumns([]);
      setXAxis('');
      setYAxis('');
    };

    reader.readAsText(nextFile.slice(0, 1024));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.csv')) {
        setActiveDataset({
          file: droppedFile,
          fileId: null,
          originalFilename: droppedFile.name,
          columns: [],
        });
        parseColumnsFromFile(droppedFile);
        localCsvRef.current = null;
        setLocalPlotBase64(null);
        setPlotPreviewUrl(null);
        setPlotResult(null);
      } else {
        alert('Please upload a .csv file');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setActiveDataset({
        file: selectedFile,
        fileId: null,
        originalFilename: selectedFile.name,
        columns: [],
      });
      parseColumnsFromFile(selectedFile);
      localCsvRef.current = null;
      setLocalPlotBase64(null);
      setPlotPreviewUrl(null);
      setPlotResult(null);
    }
  };


  const handleSelectRecentDataset = async (dataset: RecentDataset) => {
    setError(null);
    setPlotResult(null);
    setLocalPlotBase64(null);
    setPlotPreviewUrl(null);
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

      setActiveTab('plot_generator');
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

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleGeneratePlot = async () => {
    if (!file || !xAxis || !yAxis || !selectedStyle || !outputFilename) {
      setError("Please fill all fields for plot generation");
      return;
    }

    setIsLoading(true);
    setError(null);
    setPlotResult(null);
    setLocalPlotBase64(null);

    try {
      if (isLocalMode) {
        const csvData = await ensureLocalCsv();
        const chartType = plotType === 'bar' || plotType === 'hist'
          ? '2'
          : plotType === 'scatter'
            ? '3'
            : '1';

        const localResult = await executeHybrid(
          null,
          {
            csvData,
            x_col: xAxis,
            y_cols: [yAxis],
            chart_type: chartType,
          },
          { code: LOCAL_VS_PLOT_CODE, packages: ['matplotlib'] },
        );

        const imageBase64 = localResult?.image_base64 as string | undefined;
        if (!imageBase64) {
          throw new Error('Local plot generation failed');
        }

        setLocalPlotBase64(imageBase64);
        setPlotPreviewUrl(`data:image/png;base64,${imageBase64}`);
        setPlotResult({ status: 'success', plot_filename: resolvePlotFilename() });
        return;
      }

      let fileIdToUse = fileId;

      if (!fileIdToUse) {
        const formData = new FormData();
        formData.append('file', file);

        const uploadRes = await apiFetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) throw new Error('File upload failed');
        const uploadData = await uploadRes.json();
        fileIdToUse = uploadData.file_id;
        setActiveDataset({
          fileId: fileIdToUse,
          originalFilename: file?.name || null,
        });
      }

      const generateRes = await apiFetch('/api/vs/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_id: fileIdToUse,
          style_name: selectedStyle,
          x: xAxis,
          y: yAxis,
          plot_type: plotType,
          output_filename: outputFilename
        }),
      });

      if (!generateRes.ok) throw new Error('Plot generation failed');
      const generateData = await generateRes.json();
      setPlotPreviewUrl(null);
      setPlotResult(generateData);

    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStandardizeCode = async () => {
    if (!rawCode || !codeStyle) {
      setError("Please provide code and select a style");
      return;
    }

    setIsLoading(true);
    setError(null);
    setCleanedCode('');

    try {
      if (isLocalMode) {
        const localResult = await executeHybrid(
          null,
          { raw_code: rawCode, style_name: codeStyle },
          { code: LOCAL_VS_STANDARDIZE_CODE },
        );
        if (localResult?.status === 'error' && localResult?.message) {
          setError(localResult.message as string);
        }
        setCleanedCode((localResult?.cleaned_code as string) || '');
        return;
      }

      const res = await apiFetch('/api/vs/standardize-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw_code: rawCode,
          style_name: codeStyle
        }),
      });

      if (!res.ok) throw new Error('Code standardization failed');
      const data = await res.json();
      setCleanedCode(data.cleaned_code);
    } catch (err) {
       if (err instanceof Error) {
         setError(err.message);
       } else {
         setError("An error occurred");
       }
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(cleanedCode).then(() => {
      alert("Code copied to clipboard!");
    }).catch(err => {
      console.error("Could not copy text: ", err);
    });
  };

  const handleDownloadPlot = async () => {
    if (!plotResult?.plot_filename) {
      return;
    }

    setError(null);

    try {
      if (localPlotBase64) {
        downloadBase64Image(localPlotBase64, resolvePlotFilename());
        return;
      }
      await downloadFile(`/api/vs/download/${plotResult.plot_filename}`, plotResult.plot_filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed.');
    }
  };

  return (
    <div className="flex-1 bg-slate-50 overflow-y-auto">
      <header className="bg-white border-b border-slate-200 px-8 py-6">
        <h2 className="text-2xl font-bold text-slate-800">Visual Standardizer</h2>
        <p className="text-slate-500 mt-1">Generate standardized plots or clean matplotlib code</p>
      </header>

      <div className="px-8 py-6 max-w-6xl mx-auto">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 mb-6">
          <button
            className={`py-3 px-6 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'plot_generator'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
            onClick={() => setActiveTab('plot_generator')}
          >
            Plot Generator
          </button>
          <button
            className={`py-3 px-6 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'code_standardizer'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
            onClick={() => setActiveTab('code_standardizer')}
          >
            Code Standardizer
          </button>
          <button
            className={`py-3 px-6 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'style_creator'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
            onClick={() => setActiveTab('style_creator')}
          >
            Style Creator
          </button>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          {activeTab === 'plot_generator' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
                <div>
                  <div
                    className={`w-full border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                      isDragging
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-slate-100'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={triggerFileInput}
                  >
                    <svg className="w-12 h-12 mx-auto text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <h3 className="text-lg font-medium text-slate-700 mb-1">
                      {file ? file.name : 'Click or drag file to this area to upload'}
                    </h3>
                    <p className="text-sm text-slate-500">Strictly .csv files only</p>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept=".csv"
                      onChange={handleFileChange}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">X-Axis</label>
                      <select
                        className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        value={xAxis}
                        onChange={(e) => setXAxis(e.target.value)}
                      >
                        <option value="">Select column...</option>
                        {columns.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Y-Axis</label>
                      <select
                        className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        value={yAxis}
                        onChange={(e) => setYAxis(e.target.value)}
                      >
                        <option value="">Select column...</option>
                        {columns.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Plot Type</label>
                      <select
                        className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        value={plotType}
                        onChange={(e) => setPlotType(e.target.value)}
                      >
                        <option value="line">Line</option>
                        <option value="scatter">Scatter</option>
                        <option value="bar">Bar</option>
                        <option value="hist">Histogram</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Style</label>
                      <select
                        className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        value={selectedStyle}
                        onChange={(e) => setSelectedStyle(e.target.value)}
                      >
                        {styles.map((style) => (
                          <option key={style} value={style}>{style}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-2">Output Filename</label>
                      <input
                        type="text"
                        className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        value={outputFilename}
                        onChange={(e) => setOutputFilename(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-slate-100 mt-6">
                    <button
                      onClick={handleGeneratePlot}
                      disabled={isLoading}
                      className="bg-indigo-600 text-white px-6 py-2 rounded-md font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {isLoading ? 'Generating...' : 'Generate Plot'}
                    </button>
                  </div>
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
                    <div className="mt-4 flex-1 max-h-112 space-y-2 overflow-y-auto pr-1">
                      {recentDatasets.map((dataset) => (
                        <button
                          key={dataset.file_id}
                          type="button"
                          onClick={() => handleSelectRecentDataset(dataset)}
                          disabled={isLoading}
                          className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-left transition-all hover:border-indigo-300 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 items-center gap-2">
                                <svg className="h-4 w-4 flex-shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4h10l6 6v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14 4v6h6" />
                                </svg>
                                <p className="truncate text-sm font-medium text-slate-800">
                                  {dataset.original_filename || dataset.file_id}
                                </p>
                              </div>
                            </div>

                            {dataset.is_modified && (
                              <span className="flex-shrink-0 whitespace-nowrap rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
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

              {plotResult && (
                 <div className="mt-6 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex justify-between items-center">
                      <h4 className="text-slate-800 font-medium">Generated Plot Preview</h4>
                      <button
                        type="button"
                        onClick={handleDownloadPlot}
                        className="text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download Image
                      </button>
                    </div>
                    <div className="p-4 bg-slate-50 flex justify-center custom-plot-preview">
                      {plotPreviewUrl ? (
                        <img
                          src={plotPreviewUrl}
                          alt="Generated Plot"
                          className="max-w-full h-auto rounded shadow-sm border border-slate-200"
                          style={{ maxHeight: '500px' }}
                        />
                      ) : (
                        <div className="flex h-64 w-full items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500">
                          Plot preview will appear here after generation.
                        </div>
                      )}
                    </div>
                 </div>
              )}

            </div>
          )}

          {activeTab === 'code_standardizer' && (
            <div className="space-y-6">
               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Raw Matplotlib Code</label>
                  <textarea
                    className="w-full h-64 font-mono text-sm bg-slate-50 border border-slate-300 rounded-md px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y"
                    placeholder="Paste your python/matplotlib code here..."
                    value={rawCode}
                    onChange={(e) => setRawCode(e.target.value)}
                  />
               </div>

               <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Target Style</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      value={codeStyle}
                      onChange={(e) => setCodeStyle(e.target.value)}
                    >
                      {styles.map((style) => (
                        <option key={style} value={style}>{style}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleStandardizeCode}
                    disabled={isLoading}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-md font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors h-[38px]"
                  >
                    {isLoading ? 'Standardizing...' : 'Standardize Code'}
                  </button>
               </div>

               {cleanedCode && (
                  <div className="mt-6 border border-slate-200 rounded-md overflow-hidden">
                     <div className="bg-slate-100 px-4 py-2 flex justify-between items-center border-b border-slate-200">
                        <span className="text-sm font-medium text-slate-700">Standardized Code</span>
                        <button
                          onClick={copyToClipboard}
                          className="text-xs bg-white border border-slate-300 text-slate-600 px-3 py-1 rounded hover:bg-slate-50 transition-colors"
                        >
                          Copy
                        </button>
                     </div>
                     <pre className="bg-slate-50 p-4 overflow-x-auto text-sm font-mono text-slate-800">
                        <code>{cleanedCode}</code>
                     </pre>
                  </div>
               )}
            </div>
          )}

          {activeTab === 'style_creator' && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="bg-slate-100 p-4 rounded-full mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">Style Creator Coming Soon</h3>
              <p className="text-slate-500 max-w-md">
                Soon you will be able to configure custom visual themes, palettes, and typography using a fully interactive UI.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
