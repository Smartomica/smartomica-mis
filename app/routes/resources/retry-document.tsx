import type { Route } from "./+types/retry-document";
import { requireUser } from "~/lib/auth/session.server";
import { prisma } from "~/lib/db/client";
import { processDocumentAsync } from "~/lib/services/document-processor.server";

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const documentId = formData.get("documentId");

  if (!documentId || typeof documentId !== "string") {
    return { error: "Invalid document ID" };
  }

  // Verify ownership
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document || document.userId !== user.id) {
    return { error: "Document not found" };
  }

  // Trigger retry in background
  processDocumentAsync(documentId).catch((error) =>
    console.error("Retry failed:", error),
  );

  return { success: true };
}
