import { useState, useRef } from "react";
import { t } from "~/lib/i18n/i18n";

interface FileUploadProps {
  onFilesChange: (files: FileList | null) => void;
  multiple?: boolean;
  accept?: string;
  maxSize?: number;
}

export function FileUpload({ 
  onFilesChange, 
  multiple = false, 
  accept = ".pdf,.docx,.txt,.jpg,.jpeg,.png,.tiff",
  maxSize = 10 * 1024 * 1024 // 10MB
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [files, setFiles] = useState<FileList | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = e.dataTransfer.files;
    handleFiles(droppedFiles);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    handleFiles(selectedFiles);
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;

    // Validate file sizes
    const validFiles: File[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.size <= maxSize) {
        validFiles.push(file);
      } else {
        alert(`File ${file.name} is too large. Maximum size is ${maxSize / (1024 * 1024)}MB`);
      }
    }

    if (validFiles.length > 0) {
      const newFileList = new DataTransfer();
      validFiles.forEach(file => newFileList.items.add(file));
      setFiles(newFileList.files);
      onFilesChange(newFileList.files);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const clearFiles = () => {
    setFiles(null);
    onFilesChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="w-full">
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer ${
          isDragOver
            ? "border-blue-400 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          multiple={multiple}
          accept={accept}
        />
        
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="mt-4">
            <p className="text-sm text-gray-600">
              {multiple ? t("fileUpload.dragDropMultiple") : t("fileUpload.dragDrop")}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {t("fileUpload.supportedFormats")}
            </p>
            <p className="text-xs text-gray-500">
              {t("fileUpload.maxSize")}
            </p>
            {multiple && (
              <p className="text-xs text-gray-500">
                {t("fileUpload.multipleFilesAllowed")}
              </p>
            )}
          </div>
        </div>
      </div>

      {files && files.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              {files.length === 1 
                ? t("fileUpload.selected") 
                : t("fileUpload.selectedPlural")}: {files.length}
            </p>
            <button
              type="button"
              onClick={clearFiles}
              className="text-sm text-red-600 hover:text-red-500"
            >
              {t("fileUpload.clearAll")}
            </button>
          </div>
          <div className="space-y-1">
            {Array.from(files).map((file, index) => (
              <div key={index} className="flex items-center text-sm text-gray-600">
                <svg className="h-4 w-4 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="flex-1">{file.name}</span>
                <span className="text-xs text-gray-400 ml-2">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}