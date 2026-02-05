import type { Route } from "./+types/download";
import { requireUser } from "~/lib/auth/session.server";
import { getFileUrl } from "~/lib/storage/minio.server";
import { prisma } from "~/lib/db/client";
import { z } from "zod";

const downloadParamsSchema = z.object({
  documentId: z.string(),
});

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  
  try {
    const { documentId } = downloadParamsSchema.parse(params);

    // Get document from database
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        userId: user.id, // Ensure user can only download their own documents
        status: "COMPLETED", // Only allow downloads for completed documents
      },
    });

    if (!document) {
      throw new Response("Document not found or not accessible", { status: 404 });
    }

    // Generate presigned download URL for the result
    // For completed documents, we'll create a text file with the result
    let downloadUrl: string;
    
    if (document.translatedText || document.extractedText) {
      // Create a downloadable result file
      const resultContent = document.translatedText || document.extractedText || "";
      const fileName = `${document.originalName.replace(/\.[^/.]+$/, "")}_${document.mode.toLowerCase()}_result.txt`;
      const objectName = `${user.id}/results/${document.id}/${fileName}`;
      
      // For now, we'll use the file URL function to generate presigned URL
      // In production, you might want to upload the result as a file to Minio first
      downloadUrl = await getFileUrl(objectName, 3600); // 1 hour expiry
      
      // Create the result file content response
      const response = Response.json({
        success: true,
        data: {
          downloadUrl,
          fileName,
          fileSize: Buffer.byteLength(resultContent, 'utf8'),
          mimeType: 'text/plain',
          content: resultContent, // Include content for immediate download
        }
      });
      
      return response;
    } else {
      throw new Response("No result available for download", { status: 404 });
    }

  } catch (error) {
    console.error("Error generating download URL:", error);
    
    if (error instanceof z.ZodError) {
      throw new Response("Invalid document ID", { status: 400 });
    }
    
    if (error instanceof Response) {
      throw error;
    }

    throw new Response("Failed to generate download URL", { status: 500 });
  }
}