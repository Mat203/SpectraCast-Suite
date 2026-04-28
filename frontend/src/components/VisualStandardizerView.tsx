import React, { useState, useEffect, useRef } from 'react';

type Tab = 'plot_generator' | 'code_standardizer' | 'style_creator';

interface GeneratePlotResponse {
  status: string;
  plot_filename: string;
}

export const VisualStandardizerView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('plot_generator');
  const [styles, setStyles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [xAxis, setXAxis] = useState<string>('');
  const [yAxis, setYAxis] = useState<string>('');
  const [plotType, setPlotType] = useState<string>('line');
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [outputFilename, setOutputFilename] = useState<string>('plot.png');
  const [plotResult, setPlotResult] = useState<GeneratePlotResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rawCode, setRawCode] = useState<string>('');
  const [codeStyle, setCodeStyle] = useState<string>('');
  const [cleanedCode, setCleanedCode] = useState<string>('');

  useEffect(() => {
    const fetchStyles = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch('http://127.0.0.1:8000/api/vs/styles');
        if (!res.ok) {
          throw new Error('Failed to fetch styles');
        }
        const data = await res.json();
        setStyles(data.styles || []);
        if (data.styles && data.styles.length > 0) {
          setSelectedStyle(data.styles[0]);
          setCodeStyle(data.styles[0]);
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
  }, []);

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

      setColumns(parsedHeaders);
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
      setColumns([]);
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
        setFile(droppedFile);
        parseColumnsFromFile(droppedFile);
      } else {
        alert('Please upload a .csv file');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      parseColumnsFromFile(selectedFile);
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

    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('http://127.0.0.1:8000/api/upload/', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) throw new Error('File upload failed');
      const uploadData = await uploadRes.json();
      const fileId = uploadData.file_id;

      const generateRes = await fetch('http://127.0.0.1:8000/api/vs/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_id: fileId,
          style_name: selectedStyle,
          x: xAxis,
          y: yAxis,
          plot_type: plotType,
          output_filename: outputFilename
        }),
      });

      if (!generateRes.ok) throw new Error('Plot generation failed');
      const generateData = await generateRes.json();
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
      const res = await fetch('http://127.0.0.1:8000/api/vs/standardize-code', {
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

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          {activeTab === 'plot_generator' && (
            <div className="space-y-6">
              {/* File Upload */}
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

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  onClick={handleGeneratePlot}
                  disabled={isLoading}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-md font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {isLoading ? 'Generating...' : 'Generate Plot'}
                </button>
              </div>

              {plotResult && (
                 <div className="mt-6 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex justify-between items-center">
                      <h4 className="text-slate-800 font-medium">Generated Plot Preview</h4>
                      <a 
                        href={`http://127.0.0.1:8000/api/vs/download/${plotResult.plot_filename}`}
                        download={plotResult.plot_filename}
                        className="text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download Image
                      </a>
                    </div>
                    <div className="p-4 bg-slate-50 flex justify-center custom-plot-preview">
                      <img 
                        src={`http://127.0.0.1:8000/api/vs/plot/${plotResult.plot_filename}`} 
                        alt="Generated Plot" 
                        className="max-w-full h-auto rounded shadow-sm border border-slate-200"
                        style={{ maxHeight: '500px' }}
                      />
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
