import React, { useEffect, useRef, useState } from 'react';
import { ChartActionButtons } from './ChartActionButtons.tsx';
import { apiFetch, downloadFile, fetchBlobUrl } from '../lib/api';
import { useHybridCompute } from '../lib/useHybridCompute';
import { useComputeMode } from '../lib/ComputeModeContext.jsx';
import { LOCAL_VS_PLOT_CODE, LOCAL_VS_STANDARDIZE_CODE } from '../lib/localComputeScripts';
import { useAppStore } from '../store/useAppStore';
import type { AppStoreState } from '../store/useAppStore';

type Tab = 'plot_generator' | 'code_standardizer' | 'style_creator';

type YAxisAssignment = {
  column: string;
  axis: 'primary' | 'secondary';
};

interface GeneratePlotResponse {
  status: string;
  plot_filename: string;
  source_code?: string;
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
  const visualStandardizerSession = useAppStore((state: AppStoreState) => state.visualStandardizerSession) as AppStoreState['visualStandardizerSession'];
  const setVisualStandardizerSession = useAppStore((state: AppStoreState) => state.setVisualStandardizerSession) as AppStoreState['setVisualStandardizerSession'];

  const { isLocalMode, setIsLocalMode } = useComputeMode() as {
    isLocalMode: boolean;
    setIsLocalMode: (value: boolean) => void;
  };
  const { execute: executeHybrid } = useHybridCompute();

  const localCsvRef = useRef<string | null>(null);

  const { file, fileId, columns } = activeDataset;
  const {
    activeTab,
    xAxis,
    yAxes,
    plotType,
    selectedStyle,
    outputFilename,
    codeStyle,
    rawCode,
    title,
    xLabel,
    yLabel,
    y2Label,
  } = visualStandardizer;

  const normalizeYAxes = (value: unknown): YAxisAssignment[] => {
    if (!Array.isArray(value)) {
      return [];
    }

    const mapped = value
      .map((item) => {
        if (typeof item === 'string') {
          return { column: item, axis: 'primary' as const };
        }
        if (item && typeof item === 'object') {
          const column = (item as { column?: unknown }).column;
          if (typeof column !== 'string' || !column) {
            return null;
          }
          const axisValue = (item as { axis?: unknown }).axis;
          const axis = axisValue === 'secondary' ? 'secondary' : 'primary';
          return { column, axis } as YAxisAssignment;
        }
        return null;
      })
      .filter((item): item is YAxisAssignment => Boolean(item));

    const seen = new Set<string>();
    return mapped.filter((item) => {
      if (seen.has(item.column)) {
        return false;
      }
      seen.add(item.column);
      return true;
    });
  };

  const resolvedYAxes = normalizeYAxes(yAxes);

  const setActiveTab = (value: Tab) => setVisualStandardizer({ activeTab: value });
  const setXAxis = (value: string) => setVisualStandardizer({ xAxis: value });
  const setYAxes = (value: YAxisAssignment[]) => setVisualStandardizer({ yAxes: value });
  const setPlotType = (value: string) => setVisualStandardizer({ plotType: value });
  const setSelectedStyle = (value: string) => setVisualStandardizer({ selectedStyle: value });
  const setCodeStyle = (value: string) => setVisualStandardizer({ codeStyle: value });
  const setRawCode = (value: string) => setVisualStandardizer({ rawCode: value });
  const setTitle = (value: string) => setVisualStandardizer({ title: value });
  const setXLabel = (value: string) => setVisualStandardizer({ xLabel: value });
  const setYLabel = (value: string) => setVisualStandardizer({ yLabel: value });
  const setY2Label = (value: string) => setVisualStandardizer({ y2Label: value });

  const toggleYAxis = (value: string) => {
    if (!value) {
      return;
    }

    const existing = resolvedYAxes.find((axis) => axis.column === value);
    if (existing) {
      setYAxes(resolvedYAxes.filter((axis) => axis.column !== value));
      return;
    }

    setYAxes([...resolvedYAxes, { column: value, axis: 'primary' }]);
  };

  const setAxisForColumn = (column: string, axis: 'primary' | 'secondary') => {
    if (!column) {
      return;
    }

    const existing = resolvedYAxes.find((item) => item.column === column);
    if (!existing) {
      setYAxes([...resolvedYAxes, { column, axis }]);
      return;
    }

    setYAxes(
      resolvedYAxes.map((item) =>
        item.column === column ? { ...item, axis } : item,
      ),
    );
  };

  const getAxisForColumn = (column: string) =>
    resolvedYAxes.find((item) => item.column === column)?.axis;

  const areYAxesEqual = (left: YAxisAssignment[], right: YAxisAssignment[]) =>
    left.length === right.length &&
    left.every((item, index) =>
      item.column === right[index]?.column && item.axis === right[index]?.axis,
    );

  useEffect(() => {
    if (!Array.isArray(yAxes)) {
      setYAxes([]);
      return;
    }

    if (!areYAxesEqual(resolvedYAxes, yAxes as YAxisAssignment[])) {
      setYAxes(resolvedYAxes);
    }
  }, [yAxes, resolvedYAxes, setYAxes]);

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
    chartCode,
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
  const setChartCode = (value: string) => setVisualStandardizerUi({ chartCode: value });

  const [plotPreviewUrl, setPlotPreviewUrl] = useState<string | null>(null);
  const [localPlotBase64, setLocalPlotBase64] = useState<string | null>(null);
  const [isPlotFullScreen, setIsPlotFullScreen] = useState(false);

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
    const normalizedYAxes = resolvedYAxes.filter((axis) => columns.includes(axis.column));
    const shouldResetYAxis = normalizedYAxes.length === 0;

    if (shouldResetXAxis || shouldResetYAxis || normalizedYAxes.length !== resolvedYAxes.length) {
      const nextXAxis = columns[0] ?? '';
      const fallbackYAxis = columns[1] ?? columns[0] ?? '';
      const updates: { xAxis?: string; yAxes?: YAxisAssignment[] } = {};

      if (shouldResetXAxis) {
        updates.xAxis = nextXAxis;
      }

      if (shouldResetYAxis) {
        updates.yAxes = fallbackYAxis ? [{ column: fallbackYAxis, axis: 'primary' }] : [];
      } else if (normalizedYAxes.length !== resolvedYAxes.length) {
        updates.yAxes = normalizedYAxes;
      }

      if (Object.keys(updates).length > 0) {
        setVisualStandardizer(updates);
      }
    }
  }, [columns, xAxis, resolvedYAxes, yAxes, setVisualStandardizer]);

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
      setVisualStandardizerSession({ columns: parsedHeaders });
      if (parsedHeaders.length >= 2) {
        setXAxis(parsedHeaders[0]);
        setYAxes([{ column: parsedHeaders[1], axis: 'primary' }]);
      } else if (parsedHeaders.length === 1) {
        setXAxis(parsedHeaders[0]);
        setYAxes([{ column: parsedHeaders[0], axis: 'primary' }]);
      } else {
        setXAxis('');
        setYAxes([]);
      }
    };

    reader.onerror = () => {
      setError('Could not read CSV headers. Try another file.');
      setDatasetColumns([]);
      setVisualStandardizerSession({ columns: [] });
      setXAxis('');
      setYAxes([]);
    };

    reader.readAsText(nextFile.slice(0, 1024));
  };

  useEffect(() => {
    if (!visualStandardizerSession.file) {
      return;
    }

    if (file === visualStandardizerSession.file) {
      return;
    }

    setActiveDataset({
      file: visualStandardizerSession.file,
      fileId: visualStandardizerSession.fileId,
      originalFilename: visualStandardizerSession.originalFilename,
      columns: visualStandardizerSession.columns,
    });

    if (visualStandardizerSession.columns.length > 0) {
      setDatasetColumns(visualStandardizerSession.columns);
    } else {
      parseColumnsFromFile(visualStandardizerSession.file);
    }
  }, [
    file,
    visualStandardizerSession.file,
    visualStandardizerSession.fileId,
    visualStandardizerSession.originalFilename,
    visualStandardizerSession.columns,
    setActiveDataset,
    setDatasetColumns,
  ]);

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
        setVisualStandardizerSession({
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
        setChartCode('');
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
      setVisualStandardizerSession({
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
      setChartCode('');
    }
  };


  const handleSelectRecentDataset = async (dataset: RecentDataset) => {
    setError(null);
    setPlotResult(null);
    setLocalPlotBase64(null);
    setPlotPreviewUrl(null);
    setChartCode('');
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
      setVisualStandardizerSession({
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
    if (!file || !xAxis || resolvedYAxes.length === 0 || !selectedStyle) {
      setError("Please fill all fields for plot generation");
      return;
    }

    setIsLoading(true);
    setError(null);
    setPlotResult(null);
    setLocalPlotBase64(null);
    setChartCode('');

    const chartType = plotType === 'bar' || plotType === 'hist'
      ? '2'
      : plotType === 'scatter'
        ? '3'
        : '1';

    try {
      if (isLocalMode) {
        const csvData = await ensureLocalCsv();
        const localResult = await executeHybrid(
          null,
          {
            csvData,
            x_col: xAxis,
            y_axes: resolvedYAxes,
            chart_type: chartType,
            title,
            x_label: xLabel,
            y_label: yLabel,
            y2_label: y2Label,
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
        if (localResult?.source_code) {
          setChartCode(localResult.source_code as string);
        }
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
        setVisualStandardizerSession({
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
          y_axes: resolvedYAxes,
          chart_type: chartType,
          output_filename: outputFilename,
          title,
          x_label: xLabel,
          y_label: yLabel,
          y2_label: y2Label
        }),
      });

      if (!generateRes.ok) throw new Error('Plot generation failed');
      const generateData = await generateRes.json();
      setPlotPreviewUrl(null);
      setPlotResult(generateData);
      setChartCode(generateData.source_code || '');

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
            <p>{error}</p>
            {isLocalMode && (
              <button
                type="button"
                onClick={() => setIsLocalMode(false)}
                className="mt-2 inline-flex items-center rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
              >
                Run via API
              </button>
            )}
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
                      <div className="relative">
                        <select
                          className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                          value={xAxis}
                          onChange={(e) => setXAxis(e.target.value)}
                        >
                          <option value="">Select column...</option>
                          {columns.map((col) => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                          </svg>
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Y-Axis (Multi-select)</label>
                      <div className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm max-h-40 overflow-y-auto">
                        {columns.length === 0 && (
                          <p className="text-slate-500">Upload a dataset to pick columns.</p>
                        )}
                        {columns.length > 0 && (
                          <div className="space-y-3">
                            {columns.map((col) => {
                              const axis = getAxisForColumn(col);
                              const isSelected = Boolean(axis);

                              return (
                                <div key={col} className="flex min-h-[36px] items-center justify-between gap-3">
                                  <label className="flex items-center gap-2 text-slate-700">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                      checked={isSelected}
                                      onChange={() => toggleYAxis(col)}
                                    />
                                    <span className="truncate" title={col}>{col}</span>
                                  </label>
                                  {isSelected && (
                                    <div className="flex items-center rounded-full border border-slate-200 bg-slate-100 p-0.5 text-xs">
                                      <button
                                        type="button"
                                        onClick={() => setAxisForColumn(col, 'primary')}
                                        className={`rounded-full border border-slate-200 px-2 py-0.5 font-medium transition hover:cursor-pointer ${
                                          axis === 'primary'
                                            ? 'bg-white text-slate-900 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                      >
                                        P
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setAxisForColumn(col, 'secondary')}
                                        className={`rounded-full border border-slate-200 px-2 py-0.5 font-medium transition hover:cursor-pointer ${
                                          axis === 'secondary'
                                            ? 'bg-white text-slate-900 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                      >
                                        S
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Assign each selected column to the primary or secondary axis.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Plot Type</label>
                      <div className="relative">
                        <select
                          className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                          value={plotType}
                          onChange={(e) => setPlotType(e.target.value)}
                        >
                          <option value="line">Line</option>
                          <option value="scatter">Scatter</option>
                          <option value="bar">Bar</option>
                          <option value="hist">Histogram</option>
                        </select>
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                          </svg>
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Style</label>
                      <div className="relative">
                        <select
                          className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                          value={selectedStyle}
                          onChange={(e) => setSelectedStyle(e.target.value)}
                        >
                          {styles.map((style) => (
                            <option key={style} value={style}>{style}</option>
                          ))}
                        </select>
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                          </svg>
                        </span>
                      </div>
                    </div>

                  </div>

                  <div className="border-t border-slate-100 pt-4 mt-6">
                    <h4 className="text-sm font-semibold text-slate-800 mb-4">Chart Customization</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Chart Title</label>
                        <input
                          type="text"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                          placeholder="e.g. Sales vs Date"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">X-Axis Label</label>
                        <input
                          type="text"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                          placeholder="e.g. Timeline"
                          value={xLabel}
                          onChange={(e) => setXLabel(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Y-Axis Label (Primary)</label>
                        <input
                          type="text"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                          placeholder="e.g. Price ($)"
                          value={yLabel}
                          onChange={(e) => setYLabel(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Y-Axis Label (Secondary)</label>
                        <input
                          type="text"
                          className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 ${
                            !resolvedYAxes.some((axis) => axis.axis === 'secondary')
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : 'bg-white'
                          }`}
                          placeholder="e.g. Volume"
                          disabled={!resolvedYAxes.some((axis) => axis.axis === 'secondary')}
                          value={y2Label}
                          onChange={(e) => setY2Label(e.target.value)}
                        />
                      </div>
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
                    <div className="mt-4 flex-1 max-h-135 space-y-2 overflow-y-auto pr-1">
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
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setIsPlotFullScreen(true)}
                          disabled={!plotPreviewUrl}
                          className="text-slate-600 hover:text-slate-800 text-sm font-medium border border-slate-200 rounded-full px-3 py-1 hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                          </svg>
                          Full Screen
                        </button>
                        <ChartActionButtons
                          onDownload={handleDownloadPlot}
                          isDownloadDisabled={isLoading || !plotResult?.plot_filename}
                          chartCode={chartCode}
                        />
                      </div>
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

                {isPlotFullScreen && plotPreviewUrl && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 sm:p-6">
                    <button
                      type="button"
                      onClick={() => setIsPlotFullScreen(false)}
                      className="absolute inset-0 cursor-default"
                      aria-label="Close full screen preview"
                    />
                    <div className="relative z-10 w-full max-w-7xl rounded-2xl bg-white shadow-2xl overflow-hidden">
                      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                        <h5 className="text-sm font-semibold text-slate-800">Plot Preview</h5>
                        <button
                          type="button"
                          onClick={() => setIsPlotFullScreen(false)}
                          className="rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 hover:cursor-pointer"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex items-center justify-center bg-slate-50 p-4">
                        <img
                          src={plotPreviewUrl}
                          alt="Generated Plot"
                          className="max-h-[85vh] w-auto rounded-lg border border-slate-200 shadow-sm"
                        />
                      </div>
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
                    <div className="relative">
                      <select
                        className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                        value={codeStyle}
                        onChange={(e) => setCodeStyle(e.target.value)}
                      >
                        {styles.map((style) => (
                          <option key={style} value={style}>{style}</option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                        </svg>
                      </span>
                    </div>
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
