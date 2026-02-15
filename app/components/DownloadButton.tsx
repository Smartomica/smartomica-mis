import { useState } from 'react';
import { UpdateIcon } from '@radix-ui/react-icons';

interface DownloadButtonProps {
  documentId: string;
  fileName?: string;
  className?: string;
  children: React.ReactNode;
}

export function DownloadButton({
  documentId,
  fileName,
  className = "text-blue-600 hover:text-blue-900 inline-flex items-center",
  children
}: DownloadButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch the download info
      const response = await fetch(`/documents/download/${documentId}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Download failed with status ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Download failed');
      }

      // If we have content directly, create and download blob
      if (data.data.content) {
        const blob = new Blob([data.data.content], { type: data.data.mimeType });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName || data.data.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
      } 
      // If we have a downloadUrl (presigned URL), redirect to it
      else if (data.data.downloadUrl) {
        const link = document.createElement('a');
        link.href = data.data.downloadUrl;
        link.download = fileName || data.data.fileName || '';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } 
      else {
        throw new Error('No download method available');
      }

    } catch (error) {
      console.error('Download error:', error);
      setError(error instanceof Error ? error.message : 'Download failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (error) {
    return (
      <div className="text-red-600 text-sm">
        <div>Download failed: {error}</div>
        <button 
          onClick={() => setError(null)}
          className="text-blue-600 hover:text-blue-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={isLoading}
      className={`${className} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {isLoading ? (
        <>
          <UpdateIcon className="animate-spin h-4 w-4 mr-1" />
          Downloading...
        </>
      ) : (
        children
      )}
    </button>
  );
}