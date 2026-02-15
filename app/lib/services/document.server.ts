import { parse } from "path";
import type { DocumentModel } from "~/generated/client/models";
import { getFileUrl } from "~/lib/storage/minio.server";

export async function getOriginalDocumentPreviewUrl(document: DocumentModel) {
  const ext = parse(document.filePath).ext.toLowerCase();
  const isBrokenPreview = ext.includes("doc");
  if (isBrokenPreview) return null;

  return await getFileUrl(document.filePath);
}
