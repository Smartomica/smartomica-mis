import { useState } from "react";
import { useFormUpload, type FormUploadFile } from "~/hooks/useFormUpload";
import { UploadIcon, Cross2Icon, UpdateIcon } from "@radix-ui/react-icons";

interface DirectUploadProps {
  onFilesReady: (files: FormUploadFile[]) => void;
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
    reset,
    removeFile,
  } = useFormUpload();

  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const handleFileSelect = async (fileList: FileList) => {
    if (disabled || fileList.length === 0) return;

    // Check if any file exceeds the size limit
    const oversizedFile = Array.from(fileList).find(
      (file) => file.size > MAX_FILE_SIZE,
    );
    if (oversizedFile) {
      setUploadError(
        `File "${oversizedFile.name}" exceeds the 10MB size limit.`,
      );
      return;
    }

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

      const completedFiles = await uploadAllFiles();

      if (completedFiles.length > 0) {
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
          <UploadIcon className="mx-auto h-12 w-12 text-gray-400" />
          <div className="text-sm text-gray-600">
            <span className="font-medium text-blue-600 hover:text-blue-500">
              Click to upload
            </span>{" "}
            or drag and drop
          </div>
          <p className="text-xs text-gray-500">
            PDF, DOC, DOCX, TXT, PNG, JPG, JPEG up to 10MB
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
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-300">
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
                    <Cross2Icon className="h-4 w-4" />
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
                  <UpdateIcon className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                  Preparing...
                </>
              ) : isUploading ? (
                <>
                  <UpdateIcon className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                  Uploading to Minio...
                </>
              ) : (
                <>
                  <UploadIcon className="-ml-1 mr-2 h-5 w-5" />
                  Upload
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
