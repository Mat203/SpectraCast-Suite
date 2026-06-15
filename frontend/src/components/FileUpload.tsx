import React, { useRef } from 'react';

interface FileUploadProps {
  file: File | null;
  isDragging: boolean;
  onFileSelect: (file: File | null) => void;
  setIsDragging: (isDragging: boolean) => void;
  accentColor?: 'sky' | 'indigo';
}

export const FileUpload: React.FC<FileUploadProps> = ({
  file,
  isDragging,
  onFileSelect,
  setIsDragging,
  accentColor = 'sky',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (droppedFile) {
      onFileSelect(droppedFile);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFileSelect(e.target.files?.[0] ?? null);
  };

  const isSky = accentColor === 'sky';
  
  const borderClass = isDragging
    ? isSky
      ? 'border-sky-500 bg-sky-50'
      : 'border-indigo-500 bg-indigo-50'
    : isSky
      ? 'border-slate-300 hover:border-sky-400 bg-white'
      : 'border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-slate-100';

  const iconColorClass = isSky
    ? 'text-sky-500'
    : 'text-indigo-500';

  return (
    <div
      className={`w-full rounded-xl border-2 border-dashed p-8 md:p-12 text-center transition-colors cursor-pointer ${borderClass}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <svg
        className={`mx-auto mb-4 h-12 w-12 text-slate-400 transition-colors ${isDragging ? iconColorClass : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        />
      </svg>

      <p className="text-lg font-semibold text-slate-800">
        {file ? file.name : 'Click or drag a CSV file here'}
      </p>
      <p className="mt-1 text-sm text-slate-500 font-medium">
        {file
          ? `${(file.size / 1024).toFixed(1)} KB selected`
          : 'Strictly .csv files only'}
      </p>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".csv"
        onChange={handleFileChange}
      />
    </div>
  );
};
