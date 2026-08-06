import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getServerConfig } from "./config";

export function getS3Client() {
  const config = getServerConfig();
  return new S3Client({
    endpoint: config.S3_ENDPOINT,
    region: config.S3_REGION,
    credentials: { accessKeyId: config.S3_ACCESS_KEY_ID, secretAccessKey: config.S3_SECRET_ACCESS_KEY },
    forcePathStyle: true,
  });
}

export async function getS3ReadUrl(objectKey: string) {
  const config = getServerConfig();
  return getSignedUrl(getS3Client(), new GetObjectCommand({ Bucket: config.S3_BUCKET, Key: objectKey }), { expiresIn: 60 * 60 });
}
