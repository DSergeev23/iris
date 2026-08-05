import { z } from "zod";

const serverConfigSchema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
});

export type ServerConfig = z.infer<typeof serverConfigSchema>;

export function getServerConfig(): ServerConfig {
  const parsed = serverConfigSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Missing or invalid server configuration: ${missing}`);
  }

  return parsed.data;
}

export function hasDatabaseConfig() {
  return Boolean(process.env.DATABASE_URL);
}
