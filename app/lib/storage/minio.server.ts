import * as Minio from "minio";
import {
  MINIO_ENDPOINT,
  MINIO_ACCESS_KEY,
  MINIO_SECRET_KEY,
  MINIO_BUCKET,
} from "~/env.server";

export function getMinioClient() {
  const endpointUrl = new URL(MINIO_ENDPOINT);

  return new Minio.Client({
    endPoint: endpointUrl.hostname,
    port: endpointUrl.port
      ? parseInt(endpointUrl.port)
      : endpointUrl.protocol === "https:"
        ? 443
        : 80,
    useSSL: endpointUrl.protocol === "https:",
    accessKey: MINIO_ACCESS_KEY,
    secretKey: MINIO_SECRET_KEY,
  });
}

export async function uploadFile(
  objectName: string,
  buffer: Buffer,
  size?: number,
  metaData?: Record<string, string>,
): Promise<string> {
  const client = getMinioClient();

  try {
    await client.putObject(MINIO_BUCKET, objectName, buffer, size, metaData);

    return `${MINIO_ENDPOINT}/${MINIO_BUCKET}/${objectName}`;
  } catch (error) {
    console.error("Error uploading to Minio:", error);
    throw new Error("Failed to upload file");
  }
}

export async function downloadFile(objectName: string): Promise<Buffer> {
  const client = getMinioClient();

  try {
    const stream = await client.getObject(MINIO_BUCKET, objectName);
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
    });
  } catch (error) {
    console.error("Error downloading from Minio:", error);
    throw new Error("Failed to download file");
  }
}

export async function getFileUrl(
  objectName: string,
  expires = 24 * 60 * 60,
): Promise<string> {
  const client = getMinioClient();

  try {
    return await client.presignedGetObject(MINIO_BUCKET, objectName, expires);
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    throw new Error("Failed to generate file URL");
  }
}

export async function getUploadUrl(
  objectName: string,
  expires = 3600,
): Promise<string> {
  const client = getMinioClient();

  try {
    return await client.presignedPutObject(MINIO_BUCKET, objectName, expires);
  } catch (error) {
    console.error("Error generating presigned upload URL:", error);
    throw new Error("Failed to generate upload URL");
  }
}

export async function getUploadFormPolicy(
  objectName: string,
  maxFileSize = 10 * 1024 * 1024, // 10MB default
  expires = 3600,
): Promise<{ url: string; formData: Record<string, string> }> {
  const client = getMinioClient();

  try {
    const policy = client.newPostPolicy();

    // Set expiration time
    const expirationDate = new Date();
    expirationDate.setSeconds(expirationDate.getSeconds() + expires);
    policy.setExpires(expirationDate);

    // Set bucket and key
    policy.setBucket(MINIO_BUCKET);
    policy.setKey(objectName);

    // Set content length range (1 byte to maxFileSize)
    policy.setContentLengthRange(1, maxFileSize);

    // Generate the presigned POST policy
    const result = await client.presignedPostPolicy(policy);

    return {
      url: `${MINIO_ENDPOINT}/${MINIO_BUCKET}`,
      formData: result.formData,
    };
  } catch (error) {
    console.error("Error generating presigned form policy:", error);
    throw new Error("Failed to generate upload form policy");
  }
}

export async function generateFormUploadData(
  objectName: string,
  maxFileSize = 10 * 1024 * 1024,
  uploadExpires = 3600,
  downloadExpires = 24 * 60 * 60,
): Promise<{
  uploadForm: { url: string; formData: Record<string, string> };
  downloadUrl: string;
}> {
  const [uploadForm, downloadUrl] = await Promise.all([
    getUploadFormPolicy(objectName, maxFileSize, uploadExpires),
    getFileUrl(objectName, downloadExpires),
  ]);

  return { uploadForm, downloadUrl };
}

export async function deleteFile(objectName: string): Promise<void> {
  const client = getMinioClient();

  try {
    await client.removeObject(MINIO_BUCKET, objectName);
  } catch (error) {
    console.error("Error deleting from Minio:", error);
    throw new Error("Failed to delete file");
  }
}
