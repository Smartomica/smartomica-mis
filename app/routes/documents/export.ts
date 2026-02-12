import type { Route } from "./+types/export";
import { requireUser } from "~/lib/auth/session.server";
import { prisma } from "~/lib/db/client";
import { generateDocx } from "~/lib/services/document-generator.server";
import { downloadFile, uploadFile } from "~/lib/storage/minio.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const { documentId } = params;

  if (!documentId) {
    throw new Response("Document ID required", { status: 400 });
  }

  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document || document.userId !== user.id) {
    throw new Response("Not Found", { status: 404 });
  }

  if (!document.translatedText) {
    throw new Response("Document has no translated text", { status: 400 });
  }

  const exportPath = `exports/${document.id}/translated.docx`;

  // Safe filename encoding for Content-Disposition (RFC 5987) to support non-ASCII characters
  const filename = document.originalName.replace(/\.[^/.]+$/, "") + ".docx";
  const encodedFilename = encodeURIComponent(filename)
    .replace(/['()]/g, escape)
    .replace(/\*/g, "%2A");
  const contentDisposition = `attachment; filename*=UTF-8''${encodedFilename}`;

  try {
    // Try to get from cache first
    const fileBuffer = await downloadFile(exportPath);

    return new Response(fileBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": contentDisposition,
      },
    });
  } catch (error) {
    // File doesn't exist in cache, generate it
    try {
      const docxBuffer = await generateDocx(document.translatedText);

      // Save to cache
      await uploadFile(exportPath, docxBuffer, docxBuffer.length, {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      return new Response(docxBuffer, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": contentDisposition,
        },
      });
    } catch (genError) {
      console.error("Export generation failed:", genError);
      throw new Response("Failed to generate export", { status: 500 });
    }
  }
}
