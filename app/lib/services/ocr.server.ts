import { getFileUrl } from "~/lib/storage/minio.server";
import { PDFParse } from "pdf-parse";
import { createWorker } from "tesseract.js";

export interface OCRResult {
  extractedText: string;
  confidence?: number;
  language?: string;
  pages?: number;
}

export async function extractTextFromPDF(filePath: string): Promise<OCRResult> {
  try {
    // First try to extract text directly from PDF using pdf-parse
    const directText = await extractDirectPDFText(filePath);

    if (directText && directText.trim().length > 50) {
      return {
        extractedText: directText,
        confidence: 99, // High confidence for direct text extraction
        language: "unknown",
        pages: 1,
      };
    }

    // If direct extraction failed or returned minimal text, use OCR
    return await extractTextWithTesseract(filePath);
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    throw new Error(
      `Failed to extract text from PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

async function extractDirectPDFText(filePath: string): Promise<string> {
  try {
    // Get file URL from Minio
    const fileUrl = await getFileUrl(filePath);

    // Fetch the file
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();

    const pdfData = new PDFParse({
      data: buffer,
    });

    const parsedPdf = await pdfData.getText();

    return parsedPdf.text;
  } catch (error) {
    console.error("Direct PDF text extraction failed:", error);
    return "";
  }
}

async function extractTextWithTesseract(filePath: string): Promise<OCRResult> {
  try {
    console.log("Using Tesseract OCR for text extraction...");

    // Get file URL from Minio
    const fileUrl = await getFileUrl(filePath);

    // For now, we'll use Tesseract.js as a fallback since Docker integration
    // requires more complex setup. In production, you'd want to use the Docker service.
    const worker = await createTesseractWorker();

    const {
      data: { text, confidence },
    } = await worker.recognize(fileUrl);

    await worker.terminate();

    console.log(
      `Tesseract extracted ${text.length} characters with ${confidence}% confidence`,
    );

    return {
      extractedText: text,
      confidence: Math.round(confidence),
      language: "unknown",
      pages: 1,
    };
  } catch (error) {
    console.error("Tesseract OCR failed:", error);
    throw new Error(
      `OCR processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

async function createTesseractWorker() {
  // Dynamic import for Tesseract.js

  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text") {
        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
      }
    },
  });

  return worker;
}

// Helper function to determine if a file needs OCR based on extension and content
export function requiresOCR(mimeType: string): boolean {
  const ocrRequiredTypes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/gif",
    "image/bmp",
    "image/tiff",
    "image/webp",
  ];

  return ocrRequiredTypes.includes(mimeType.toLowerCase());
}

// Helper function to determine if PDF likely contains scanned images
export async function isScannedPDF(filePath: string): Promise<boolean> {
  try {
    const directText = await extractDirectPDFText(filePath);

    // If direct extraction returns very little text, it's likely scanned
    return directText.trim().length < 50;
  } catch (error) {
    console.error("Error checking if PDF is scanned:", error);
    return true; // Assume it needs OCR if we can't determine
  }
}
