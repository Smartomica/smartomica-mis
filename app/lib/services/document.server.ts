import { parse } from "path";
import type { DocumentModel } from "~/generated/client/models";
import { getFileUrl } from "~/lib/storage/minio.server";
import type { LLMResult } from "./document-processor.server/clearMarkdown";
import { prisma } from "../db/client";

export async function getOriginalDocumentPreviewUrl(document: DocumentModel) {
  const ext = parse(document.filePath).ext.toLowerCase();
  const isBrokenPreview = ext.includes("doc");
  if (isBrokenPreview) return null;

  return await getFileUrl(document.filePath);
}

export async function saveDocumentOcrMeta(
  document: DocumentModel,
  ocr: LLMResult,
) {
  await prisma.document.update({
    where: { id: document.id },
    data: {
      sourceLanguage: ocr.lng || document.sourceLanguage,
      errorMessage: ocr.error || document.errorMessage,
      ocrComment: ocr.comment,
    },
  });
}
