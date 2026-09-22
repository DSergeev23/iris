import { S3Client } from "@aws-sdk/client-s3";
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
