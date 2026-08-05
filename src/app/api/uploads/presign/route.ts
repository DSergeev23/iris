import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerConfig } from "@/lib/config";
import { requireAdminApi } from "@/features/auth/server/session";
import { getS3Client } from "@/lib/s3";

const querySchema = z.object({
  departmentId: z.string().uuid(),
  filename: z.string().trim().min(1).max(180),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4", "application/pdf"]),
});

function extensionFor(contentType: string) {
  return { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "application/pdf": "pdf" }[contentType] ?? "bin";
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminApi();
    const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) return NextResponse.json({ error: "Некорректные параметры файла." }, { status: 422 });

    const { departmentId, contentType } = parsed.data;
    const category = contentType.startsWith("video/") ? "videos" : contentType.startsWith("image/") ? "images" : "documents";
    const objectKey = `departments/${departmentId}/${category}/${randomUUID()}.${extensionFor(contentType)}`;
    const config = getServerConfig();
    const uploadUrl = await getSignedUrl(getS3Client(), new PutObjectCommand({ Bucket: config.S3_BUCKET, Key: objectKey, ContentType: contentType }), { expiresIn: 300 });
    return NextResponse.json({ uploadUrl, objectKey, expiresInSeconds: 300 });
  } catch {
    return NextResponse.json({ error: "Не удалось подготовить загрузку." }, { status: 500 });
  }
}
