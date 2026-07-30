import "server-only";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.S3_REGION || "auto",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "",
    secretAccessKey: process.env.S3_SECRET_KEY || "",
  },
});

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
 * Env: S3_BUCKET_NAME, S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY,
 *      S3_PUBLIC_URL (preferred) or S3_ENDPOINT for the public base.
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
