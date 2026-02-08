import { requireUser } from "~/lib/auth/session.server";
import { processDocument } from "~/lib/services/document-processor.server";
import { ProcessingMode } from "~/generated/client/enums";
import { prisma } from "~/lib/db/client";

export async function action({ request }: { request: Request }) {
  const user = await requireUser(request);
  const formData = await request.formData();

  const documentId = formData.get("documentId") as string;
  const targetLanguage = formData.get("targetLanguage") as string;
  const mode = formData.get("mode") as ProcessingMode;

  if (!documentId || !targetLanguage || !mode) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    // Get the document to ensure it exists and belongs to the user
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId: user.id,
        status: "COMPLETED",
      },
    });

    if (!document) {
      return Response.json(
        { error: "Document not found or not completed" },
        { status: 404 },
      );
    }

    // Create a new processing job for translation
    const files = [
      {
        objectName: document.filePath,
        name: document.originalName,
        mimeType: document.mimeType,
        size: document.fileSize,
      },
    ];

    const result = await processDocument({
      files,
      sourceLanguage: document.sourceLanguage,
      targetLanguage,
      mode,
      userId: user.id,
    });

    if (!result.success) {
      return Response.json(
        { error: result.error || "Translation failed" },
        { status: 500 },
      );
    }

    return Response.json({
      success: true,
      documentId: result.documentId,
      message: "Translation started successfully",
    });
  } catch (error) {
    console.error("Translation error:", error);
    return Response.json(
      { error: "Failed to start translation" },
      { status: 500 },
    );
  }
}
