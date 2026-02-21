import { startActiveObservation } from "@langfuse/tracing";
import { randomUUID } from "crypto";
import mammoth from "mammoth";
import { dirname, join } from "path";
import { LOCAL_MODE, OPENROUTER_MODEL_GENERAL } from "~/env.server";
import { JobType, ProcessingMode } from "~/generated/client/enums";
import { prisma, type Document, type DocumentStatus } from "~/lib/db/client";
import { NeverError } from "~/lib/error";
import { getOpenAI } from "~/lib/langfuse.server";
import {
  extractDirectPDFText,
  extractTextFromImage,
  extractTextFromPDF,
  pdfToImages,
  requiresOCR,
} from "~/lib/services/ocr.server";
import { getFileUrl } from "~/lib/storage/minio.server";
import {
  Lang,
  ALL_LANGUAGES,
  PAGES_SUBDIRECTORY,
  type ProcessDocumentArgs,
} from "./const";
import { resolveMisPrompt } from "./resolveMisPrompt";
import { estimateTokensNeeded, estimateTokensUsed } from "./tokens";
import { clearMarkdownAroundJson } from "./clearMarkdown";
import { extractText } from "./extractTextWihLLM";

export async function processDocument({
  files,
  sourceLanguage,
  targetLanguage,
  mode,
  userId,
}: ProcessDocumentArgs): Promise<{
  success: boolean;
  documentId?: string;
  batchId?: string;
  error?: string;
}> {
  try {
    if (
      !ALL_LANGUAGES.includes(sourceLanguage as Lang) ||
      !ALL_LANGUAGES.includes(targetLanguage as Lang)
    ) {
      throw new Error("Invalid language");
    }

    // Check if user has enough tokens (estimate needed tokens)
    const estimatedTokens = estimateTokensNeeded(files, mode);
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (user.tokensRemaining < estimatedTokens) {
      return {
        success: false,
        error: `Insufficient tokens. Need ${estimatedTokens}, have ${user.tokensRemaining}`,
      };
    }

    // Create a batch for the documents
    const batchId = randomUUID();
    const batch = await prisma.documentBatch.create({
      data: {
        id: batchId,
        mode,
        status: "PENDING" as DocumentStatus,
      },
    });

    // Create document records in database (files already uploaded via presigned URLs)
    const documents = await Promise.all(
      files.map(async (file) => {
        const documentId = randomUUID();

        // Create document record (file already uploaded to Minio)
        const document = await prisma.document.create({
          data: {
            id: documentId,
            filename: file.objectName,
            originalName: file.name,
            mimeType: file.mimeType,
            fileSize: file.size,
            status: "PENDING" as DocumentStatus,
            mode,
            sourceLanguage,
            targetLanguage: mode === ProcessingMode.OCR ? null : targetLanguage,
            filePath: file.objectName,
            userId,
            batchId: batchId,
          },
        });

        return document;
      }),
    );

    // Call processBatchAsync to handle the batch
    // We don't await this so the response is fast
    processBatchAsync(batchId, userId).catch(console.error);

    return {
      success: true,
      documentId: documents[0]?.id, // Return first document ID for backward compatibility
      batchId: batchId,
    };
  } catch (error) {
    console.error("Document processing initiation failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function processBatchAsync(
  batchId: string,
  userId: string,
): Promise<void> {
  const startTime = Date.now();

  try {
    // Get batch and documents
    const batch = await prisma.documentBatch.findUnique({
      where: { id: batchId },
      include: { documents: true },
    });

    if (!batch) {
      throw new Error("Batch not found");
    }

    const { documents } = batch;
    if (documents.length === 0) {
      throw new Error("No documents in batch");
    }

    // Update batch and documents status to PROCESSING
    await prisma.documentBatch.update({
      where: { id: batchId },
      data: { status: "PROCESSING" },
    });

    await prisma.document.updateMany({
      where: { batchId },
      data: { status: "PROCESSING" },
    });

    // Determine basic info from the first document (assuming all are same for the batch request)
    const firstDoc = documents[0];
    const sourceLanguage = firstDoc.sourceLanguage;
    const targetLanguage = firstDoc.targetLanguage;
    const mode = firstDoc.mode;

    // Create ONE processing job for the batch
    const job = await prisma.processingJob.create({
      data: {
        type: mapModeToJobType(mode),
        status: "RUNNING",
        batchId,
        inputData: {
          sourceLanguage,
          targetLanguage,
          mode,
          documentIds: documents.map((d) => d.id),
        },
      },
    });

    await startActiveObservation(`batch-${mode}`, async (span) => {
      const sessionId = `batch-${batchId}`;

      span.updateTrace({
        sessionId,
        tags: [mode, "batch"],
      });
      span.update({
        input: {
          files: documents.map((d) => d.originalName),
          totalSize: documents.reduce((acc, d) => acc + d.fileSize, 0),
          sourceLanguage,
          targetLanguage,
          mode,
        },
      });

      const openai = getOpenAI({
        sessionId,
        generationName: `mis-${mode}-generation`,
      });

      // 1. Extract text from ALL documents (parallel)
      const extractionResults = await Promise.all(
        documents.map(async (doc) => {
          const text = await extractTextFromDocument(doc, sessionId);
          // Update individual document with extracted text
          await prisma.document.update({
            where: { id: doc.id },
            data: { extractedText: text },
          });
          return { doc, text };
        }),
      );

      const sortedExtractionResults = extractionResults.sort((a, b) =>
        a.doc.originalName.localeCompare(b.doc.originalName),
      );

      const combinedExtractedText = sortedExtractionResults
        .map(
          ({ doc, text }) => `--- Document: ${doc.originalName} ---\n${text}`,
        )
        .join("\n\n");

      // 2. Resolve Prompt
      const prompt = await resolveMisPrompt(
        mode,
        sourceLanguage as Lang,
        targetLanguage as Lang,
      );

      const messages = [
        ...prompt,
        {
          role: "user",
          content: `Tesseract OCR result (combined documents): ${combinedExtractedText}`,
        } as const,
      ];

      // 3. Generate combined output
      const response = await openai.chat.completions.create({
        model: OPENROUTER_MODEL_GENERAL,
        messages,
        temperature: 0.3,
        max_tokens: 4000,
      });

      const generatedContentString =
        response.choices[0]?.message?.content || "";
      const generatedContent = clearMarkdownAroundJson(generatedContentString);
      const processingTime = Date.now() - startTime;
      const tokensUsed = estimateTokensUsed(
        combinedExtractedText,
        generatedContent,
      );

      // 4. Save results to Batch and update Job
      // Update batch
      await prisma.documentBatch.update({
        where: { id: batchId },
        data: {
          status: "COMPLETED",
          combinedResult: generatedContent,
        },
      });

      // Also update individual documents to COMPLETED, storing the same generated content?
      // The prompt says "produce ONE translation/summary".
      // We can store it in the batch.
      // Individual documents might just stay as COMPLETED.
      // Or we can copy the result to each document just in case the UI expects it there?
      // Let's copy it to make sure the UI works if it looks at individual documents.
      await prisma.document.updateMany({
        where: { batchId },
        data: {
          status: "COMPLETED",
          translatedText: generatedContent, // Or maybe "See Batch Result"? Let's verify what UI expects.
          tokensUsed: Math.ceil(tokensUsed / documents.length), // Distribute tokens?
          processingTimeMs: Math.ceil(processingTime / documents.length),
          completedAt: new Date(),
        },
      });

      await prisma.processingJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          outputData: { result: generatedContent },
          tokensUsed,
          processingTimeMs: processingTime,
          completedAt: new Date(),
        },
      });

      // Deduct tokens
      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: {
            tokensUsed: { increment: tokensUsed },
            tokensRemaining: { decrement: tokensUsed },
          },
        }),
        prisma.tokenTransaction.create({
          data: {
            type: "PROCESSING_USE",
            amount: -tokensUsed,
            reason: `Batch processing: ${documents.length} files`,
            documentId: null, // It's a batch, transaction schema doesn't have batchId yet, but that's fine.
            userId: userId,
          },
        }),
      ]);

      span.update({
        output: {
          result: generatedContent,
          tokensUsed,
          processingTime,
        },
      });

      return { content: generatedContent, tokensUsed };
    });
  } catch (error) {
    console.error("Batch processing failed:", error);

    // Update batch, documents and job with error
    await prisma.documentBatch.update({
      where: { id: batchId },
      data: { status: "FAILED" },
    });

    await prisma.document.updateMany({
      where: { batchId },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        processingTimeMs: Date.now() - startTime,
      },
    });

    await prisma.processingJob.updateMany({
      where: {
        batchId,
        status: "RUNNING",
      },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        processingTimeMs: Date.now() - startTime,
      },
    });
  }
}

// Kept for backward compatibility if needed, but not exported anymore if not used elsewhere
export async function processDocumentAsync(documentId: string): Promise<void> {
  // This function is now deprecated in favor of processBatchAsync
  // but we can implement it by finding the batch and processing it.
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Document not found");

  if (doc.batchId) {
    return processBatchAsync(doc.batchId, doc.userId);
  } else {
    // Create a batch for this single document if it doesn't have one
    const batchId = randomUUID();
    await prisma.documentBatch.create({
      data: {
        id: batchId,
        mode: doc.mode,
        status: "PENDING",
        documents: {
          connect: { id: documentId },
        },
      },
    });
    return processBatchAsync(batchId, doc.userId);
  }
}

async function extractTextFromDocument(
  document: Document,
  sessionId: string,
): Promise<string> {
  const openAi = getOpenAI({
    sessionId,
    generationName: "mis-document-text-extraction",
  });

  try {
    console.log(
      `Extracting text from ${document.originalName} (${document.mimeType})`,
    );

    // Handle different file types
    if (document.mimeType === "application/pdf") {
      // For PDFs, use our OCR service which handles both direct text and scanned PDFs
      // Try direct text extraction first (faster and cheaper)
      const directText = await extractDirectPDFText(document.filePath);

      if (directText && directText.trim().length > 50) {
        console.log("Successfully extracted text directly from PDF");
        return directText;
      }

      // Create a unique directory for this document's pages to avoid collisions in parallel processing
      const pagesDir = join(
        dirname(document.filePath),
        PAGES_SUBDIRECTORY,
        document.id,
      );

      if (LOCAL_MODE) {
        const { extractedText, confidence } = await extractTextFromPDF(
          document.filePath,
          pagesDir,
        );
        if (Number.isFinite(confidence) && Number(confidence) > 90) {
          console.log("Successfully extracted text from PDF");
          return extractedText;
        }
        throw new Error("Failed to extract text from PDF via OCR");
      }

      console.log(
        "Direct extraction insufficient, using OpenAI Vision for PDF pages...",
      );

      const images = await pdfToImages(document.filePath, pagesDir);
      const imageUrls = await Promise.all(
        images.map((image) => getFileUrl(image.fileName)),
      );

      console.log(`Converted PDF to ${images.length} images`);

      const fullText = await extractText(openAi, ...imageUrls);

      return fullText;
    } else if (
      document.mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      // For Word documents (DOCX)
      const fileUrl = await getFileUrl(document.filePath);
      const response = await fetch(fileUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      try {
        const result = await mammoth.extractRawText({ buffer });
        console.log(
          `Successfully extracted ${result.value.length} characters from Word document`,
        );
        if (result.messages.length > 0) {
          console.log("Mammoth messages:", result.messages);
        }
        return result.value;
      } catch (error) {
        console.error("Mammoth extraction failed:", error);
        throw new Error(
          `Failed to extract text from Word document: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    } else if (document.mimeType === "application/msword") {
      throw new Error(
        "Legacy DOC format is not supported. Please convert to DOCX or PDF.",
      );
    } else if (requiresOCR(document.mimeType)) {
      if (LOCAL_MODE) {
        console.log("Using OCR for image...");
        const fileUrl = await getFileUrl(document.filePath);
        const { extractedText, confidence } =
          await extractTextFromImage(fileUrl);

        if (Number.isFinite(confidence) && Number(confidence) > 80)
          return extractedText;
        else console.log(`OCR confidence too low: ${confidence}%`);
      }

      // For image files, use OCR directly
      console.log("Using OpenAI Vision for image...");
      const fileUrl = await getFileUrl(document.filePath);

      return await extractText(openAi, fileUrl);
    } else {
      // For text-based files or unsupported formats
      const fileUrl = await getFileUrl(document.filePath);

      // Try to fetch and read as text
      try {
        const response = await fetch(fileUrl);

        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.statusText}`);
        }

        const text = await response.text();
        console.log(`Successfully read ${text.length} characters as text`);

        return text;
      } catch (error) {
        console.error("Failed to read file as text:", error);
        throw new Error(`Unsupported file type: ${document.mimeType}`);
      }
    }
  } catch (error) {
    console.error(
      `Failed to extract text from ${document.originalName}:`,
      error,
    );

    // Return detailed error information
    throw new Error(
      `Text extraction failed for ${document.originalName}: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

function mapModeToJobType(mode: ProcessingMode) {
  switch (mode) {
    case ProcessingMode.TRANSLATE:
      return JobType.TRANSLATION;
    case ProcessingMode.TRANSLATE_JUR:
      return JobType.TRANSLATION;
    case ProcessingMode.SUMMARISE:
      return JobType.TEXT_EXTRACTION;
    case ProcessingMode.SUMMARISE_ONCO:
      return JobType.TEXT_EXTRACTION;
    case ProcessingMode.OCR:
      return JobType.TEXT_EXTRACTION;
    default:
      throw new NeverError(mode);
  }
}
