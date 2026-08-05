import "server-only";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export function createS3ClientConfig() {
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;

  return {
    ...(process.env.S3_REGION ? { region: process.env.S3_REGION } : {}),
    ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
    ...(process.env.S3_ENDPOINT && !process.env.S3_REGION
      ? { region: "auto" }
      : {}),
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
  };
}

const s3Client = new S3Client(createS3ClientConfig());

function generateUniqueFilename(originalFilename: string): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = originalFilename.split(".").pop();
  const nameWithoutExt = originalFilename.replace(/\.[^/.]+$/, "");
  const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9-_]/g, "_");

  return `${sanitizedName}_${timestamp}_${randomString}.${extension}`;
}

/**
 * Uploads a file to S3/R2 and returns the public URL.
 * Env: S3_BUCKET_NAME, S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY,
 *      S3_PUBLIC_URL (preferred) or S3_ENDPOINT for the public base.
 *
 * For AWS execution-role auth, leave S3_ACCESS_KEY and S3_SECRET_KEY unset so
 * the SDK can use its default credential provider chain.
 */
export async function uploadImageToS3(
  file: Buffer,
  filename: string,
  contentType: string,
  keyPrefix: string,
): Promise<string> {
  const bucketName = process.env.S3_BUCKET_NAME;

  if (!bucketName) {
    throw new Error("S3_BUCKET_NAME is not configured");
  }

  const uniqueFilename = generateUniqueFilename(filename);
  const key = `${keyPrefix}/${uniqueFilename}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: file,
      ContentType: contentType,
    }),
  );

  const publicBase = (
    process.env.S3_PUBLIC_URL ||
    process.env.S3_ENDPOINT ||
    ""
  ).replace(/\/$/, "");

  return `${publicBase}/${key}`;
}
