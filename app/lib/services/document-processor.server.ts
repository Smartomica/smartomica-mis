import { randomUUID } from "crypto";
import { startActiveObservation } from "@langfuse/tracing";
import {
  getOpenAI,
  getLangfuseSDK,
  compileChatPrompt,
} from "~/lib/langfuse.server";
import { getFileUrl } from "~/lib/storage/minio.server";
import { prisma } from "~/lib/db/client";
import { type Document, type DocumentStatus } from "~/lib/db/client";
import { JobType, ProcessingMode } from "~/generated/client/enums";
import { NeverError } from "~/lib/error";

export async function processDocument({
  files,
  sourceLanguage,
  targetLanguage,
  mode,
  userId,
}: {
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
}): Promise<{ success: boolean; documentId?: string; error?: string }> {
  try {
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

async function processDocumentAsync(documentId: string): Promise<void> {
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
          sourceLanguage: document.sourceLanguage,
          targetLanguage: document.targetLanguage,
          mode: document.mode,
        },
      });

      const langfuse = getLangfuseSDK();
      let promptName: string;
      let content: string;

      // Get appropriate prompt based on mode
      switch (document.mode) {
        case ProcessingMode.SUMMARISE:
          promptName = "Mis-summarise-Chat";
          break;
        case ProcessingMode.SUMMARISE_ONCO:
          promptName = "Mis-summarise-onco-Chat";
          break;
        case ProcessingMode.OCR:
          promptName = "Mis-ocr-Chat";
          break;
        case ProcessingMode.TRANSLATE:
          promptName = "Mis-translate-Chat";
          break;
        case ProcessingMode.TRANSLATE_JUR:
          promptName = "Mis-translate-jur-Chat";
          break;
        default:
          throw new NeverError(document.mode);
      }

      // Try to get prompt from Langfuse, fallback to default
      let prompt;
      try {
        prompt = await langfuse.prompt.get(promptName);
      } catch {
        // Fallback prompts if not found in Langfuse
        prompt = getDefaultPrompt(
          document.mode,
          document.sourceLanguage,
          document.targetLanguage || "",
        );
      }

      // Extract text from document (simplified for now)
      const extractedText = await extractTextFromDocument(document);

      if (document.mode === ProcessingMode.OCR) {
        content = extractedText;
      } else {
        // Process with OpenAI
        const openai = getOpenAI({
          sessionId: `doc-${documentId}`,
          generationName: `${document.mode}-generation`,
        });

        let messages;
        if (
          prompt &&
          typeof prompt === "object" &&
          "prompt" in prompt &&
          prompt.prompt
        ) {
          // Langfuse prompt
          messages = compileChatPrompt(prompt as any, {
            sourceLanguage: document.sourceLanguage,
            targetLanguage: document.targetLanguage || "",
            document: extractedText,
          });
        } else {
          // Fallback prompt
          const fallbackPrompt = prompt as { system: string; user: string };
          messages = [
            { role: "system" as const, content: fallbackPrompt.system },
            {
              role: "user" as const,
              content: `${fallbackPrompt.user}\n\nDocument:\n${extractedText}`,
            },
          ];
        }

        const response = await openai.chat.completions.create({
          model: "openai/gpt-4o",
          messages,
          temperature: 0.3,
          max_tokens: 4000,
        });

        content = response.choices[0]?.message?.content || "";
      }

      const processingTime = Date.now() - startTime;
      const tokensUsed = estimateTokensUsed(extractedText, content);

      // Update document with results
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: "COMPLETED",
          extractedText:
            document.mode !== ProcessingMode.OCR ? extractedText : null,
          translatedText:
            document.mode !== ProcessingMode.TRANSLATE ? content : null,
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
          outputData: { result: content },
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
          result: content.slice(0, 500) + (content.length > 500 ? "..." : ""),
          tokensUsed,
          processingTime,
        },
      });

      return { content, tokensUsed };
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

async function extractTextFromDocument(document: Document): Promise<string> {
  // Get presigned URL to access file for processing
  const fileUrl = await getFileUrl(document.filePath);

  // In production, you would:
  // 1. Use the presigned URL to fetch the file
  // 2. Process it with OCR libraries or send to OpenAI Vision API
  // 3. Return extracted text

  // For now, return placeholder with the URL that would be used
  return `[Extracted text from file: ${document.originalName}]\n\nFile URL for processing: ${fileUrl}\n\nThis is placeholder text that would be extracted from the actual document file using OCR technology. In production, this would be replaced with actual text extraction from PDFs, images, and other document formats. The file is ${document.fileSize} bytes and has MIME type ${document.mimeType}.`;
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

function getDefaultPrompt(
  mode: ProcessingMode,
  sourceLanguage: string,
  targetLanguage: string,
) {
  const prompts: {
    [key in ProcessingMode]: {
      system: string;
      user: string;
    };
  } = {
    [ProcessingMode.OCR]: {
      system:
        "You are an OCR system. Extract and clean up text from the document, maintaining structure and correcting any OCR errors.",
      user: "Please extract clean text from this document:",
    },
    [ProcessingMode.TRANSLATE]: {
      system: `You are a professional medical translator. Translate the following medical document from ${sourceLanguage} to ${targetLanguage}. Maintain medical terminology accuracy and document structure.`,
      user: "Please translate this medical document:",
    },
    [ProcessingMode.SUMMARISE]: {
      system: `You are a medical document analyst. Create a concise summary of the medical document, highlighting key medical findings, diagnoses, and recommendations.`,
      user: "Please summarize this medical document:",
    },
    [ProcessingMode.SUMMARISE_ONCO]: {
      system: `You are a medical document analyst. Create a concise summary of the medical document, highlighting key medical findings, diagnoses, and recommendations.`,
      user: "Please summarize this medical document:",
    },
    [ProcessingMode.TRANSLATE_JUR]: {
      system: `You are a professional legal translator. Translate the following document from ${sourceLanguage} to ${targetLanguage}. Maintain legal terminology accuracy and document structure.`,
      user: "Please translate this document:",
    },
  };

  return prompts[mode] || prompts.TRANSLATE;
}
