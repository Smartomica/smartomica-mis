import { useState } from "react";
import { useFormUpload } from "~/hooks/useFormUpload";

interface DirectUploadProps {
  onFilesReady: (
    files: Array<{
      objectName: string;
      originalName: string;
      mimeType: string;
      size: number;
    }>,
  ) => void;
  multiple?: boolean;
  accept?: string;
  disabled?: boolean;
}

export function DirectUpload({
  onFilesReady,
  multiple = true,
  accept = ".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg",
  disabled = false,
}: DirectUploadProps) {
  const {
    files,
    isGeneratingForms,
    generateUploadForms,
    uploadAllFiles,
    getCompletedFiles,
    reset,
    removeFile,
  } = useFormUpload();

  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileSelect = async (fileList: FileList) => {
    if (disabled || fileList.length === 0) return;

    try {
      setUploadError(null);
      await generateUploadForms(fileList);
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : "Failed to prepare files for upload",
      );
    }
  };

  // @todo: fix uploaded file callback. onFilesReady is not firing
  const handleUpload = async () => {
    try {
      setUploadError(null);
      await uploadAllFiles();

      const completedFiles = getCompletedFiles();
      if (completedFiles.length > 0) {
        console.log("Files uploaded successfully:", completedFiles);
        onFilesReady(completedFiles);
      }

      const hasErrors = files.some((f) => f.status === "error");
      if (hasErrors) {
        setUploadError(
          "Some files failed to upload. Please check the individual file statuses.",
        );
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (!disabled && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const allFilesCompleted =
    files.length > 0 && files.every((f) => f.status === "completed");
  const hasFiles = files.length > 0;
  const isUploading = files.some((f) => f.status === "uploading");

  return (
    <div className="space-y-4">
      {/* File Drop Zone */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragOver
            ? "border-blue-400 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (!disabled) {
            document.getElementById("direct-file-upload")?.click();
          }
        }}
      >
        <input
          id="direct-file-upload"
          type="file"
          multiple={multiple}
          accept={accept}
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files) {
              handleFileSelect(e.target.files);
            }
          }}
        />

        <div className="space-y-2">
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
          <div className="text-sm text-gray-600">
            <span className="font-medium text-blue-600 hover:text-blue-500">
              Click to upload
            </span>{" "}
            or drag and drop
          </div>
          <p className="text-xs text-gray-500">
            PDF, DOC, DOCX, TXT, PNG, JPG, JPEG up to 10MB
          </p>
          <p className="text-xs text-blue-500 font-medium">
            ⚡ Direct upload to storage (bypasses server)
          </p>
        </div>
      </div>

      {/* Error Message */}
      {uploadError && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-700">{uploadError}</div>
        </div>
      )}

      {/* Files List */}
      {hasFiles && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-900">
              Files ({files.length})
            </h4>
            <button
              type="button"
              onClick={reset}
              className="text-sm text-gray-500 hover:text-gray-700"
              disabled={isUploading}
            >
              Clear all
            </button>
          </div>

          <div className="space-y-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {file.file.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {(file.file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>

                {/* Status */}
                <div className="shrink-0">
                  {file.status === "pending" && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Ready
                    </span>
                  )}
                  {file.status === "uploading" && (
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${file.progress || 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600">
                        {Math.round(file.progress || 0)}%
                      </span>
                      <span className="text-xs text-blue-600 font-medium">
                        → Minio
                      </span>
                    </div>
                  )}
                  {file.status === "completed" && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      ✓ Uploaded
                    </span>
                  )}
                  {file.status === "error" && (
                    <div className="text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Error
                      </span>
                      {file.error && (
                        <div
                          className="text-xs text-red-600 mt-1 max-w-32 truncate"
                          title={file.error}
                        >
                          {file.error}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Remove Button */}
                {!isUploading && (
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="shrink-0 text-gray-400 hover:text-gray-600"
                  >
                    <span className="sr-only">Remove</span>
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Upload Button */}
          {files.some((f) => f.status === "pending") && (
            <button
              type="button"
              onClick={handleUpload}
              disabled={isGeneratingForms || isUploading}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isGeneratingForms ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Preparing...
                </>
              ) : isUploading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Uploading to Minio...
                </>
              ) : (
                <>
                  <svg
                    className="-ml-1 mr-2 h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                    />
                  </svg>
                  Upload Directly to Storage
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
