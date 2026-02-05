import { useState } from "react";

export interface FormUploadFile {
  file: File;
  uploadForm: {
    url: string;
    fields: Record<string, string>;
  };
  downloadUrl: string;
  objectName: string;
  progress?: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
}

export function useFormUpload() {
  const [files, setFiles] = useState<FormUploadFile[]>([]);
  const [isGeneratingForms, setIsGeneratingForms] = useState(false);

  const generateUploadForms = async (fileList: FileList): Promise<void> => {
    setIsGeneratingForms(true);

    try {
      const newFiles: FormUploadFile[] = [];

      for (const file of Array.from(fileList)) {
        const response = await fetch("/uploads/presigned", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to generate upload form: ${error}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to generate upload form");
        }

        newFiles.push({
          file,
          uploadForm: data.data.uploadForm,
          downloadUrl: data.data.downloadUrl,
          objectName: data.data.objectName,
          status: "pending",
        });
      }

      setFiles(newFiles);
    } catch (error) {
      console.error("Error generating upload forms:", error);
      throw error;
    } finally {
      setIsGeneratingForms(false);
    }
  };

  const uploadFile = async (fileIndex: number): Promise<FormUploadFile> =>
    new Promise(function (resolve, reject) {
      const fileToUpload = files[fileIndex];
      if (!fileToUpload || fileToUpload.status !== "pending") {
        return;
      }

      // Update status to uploading
      setFiles((prev) =>
        prev.map((f, i) =>
          i === fileIndex
            ? { ...f, status: "uploading" as const, progress: 0 }
            : f,
        ),
      );

      try {
        // Create form data
        const formData = new FormData();

        // Add all the presigned form fields first
        Object.entries(fileToUpload.uploadForm.fields).forEach(
          ([key, value]) => {
            formData.append(key, value);
          },
        );

        // Add the file last (this is important for S3/Minio)
        formData.append("file", fileToUpload.file);

        // Create XMLHttpRequest for progress tracking
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            setFiles((prev) =>
              prev.map((f, i) => (i === fileIndex ? { ...f, progress } : f)),
            );
          }
        };

        // Handle completion
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setFiles((prev) => {
              const files = prev.map((f, i) =>
                i === fileIndex
                  ? { ...f, status: "completed" as const, progress: 100 }
                  : f,
              );
              resolve(files[fileIndex]);
              return files;
            });
          } else {
            setFiles((prev) =>
              prev.map((f, i) =>
                i === fileIndex
                  ? {
                      ...f,
                      status: "error" as const,
                      error: `Upload failed with status ${xhr.status}: ${xhr.responseText}`,
                    }
                  : f,
              ),
            );
            reject(
              new Error(
                `Upload failed with status ${xhr.status}: ${xhr.responseText}`,
              ),
            );
          }
        };

        // Handle errors
        xhr.onerror = () => {
          setFiles((prev) =>
            prev.map((f, i) =>
              i === fileIndex
                ? {
                    ...f,
                    status: "error" as const,
                    error: "Network error during upload",
                  }
                : f,
            ),
          );
          reject(new Error("Network error during upload"));
        };

        // Start upload to Minio
        xhr.open("POST", fileToUpload.uploadForm.url);
        xhr.send(formData);
      } catch (error) {
        setFiles((prev) =>
          prev.map((f, i) =>
            i === fileIndex
              ? {
                  ...f,
                  status: "error" as const,
                  error:
                    error instanceof Error ? error.message : "Unknown error",
                }
              : f,
          ),
        );
        reject(new Error("Network error during upload"));
      }
    });

  const uploadAllFiles = async (): Promise<FormUploadFile[]> => {
    const pendingFiles = files
      .map((_, index) => index)
      .filter((index) => files[index].status === "pending");

    // Upload files in parallel
    return await Promise.all(pendingFiles.map(uploadFile));
  };

  const reset = () => {
    setFiles([]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return {
    files,
    isGeneratingForms,
    generateUploadForms,
    uploadFile,
    uploadAllFiles,
    reset,
    removeFile,
  };
}
