import { dirname, join } from "path";
import { randomUUID } from "crypto";
import { startActiveObservation } from "@langfuse/tracing";
import {
  getOpenAI,
  getLangfuseSDK,
  compileChatPrompt,
  listPrompts,
} from "~/lib/langfuse.server";
import { getFileUrl } from "~/lib/storage/minio.server";
import { prisma } from "~/lib/db/client";
import { type Document, type DocumentStatus } from "~/lib/db/client";
import { JobType, ProcessingMode } from "~/generated/client/enums";
import { NeverError } from "~/lib/error";
import {
  requiresOCR,
  pdfToImages,
  extractTextFromImage,
  extractTextFromPDF,
  extractDirectPDFText,
} from "~/lib/services/ocr.server";
import type { ChatPromptClient, TextPromptClient } from "@langfuse/client";
import mammoth from "mammoth";
import type OpenAI from "openai";
import { LOCAL_MODE } from "~/env.server";

const PAGES_SUBDIRECTORY = "pages";

export interface SimplifiedChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ProcessDocumentArgs {
  files: Array<{
    objectName: string;
    name: string;
    mimeType: string;
    size: number;
  }>;
  sourceLanguage: string;
  targetLanguage: string;
  mode: ProcessingMode;
  userId: string;
}

enum Lang {
  Auto = "auto",
  AR = "ar",
  EN = "en",
  ES = "es",
  FR = "fr",
  DE = "de",
  HE = "he",
  IT = "it",
  PT = "pt",
  RU = "ru",
  UK = "uk",
  UZ = "uz",
}

export const ALL_LANGUAGES: Lang[] = Object.values(Lang);

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

export async function processBatchAsync(
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
        model: "openai/gpt-4o",
        messages,
        temperature: 0.3,
        max_tokens: 4000,
      });

      const generatedContentString =
        response.choices[0]?.message?.content || "";
      const generatedContent = clearMarkdown(generatedContentString);
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

function clearMarkdown(extractedTextString: string): string {
  let extractedText, llmError, llmComment;
  try {
    extractedText = new RegExp("^```(json|JSON)(.*)```$", "s")
      .exec(extractedTextString)
      ?.at(2)
      ?.trim();

    const extractedObject = JSON.parse(extractedText!);

    extractedText = extractedObject.text;
    llmError = extractedObject.error;
    llmComment = extractedObject.comment;
  } catch (error) {
    console.log(error);
    extractedText = extractedTextString;
  }

  if (llmError) {
    throw new Error(llmError);
  }

  return extractedText;
}

async function extractTextFromDocument(
  document: Document,
  sessionId: string,
): Promise<string> {
  const openAi = getOpenAI({
    sessionId,
    generationName: "document-text-extraction",
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

      const fullText = await extractTextWithOpenAI(openAi, ...imageUrls);

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

      return await extractTextWithOpenAI(openAi, fileUrl);
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

function estimateTokensNeeded(
  files: Array<{ size: number }>,
  mode: string,
): number {
  // Simple estimation: 1 token per 4 characters, with overhead for processing
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const baseTokens = Math.ceil(totalSize / 4);

  // Add overhead based on mode
  const overhead = mode === "ocr" ? 1.2 : 2.0; // Translation needs more tokens
  return Math.ceil(baseTokens * overhead) * 1e-4;
}

function estimateTokensUsed(input: string, output: string): number {
  // Simple estimation: 1 token per 4 characters for both input and output
  const inputTokens = Math.ceil(input.length / 4);
  const outputTokens = Math.ceil(output.length / 4);
  return inputTokens + outputTokens;
}

async function resolveMisPrompt(
  processingMode: ProcessingMode,
  sourceLanguage: Lang,
  targetLanguage: Lang,
): Promise<SimplifiedChatMessage[]> {
  const misPrompts = await listPrompts({ tag: "mis", limit: 100 });
  const sdk = getLangfuseSDK();

  switch (processingMode) {
    case ProcessingMode.OCR:
      const ocrChatPrompts = misPrompts.data.filter(
        (p) =>
          p.type === "chat" &&
          p.tags.includes("ocr") &&
          p.tags.includes("chat"),
      );

      const glossaryTextPrompts = misPrompts.data.filter(
        (p) =>
          p.type === "text" &&
          p.tags.includes("glossary") &&
          p.tags.includes(sourceLanguage),
      );

      let ocrChatPrompt = await sdk.prompt.get(ocrChatPrompts[0]?.name, {
        type: "chat",
      });

      let ocrTextPrompt = await sdk.prompt.get(glossaryTextPrompts[0]?.name, {
        type: "text",
      });

      return combinePrompts(ocrChatPrompt, ocrTextPrompt);

    case ProcessingMode.SUMMARISE:
      const summariseChatPromptName = misPrompts.data
        .filter((p) => p.type === "chat" && p.tags.includes("summary"))
        .at(0)?.name;

      const summariseTextPromptName = misPrompts.data
        .filter(
          (p) =>
            p.type === "text" &&
            p.tags.includes("glossary") &&
            p.tags.includes(sourceLanguage),
        )
        ?.at(0)?.name;

      let summariseChatPrompt = summariseChatPromptName
        ? await sdk.prompt.get(summariseChatPromptName, {
            type: "chat",
          })
        : null;

      let summariseTextPrompt = summariseTextPromptName
        ? await sdk.prompt.get(summariseTextPromptName, {
            type: "text",
          })
        : null;

      return combinePrompts(summariseChatPrompt, summariseTextPrompt);

    case ProcessingMode.SUMMARISE_ONCO:
      const summariseOncoChatPromptName = misPrompts.data
        .filter((p) => p.type === "chat" && p.tags.includes("oncology"))
        .at(0)?.name;

      const summariseOncoTextPromptName = misPrompts.data
        .filter(
          (p) =>
            p.type === "text" &&
            p.tags.includes("glossary") &&
            p.tags.includes(sourceLanguage),
        )
        ?.at(0)?.name;

      let summariseOncoChatPrompt = summariseOncoChatPromptName
        ? await sdk.prompt.get(summariseOncoChatPromptName, {
            type: "chat",
          })
        : null;

      let summariseOncoTextPrompt = summariseOncoTextPromptName
        ? await sdk.prompt.get(summariseOncoTextPromptName, {
            type: "text",
          })
        : null;

      return combinePrompts(summariseOncoChatPrompt, summariseOncoTextPrompt);

    case ProcessingMode.TRANSLATE:
    case ProcessingMode.TRANSLATE_JUR:
      const langPairChatPromptName =
        misPrompts.data
          .filter(
            (p) =>
              p.type === "chat" &&
              p.tags.includes("translate") &&
              // Require name to include smth like ru->en
              p.name.indexOf(sourceLanguage) < p.name.indexOf(targetLanguage) &&
              p.tags.includes(sourceLanguage) &&
              p.tags.includes(targetLanguage),
          )
          .at(0)?.name ||
        misPrompts.data
          .filter(
            (p) =>
              p.type === "chat" &&
              p.tags.includes("translate") &&
              p.tags.includes("from-any-lang") &&
              p.tags.includes(targetLanguage),
          )
          .at(0)?.name;

      const glossarySourceTextPromptName = misPrompts.data
        .filter((p) => p.type === "text" && p.tags.includes(sourceLanguage))
        .at(0)?.name;

      const glossaryTargetTextPromptName = misPrompts.data
        .filter((p) => p.type === "text" && p.tags.includes(targetLanguage))
        .at(0)?.name;

      const langPairChatPrompt = langPairChatPromptName
        ? await sdk.prompt.get(langPairChatPromptName, { type: "chat" })
        : null;

      const glossarySourceTextPrompt = glossarySourceTextPromptName
        ? await sdk.prompt.get(glossarySourceTextPromptName, { type: "text" })
        : null;
      const glossaryTargetTextPrompt = glossaryTargetTextPromptName
        ? await sdk.prompt.get(glossaryTargetTextPromptName, { type: "text" })
        : null;

      return combinePrompts(
        langPairChatPrompt,
        glossarySourceTextPrompt,
        glossaryTargetTextPrompt,
      );
    default:
      throw new NeverError(processingMode);
  }
}

function combinePrompts(
  chat: ChatPromptClient | null,
  ...texts: (TextPromptClient | null)[]
): SimplifiedChatMessage[] {
  const combinedPrompt = compileChatPrompt(chat, {});

  const combinedTextPrompts = texts.filter(Boolean).map(
    (text) =>
      ({
        role: "system",
        content: text!.prompt,
      }) as const,
  );

  return [...combinedPrompt, ...combinedTextPrompts];
}

async function extractTextWithOpenAI(
  openai: OpenAI,
  ...imageUrls: string[]
): Promise<string> {
  const imageMessages = imageUrls.map(function (imageUrl) {
    return {
      type: "image_url",
      image_url: {
        url: imageUrl,
      },
    } as const;
  });

  const response = await openai.chat.completions.create({
    model: "openai/gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract all text from this image(s). Return only the extracted text, no markdown formatting or comments. Only in the original languages. No complicated guesses. Use - instead",
          },
          ...imageMessages,
        ],
      },
    ],
    max_tokens: 4000,
  });

  return response.choices[0]?.message?.content || "";
}
