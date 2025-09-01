import React from 'react';

interface FileUploadProps {
  onFileChange: (files: FileList) => void;
  onAnalyze: (customerLocation?: string) => void;
  files: File[];
  removeFile: (file: File) => void;
  isLoading: boolean;
  disabled: boolean;
}

export default function FileUpload({ onFileChange, onAnalyze, files, removeFile, isLoading, disabled }: FileUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [customerLocation, setCustomerLocation] = React.useState('');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFileChange(e.target.files);
      // Reset input value to allow re-uploading the same file
      e.target.value = ''; 
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      onFileChange(e.dataTransfer.files);
    }
  };
  
  const handleRemoveFile = (e: React.MouseEvent, fileToRemove: File) => {
    e.stopPropagation();
    removeFile(fileToRemove);
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Upload Network Reports</h2>
        <div
            className={`flex flex-col items-center justify-center w-full p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors
            ${disabled ? 'bg-gray-100' : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'}`}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => !disabled && inputRef.current?.click()}
        >
            <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileSelect}
                disabled={disabled}
                multiple
            />
            {files.length === 0 ? (
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 text-gray-400 mb-4">📁</div>
                    <p className="font-semibold text-gray-600">Drag & drop your reports here</p>
                    <p className="text-sm text-gray-500 mt-1">Supports PDF files only</p>
                    <p className="text-sm text-gray-400 mt-1">or click to browse</p>
                </div>
            ) : (
                 <div className="text-center">
                    <p className="font-semibold text-gray-700">{files.length} file(s) selected.</p>
                    <p className="text-sm text-gray-500 mt-1">Click again or drag to add more.</p>
                 </div>
            )}
        </div>

        {files.length > 0 && !disabled && (
            <div className="mt-4 space-y-2">
                <h3 className="text-sm font-medium text-gray-600">Selected Files:</h3>
                <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
                    {files.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <span className="text-blue-500 flex-shrink-0">📄</span>
                                <span className="text-sm text-gray-800 truncate" title={file.name}>{file.name}</span>
                                <span className="text-xs text-gray-500 uppercase px-1 py-0.5 bg-gray-200 rounded">
                                    {file.name.split('.').pop()}
                                </span>
                            </div>
                            <button 
                                className="w-6 h-6 text-red-500 hover:bg-red-100 flex-shrink-0 rounded"
                                onClick={(e) => handleRemoveFile(e, file)}
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {files.length > 0 && !disabled && (
            <div className="mt-4 space-y-4">
                <div className="space-y-2">
                    <label htmlFor="customerLocation" className="block text-sm font-medium text-gray-700">
                        🌍 Customer Location (Optional)
                    </label>
                    <input
                        type="text"
                        id="customerLocation"
                        value={customerLocation}
                        onChange={(e) => setCustomerLocation(e.target.value)}
                        placeholder="e.g., Europe/Prague, America/New_York, Asia/Tokyo"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={isLoading}
                    />
                    <p className="text-xs text-gray-500">
                        Enter timezone for proper UTC to local time conversion (e.g., Europe/Prague, America/New_York)
                    </p>
                </div>
            </div>
        )}

        <div className="mt-6 flex justify-end">
            <button 
                onClick={() => onAnalyze(customerLocation || undefined)} 
                disabled={files.length === 0 || isLoading || disabled}
                className={`px-6 py-3 rounded-md font-semibold text-white transition-all ${
                    files.length === 0 || isLoading || disabled
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                }`}
            >
                {isLoading ? `Analyzing ${files.length} Files...` : `Generate ${files.length} Insight(s)`}
            </button>
        </div>
    </div>
  );
}
