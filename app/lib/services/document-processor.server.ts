import { startActiveObservation } from "@langfuse/tracing";
import { getOpenAI, getLangfuseSDK } from "~/lib/langfuse.server";
import { uploadFile } from "~/lib/storage/minio.server";
import type { TranslationJob } from "~/types/document";
import { prisma } from "~/lib/db/client";
import type { Document, ProcessingMode, DocumentStatus } from "~/lib/db/client";
import { randomUUID } from "crypto";

export async function processDocument({
  files,
  sourceLanguage,
  targetLanguage,
  mode,
  userId,
}: {
  files: Array<{ name: string; data: Buffer; type: string; size: number }>;
  sourceLanguage: string;
  targetLanguage: string;
  mode: "translate" | "summarize" | "ocr";
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

    // Create document records in database
    const documents = await Promise.all(
      files.map(async (file) => {
        const documentId = randomUUID();
        const objectName = `${userId}/${documentId}/${file.name}`;
        
        // Upload file to Minio
        const url = await uploadFile(objectName, file.data, file.size, {
          "Content-Type": file.type,
          "Original-Name": file.name,
        });

        // Create document record
        const document = await prisma.document.create({
          data: {
            id: documentId,
            filename: objectName,
            originalName: file.name,
            mimeType: file.type,
            fileSize: file.size,
            status: "PENDING" as DocumentStatus,
            mode: mapModeToDatabase(mode),
            sourceLanguage,
            targetLanguage: mode === "ocr" ? null : targetLanguage,
            filePath: objectName,
            userId,
          },
        });

        return document;
      })
    );

    // Start processing each document
    for (const document of documents) {
      processDocumentAsync(document.id).catch(console.error);
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

    const result = await startActiveObservation(
      `document-${document.mode}`,
      async (span) => {
        span.updateTrace({ sessionId: `doc-${documentId}`, tags: [document.mode] });
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
          case "TRANSLATE_ONLY":
            promptName = "Mis-medical-translate-Chat";
            break;
          case "OCR_AND_TRANSLATE":
            promptName = "Mis-medical-summarize-Chat";
            break;
          case "OCR_ONLY":
            promptName = "Mis-medical-ocr";
            break;
          default:
            throw new Error(`Unknown processing mode: ${document.mode}`);
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

        if (document.mode === "OCR_ONLY") {
          content = extractedText;
        } else {
          // Process with OpenAI
          const openai = getOpenAI({
            sessionId: `doc-${documentId}`,
            generationName: `${document.mode}-generation`,
          });

          let messages;
          if (prompt.compile) {
            // Langfuse prompt
            messages = prompt.compile({
              sourceLanguage: document.sourceLanguage,
              targetLanguage: document.targetLanguage,
              document: extractedText,
            }) as Array<{ role: string; content: string }>;
          } else {
            // Fallback prompt
            messages = [
              { role: "system", content: prompt.system },
              {
                role: "user",
                content: `${prompt.user}\n\nDocument:\n${extractedText}`,
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
            extractedText: document.mode !== "TRANSLATE_ONLY" ? extractedText : null,
            translatedText: document.mode !== "OCR_ONLY" ? content : null,
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
      },
    );

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
  // Simplified text extraction - in production you'd implement proper OCR
  // For now, just return a placeholder based on the document
  return `[Extracted text from file: ${document.originalName}]\n\nThis is placeholder text that would be extracted from the actual document file using OCR technology. In production, this would be replaced with actual text extraction from PDFs, images, and other document formats. The file is ${document.fileSize} bytes and has MIME type ${document.mimeType}.`;
}

function mapModeToDatabase(mode: "translate" | "summarize" | "ocr"): ProcessingMode {
  switch (mode) {
    case "translate":
      return "TRANSLATE_ONLY";
    case "summarize":
      return "OCR_AND_TRANSLATE";
    case "ocr":
      return "OCR_ONLY";
    default:
      return "OCR_ONLY";
  }
}

function mapModeToJobType(mode: ProcessingMode) {
  switch (mode) {
    case "TRANSLATE_ONLY":
      return "TRANSLATION";
    case "OCR_AND_TRANSLATE":
      return "TRANSLATION"; // Primary operation
    case "OCR_ONLY":
      return "TEXT_EXTRACTION";
    default:
      return "TEXT_EXTRACTION";
  }
}

function estimateTokensNeeded(files: Array<{ size: number }>, mode: string): number {
  // Simple estimation: 1 token per 4 characters, with overhead for processing
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const baseTokens = Math.ceil(totalSize / 4);
  
  // Add overhead based on mode
  const overhead = mode === "ocr" ? 1.2 : 2.0; // Translation needs more tokens
  return Math.ceil(baseTokens * overhead);
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
  const prompts = {
    TRANSLATE_ONLY: {
      system: `You are a professional medical translator. Translate the following medical document from ${sourceLanguage} to ${targetLanguage}. Maintain medical terminology accuracy and document structure.`,
      user: "Please translate this medical document:",
    },
    OCR_AND_TRANSLATE: {
      system: `You are a medical document analyst. Create a concise summary of the medical document, highlighting key medical findings, diagnoses, and recommendations.`,
      user: "Please summarize this medical document:",
    },
    OCR_ONLY: {
      system:
        "You are an OCR system. Extract and clean up text from the document, maintaining structure and correcting any OCR errors.",
      user: "Please extract clean text from this document:",
    },
  };

  return prompts[mode] || prompts.TRANSLATE_ONLY;
}
