import type { Route } from "./+types/presigned";
import { requireUser } from "~/lib/auth/session.server";
import { generateFormUploadData } from "~/lib/storage/minio.server";
import { z } from "zod";

const generateUrlSchema = z.object({
  fileName: z.string().min(1),
  fileSize: z.number().positive(),
  mimeType: z.string().min(1),
});

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.json();
    const { fileName, fileSize, mimeType } = generateUrlSchema.parse(body);

    // Generate unique object name
    const timestamp = Date.now();
    const objectName = `${user.id}/${timestamp}/${fileName}`;

    // Generate form upload data and download URL
    const { uploadForm, downloadUrl } = await generateFormUploadData(
      objectName,
      fileSize
    );

    return Response.json({
      success: true,
      data: {
        uploadForm: {
          url: uploadForm.url,
          fields: uploadForm.formData
        },
        downloadUrl,
        objectName,
        fileSize,
        mimeType,
      },
    });
  } catch (error) {
    console.error("Error generating presigned URLs:", error);
    
    if (error instanceof z.ZodError) {
      return Response.json(
        { 
          error: "Invalid request data",
          details: error.issues 
        },
        { status: 400 }
      );
    }

    return Response.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}