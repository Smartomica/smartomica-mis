import { startActiveObservation } from "@langfuse/tracing";
import { getOpenAI, getLangfuseSDK } from "~/lib/langfuse.server";
import { uploadFile } from "~/lib/storage/minio.server";
import type { TranslationJob, Language } from "~/types/document";
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
}): Promise<TranslationJob> {
  const jobId = randomUUID();
  const sessionId = `doc-${jobId}`;

  // Upload files to Minio first
  const uploadedFiles = await Promise.all(
    files.map(async (file, index) => {
      const objectName = `${userId}/${jobId}/${index}-${file.name}`;
      const url = await uploadFile(objectName, file.data, file.size, {
        "Content-Type": file.type,
        "Original-Name": file.name,
      });

      return {
        id: randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        url,
        uploadedAt: new Date().toISOString(),
      };
    }),
  );

  // Create job record
  const job: TranslationJob = {
    id: jobId,
    userId,
    files: uploadedFiles,
    sourceLanguage,
    targetLanguage,
    mode,
    status: "processing",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    progress: 0,
  };

  // Process in background
  processDocumentAsync(job).catch(console.error);

  return job;
}

async function processDocumentAsync(job: TranslationJob): Promise<void> {
  try {
    const result = await startActiveObservation(
      `document-${job.mode}`,
      async (span) => {
        span.updateTrace({ sessionId: `doc-${job.id}`, tags: [job.mode] });
        span.update({
          input: {
            files: job.files.map((f) => ({
              name: f.name,
              size: f.size,
              type: f.type,
            })),
            sourceLanguage: job.sourceLanguage,
            targetLanguage: job.targetLanguage,
            mode: job.mode,
          },
        });

        const langfuse = getLangfuseSDK();
        let promptName: string;
        let content: string;

        // Get appropriate prompt based on mode
        switch (job.mode) {
          case "translate":
            promptName = "Mis-medical-translate-Chat";
            break;
          case "summarize":
            promptName = "Mis-medical-summarize-Chat";
            break;
          case "ocr":
            promptName = "Mis-medical-ocr";
            break;
          default:
            throw new Error(`Unknown processing mode: ${job.mode}`);
        }

        // Try to get prompt from Langfuse, fallback to default
        let prompt;
        try {
          prompt = await langfuse.prompt.get(promptName);
        } catch {
          // Fallback prompts if not found in Langfuse
          prompt = getDefaultPrompt(
            job.mode,
            job.sourceLanguage,
            job.targetLanguage,
          );
        }

        // For now, simulate text extraction from files
        // In production, you'd implement actual OCR/document parsing
        const extractedText = await extractTextFromFiles(job.files);

        if (job.mode === "ocr") {
          content = extractedText;
        } else {
          // Process with OpenAI
          const openai = getOpenAI({
            sessionId: `doc-${job.id}`,
            generationName: `${job.mode}-generation`,
          });

          let messages;
          if (prompt.compile) {
            // Langfuse prompt
            messages = prompt.compile({
              sourceLanguage: job.sourceLanguage,
              targetLanguage: job.targetLanguage,
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

        // Upload result to Minio
        const resultObjectName = `${job.userId}/${job.id}/result.txt`;
        const resultUrl = await uploadFile(
          resultObjectName,
          Buffer.from(content, "utf-8"),
          Buffer.byteLength(content, "utf-8"),
          { "Content-Type": "text/plain" },
        );

        span.update({
          output: {
            result: content.slice(0, 500) + (content.length > 500 ? "..." : ""),
            resultUrl,
          },
        });

        return { content, resultUrl };
      },
    );

    // Update job status - in production, you'd save to database
    job.status = "completed";
    job.result = result.content;
    job.resultUrl = result.resultUrl;
    job.progress = 100;
    job.updatedAt = new Date().toISOString();
  } catch (error) {
    console.error("Document processing failed:", error);
    job.status = "failed";
    job.error = error instanceof Error ? error.message : "Unknown error";
    job.updatedAt = new Date().toISOString();
  }
}

async function extractTextFromFiles(
  files: Array<{ name: string; type: string; url: string }>,
): Promise<string> {
  // Simplified text extraction - in production you'd implement proper OCR
  // For now, just return a placeholder based on file names
  const fileList = files.map((f) => f.name).join(", ");
  return `[Extracted text from files: ${fileList}]\n\nThis is placeholder text that would be extracted from the actual document files using OCR technology. In production, this would be replaced with actual text extraction from PDFs, images, and other document formats.`;
}

function getDefaultPrompt(
  mode: string,
  sourceLanguage: string,
  targetLanguage: string,
) {
  const prompts = {
    translate: {
      system: `You are a professional medical translator. Translate the following medical document from ${sourceLanguage} to ${targetLanguage}. Maintain medical terminology accuracy and document structure.`,
      user: "Please translate this medical document:",
    },
    summarize: {
      system: `You are a medical document analyst. Create a concise summary of the medical document, highlighting key medical findings, diagnoses, and recommendations.`,
      user: "Please summarize this medical document:",
    },
    ocr: {
      system:
        "You are an OCR system. Extract and clean up text from the document, maintaining structure and correcting any OCR errors.",
      user: "Please extract clean text from this document:",
    },
  };

  return prompts[mode as keyof typeof prompts] || prompts.translate;
}
