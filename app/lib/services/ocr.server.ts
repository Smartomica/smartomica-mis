import { join } from "node:path";
import { BlobReader, ZipReader, Uint8ArrayWriter } from "@zip.js/zip.js";
import { PDFParse } from "pdf-parse";
import { createWorker, OEM } from "tesseract.js";
import {
  getFileUrl,
  getUploadUrl,
  uploadFile,
} from "~/lib/storage/minio.server";
import { UTILS_BASE_URL } from "~/env.server";

const UTILS_HTTP_PDF_TO_IMAGES_URL = new URL(
  "/convert/pdf-to-png?all=true",
  UTILS_BASE_URL,
).toString();

const TESSERACT_LANGUAGES = [
  "eng",
  "rus",
  "heb",
  "ara",
  "deu",
  "fra",
  "spa",
  "por",
  "uzb",
  "ukr",
];

export interface OCRResult {
  extractedText: string;
  confidence?: number;
  language?: string;
  pages?: number;
}

export async function ocrTextFromImage(filePath: string): Promise<OCRResult> {
  const worker = await createWorker(TESSERACT_LANGUAGES, OEM.LSTM_ONLY, {
    logger: (m) => console.log(m),
  });
  const fileUrl = await getFileUrl(filePath);
  const { data } = await worker.recognize(fileUrl);

  await worker.terminate();

  return {
    extractedText: data.text,
    confidence: data.confidence,
    language: "unknown",
    pages: 1,
  };
}

export async function ocrTextFromPDF(
  filePath: string,
  pagesDirectory: string,
): Promise<OCRResult> {
  try {
    // First try to extract text directly from PDF using pdf-parse
    const directText = await getDirectPDFText(filePath);

    if (directText && directText.trim().length > 50) {
      return {
        extractedText: directText,
        confidence: 99, // High confidence for direct text extraction
        language: "unknown",
        pages: 1,
      };
    }

    const uploadResults = await pdfToImages(filePath, pagesDirectory);

    const ocrDocs = await Promise.all(
      uploadResults.map(async function (item) {
        console.log("Doing OCR on image:", item.fileName);
        const ocrResult = await extractTextWithTesseract(item.buffer);
        return ocrResult;
      }),
    );

    if (ocrDocs.length === 1) {
      return ocrDocs[0];
    }

    return {
      extractedText: ocrDocs.reduce(
        (acc, curr) => acc + "\n" + curr.extractedText,
        "",
      ),
      confidence: Math.min(...ocrDocs.map((doc) => doc.confidence || 0)),
      language: ocrDocs[0]?.language || "unknown",
      pages: ocrDocs.length,
    };
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    throw new Error(
      `Failed to extract text from PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export async function getDirectPDFText(filePath: string): Promise<string> {
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

    if (parsedPdf.getPageText(0).replaceAll("\n", "").trim().length === 0) {
      console.warn("PDF first page is empty, doing OCR");
      return "";
    }

    return parsedPdf.text;
  } catch (error) {
    console.error("Direct PDF text extraction failed:", error);
    return "";
  }
}

async function extractTextWithTesseract(
  imageSource: string | Buffer,
): Promise<OCRResult> {
  try {
    console.log("Using Tesseract OCR for text extraction...");

    const worker = await createTesseractWorker();

    const {
      data: { text, confidence },
    } = await worker.recognize(imageSource);

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
  // Root directory of project, tessdata
  const cachePath = join(import.meta.dirname, "..", "..", "..", "tessdata");
  console.log({ cachePath });

  const worker = await createWorker(TESSERACT_LANGUAGES, OEM.LSTM_ONLY, {
    cachePath,
    errorHandler(error) {
      if (error instanceof Error) throw error;
      console.error(JSON.stringify(error));
    },
    logger(m) {
      if (m.status === "recognizing text") {
        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
      }
      console.log(JSON.stringify(m));
    },
  });

  return worker;
}

export async function pdfToImages(
  filePath: string,
  pagesDirectory: string,
): Promise<{ fileName: string; buffer: Buffer }[]> {
  const fileUrl = await getFileUrl(filePath);
  const pdfResponse = await fetch(fileUrl);

  if (!pdfResponse.ok)
    throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);

  const pdfStream = await pdfResponse.arrayBuffer();
  const imagesResponse = await fetch(UTILS_HTTP_PDF_TO_IMAGES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
    },
    body: pdfStream,
  });

  const size = imagesResponse.headers.get("content-length");
  const isZip =
    imagesResponse.headers.get("content-type") === "application/zip";
  const isImage = imagesResponse.headers.get("content-type") === "image/png";
  const isJSON =
    imagesResponse.headers.get("content-type") === "application/json";

  console.log({
    size,
    isZip,
    isImage,
    isJSON,
    type: imagesResponse.headers.get("content-type"),
    status: imagesResponse.status,
    fileUrl,
  });

  const imageData = await imagesResponse.blob();

  if (isImage) {
    const objectName = join(pagesDirectory, "page-1-of-1.png");
    const uploadUrl = await getUploadUrl(objectName);
    const buffer = Buffer.from(await imageData.arrayBuffer());
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "image/png",
      },
      body: buffer,
    });
    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload image: ${uploadResponse.statusText}`);
    }
    return [{ fileName: objectName, buffer }];
  }
  // Creates a BlobReader object used to read `zipFileBlob`.
  const uploadFromZipBlobResult = await uploadFromZipBlob(
    imageData,
    pagesDirectory,
  );

  return uploadFromZipBlobResult;
}

async function uploadFromZipBlob(zipBlob: Blob, pagesDirectory: string) {
  const zipFileReader = new BlobReader(zipBlob);

  // Creates a ZipReader object reading the zip content via `zipFileReader`,
  // retrieves metadata (name, dates, etc.) of the entries.
  const zipReader = new ZipReader(zipFileReader);
  const entries = await zipReader.getEntries();
  const firstEntry = entries[0];

  if (!firstEntry) {
    await zipReader.close();
    throw new Error("No entry found in zip file");
  }

  // We are not closing the reader here because we need to read the data from entries
  try {
    return await Promise.all(
      entries.map(async (entry) => {
        if (!entry.getData) throw new Error("Entry does not have data");

        const writer = new Uint8ArrayWriter();
        const arrayBuffer = await entry.getData(writer);
        const buffer = Buffer.from(arrayBuffer);

        const fileName = join(pagesDirectory, entry.filename);

        await uploadFile(fileName, buffer);

        return { fileName, buffer };
      }),
    );
  } finally {
    await zipReader.close();
  }
}

// Helper function to determine if a file needs OCR based on extension and content
export function isRequiresOCR(mimeType: string): boolean {
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
    const directText = await getDirectPDFText(filePath);

    // If direct extraction returns very little text, it's likely scanned
    return directText.trim().length < 50;
  } catch (error) {
    console.error("Error checking if PDF is scanned:", error);
    return true; // Assume it needs OCR if we can't determine
  }
}
