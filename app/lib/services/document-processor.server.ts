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
  extractTextFromImage,
  extractTextFromPDF,
  requiresOCR,
} from "~/lib/services/ocr.server";
import type { ChatPromptClient, TextPromptClient } from "@langfuse/client";
import mammoth from "mammoth";

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
          },
        });

        return document;
      }),
    );

    // Start processing each document
    for (const document of documents) {
      await processDocumentAsync(document.id).catch(console.error);
    }

    return {
      success: true,
      documentId: documents[0]?.id, // Return first document ID
    };
  } catch (error) {
    console.error("Document processing initiation failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function processDocumentAsync(documentId: string): Promise<void> {
  const startTime = Date.now();

  try {
    // Get document from database
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { user: true },
    });

    if (!document) {
      throw new Error("Document not found");
    }

    // Update status to PROCESSING
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "PROCESSING" },
    });

    // Create processing job
    const job = await prisma.processingJob.create({
      data: {
        type: mapModeToJobType(document.mode),
        status: "RUNNING",
        documentId,
        inputData: {
          sourceLanguage: document.sourceLanguage,
          targetLanguage: document.targetLanguage,
          mode: document.mode,
        },
      },
    });

    await startActiveObservation(`document-${document.mode}`, async (span) => {
      span.updateTrace({
        sessionId: `doc-${documentId}`,
        tags: [document.mode],
      });
      span.update({
        input: {
          fileName: document.originalName,
          fileSize: document.fileSize,
          filePath: document.filePath,
          sourceLanguage: document.sourceLanguage,
          targetLanguage: document.targetLanguage,
          mode: document.mode,
        },
      });

      // Extract text from document (simplified for now)
      const extractedText = await extractTextFromDocument(document);

      await prisma.document.update({
        where: { id: documentId },
        data: {
          extractedText,
        },
      });

      const prompt = await resolveMisPrompt(
        document.mode,
        document.sourceLanguage as Lang,
        document.targetLanguage as Lang,
      );

      // Process with OpenAI
      const openai = getOpenAI({
        sessionId: `doc-${documentId}`,
        generationName: `mis-${document.mode}-generation`,
      });

      const messages = [
        ...prompt,
        {
          role: "user",
          content: `Tesseract OCR result: ${extractedText}`,
        } as const,
      ];

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
      const tokensUsed = estimateTokensUsed(extractedText, generatedContent);

      // Update document with results
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: "COMPLETED",
          translatedText: generatedContent,
          tokensUsed,
          processingTimeMs: processingTime,
          completedAt: new Date(),
        },
      });

      // Complete processing job
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

      // Deduct tokens from user and create transaction
      await prisma.$transaction([
        prisma.user.update({
          where: { id: document.userId },
          data: {
            tokensUsed: { increment: tokensUsed },
            tokensRemaining: { decrement: tokensUsed },
          },
        }),
        prisma.tokenTransaction.create({
          data: {
            type: "PROCESSING_USE",
            amount: -tokensUsed,
            reason: `Document processing: ${document.originalName}`,
            documentId,
            userId: document.userId,
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
    console.error("Document processing failed:", error);

    // Update document and job with error
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        processingTimeMs: Date.now() - startTime,
      },
    });

    // Update processing job if it exists
    await prisma.processingJob.updateMany({
      where: {
        documentId,
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

function clearMarkdown(extractedTextString: string): string {
  let extractedText, llmError, llmComment;
  try {
    extractedText = new RegExp("^```json(.*)```$", "s")
      .exec(extractedTextString)?.[1]
      ?.trim();

    const extractedObject = JSON.parse(extractedText!);

    extractedText = extractedObject.text;
    llmError = extractedObject.error;
    llmComment = extractedObject.comment;
  } catch (error) {
    console.log(error);
    extractedText = extractedTextString;
  }

  console.log({ llmError, llmComment });

  return extractedText;
}

async function extractTextFromDocument(document: Document): Promise<string> {
  try {
    console.log(
      `Extracting text from ${document.originalName} (${document.mimeType})`,
    );

    // Handle different file types
    if (document.mimeType === "application/pdf") {
      // For PDFs, use our OCR service which handles both direct text and scanned PDFs
      const ocrResult = await extractTextFromPDF(
        document.filePath,
        join(dirname(document.filePath), PAGES_SUBDIRECTORY),
      );

      console.log(
        `Successfully extracted ${ocrResult.extractedText.length} characters from PDF`,
      );
      console.log(`OCR confidence: ${ocrResult.confidence}%`);

      return ocrResult.extractedText;
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
      // For image files, use OCR directly
      const ocrResult = await extractTextFromImage(document.filePath);

      console.log(
        `Successfully extracted ${ocrResult.extractedText.length} characters from image`,
      );
      console.log(`OCR confidence: ${ocrResult.confidence}%`);

      return ocrResult.extractedText;
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
