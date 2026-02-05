import { useState } from 'react';

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
          <svg className="animate-spin h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Downloading...
        </>
      ) : (
        children
      )}
    </button>
  );
}