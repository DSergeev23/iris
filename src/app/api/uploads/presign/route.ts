import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerConfig } from "@/lib/config";
import { requireAdminApi } from "@/features/auth/server/session";
import { requireDepartmentWrite } from "@/features/admin/server/permissions";
import { AppError, ValidationError } from "@/lib/errors";
import { db } from "@/lib/db";
import { consumeUploadPresignAttempt } from "@/lib/rate-limit";
import { getS3Client } from "@/lib/s3";

const MAX_UPLOAD_BYTES_BY_TYPE = {
  "image/jpeg": 10 * 1024 * 1024,
  "image/png": 10 * 1024 * 1024,
  "image/webp": 10 * 1024 * 1024,
  "video/mp4": 500 * 1024 * 1024,
  "application/pdf": 30 * 1024 * 1024,
} as const;

const uploadSchema = z.object({
  departmentId: z.string().uuid(),
  filename: z.string().trim().min(1).max(180),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4", "application/pdf"]),
  fileSizeBytes: z.coerce.number().int().positive(),
});

function extensionFor(contentType: string) {
  return { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "application/pdf": "pdf" }[contentType] ?? "bin";
}

function jsonError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: "Не удалось подготовить загрузку." }, { status: 500 });
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminApi();
    if (!consumeUploadPresignAttempt(admin.id)) {
      return NextResponse.json({ error: "Слишком много запросов на загрузку. Повторите позже." }, { status: 429 });
    }

    const parsed = uploadSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Некорректные параметры файла." }, { status: 422 });

    const { departmentId, contentType, fileSizeBytes, filename } = parsed.data;
    const maxBytes = MAX_UPLOAD_BYTES_BY_TYPE[contentType];
    if (fileSizeBytes > maxBytes) {
      throw new ValidationError("Файл слишком большой для выбранного типа.");
    }
    await requireDepartmentWrite(admin, departmentId);

    const category = contentType.startsWith("video/") ? "videos" : contentType.startsWith("image/") ? "images" : "documents";
    const objectKey = `departments/${departmentId}/${category}/${randomUUID()}.${extensionFor(contentType)}`;
    const config = getServerConfig();
    const uploadUrl = await getSignedUrl(getS3Client(), new PutObjectCommand({ Bucket: config.S3_BUCKET, Key: objectKey, ContentType: contentType, ContentLength: fileSizeBytes }), { expiresIn: 300 });
    await db.auditLog.create({
      data: {
        adminUserId: admin.id,
        entityType: "media_upload",
        action: "presign",
        payload: { departmentId, filename, contentType, fileSizeBytes, objectKey },
      },
    });
    return NextResponse.json({ uploadUrl, objectKey, expiresInSeconds: 300, maxUploadBytes: maxBytes });
  } catch (error) {
    return jsonError(error);
  }
}

export function GET() {
  return NextResponse.json({ error: "Используйте POST для подготовки загрузки." }, { status: 405, headers: { Allow: "POST" } });
}
