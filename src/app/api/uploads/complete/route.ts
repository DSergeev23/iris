import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { MediaKind, PublicationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireDepartmentWrite } from "@/features/admin/server/permissions";
import { requireAdminApi } from "@/features/auth/server/session";
import { getServerConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { AppError, ValidationError } from "@/lib/errors";
import { getS3Client } from "@/lib/s3";

const completeSchema = z.object({
  departmentId: z.string().uuid(),
  objectKey: z.string().min(20).max(500),
  filename: z.string().trim().min(1).max(180),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4", "application/pdf"]),
  fileSizeBytes: z.coerce.number().int().positive(),
  purpose: z.enum(["HEAD_PHOTO", "MEDIA"]),
  title: z.string().trim().max(180).optional(),
  description: z.string().trim().max(2000).optional(),
});

function mediaKind(contentType: string) {
  if (contentType === "video/mp4") return MediaKind.VIDEO;
  if (contentType === "application/pdf") return MediaKind.DOCUMENT;
  return MediaKind.IMAGE;
}

function jsonError(error: unknown) {
  if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
  return NextResponse.json({ error: "Не удалось завершить загрузку." }, { status: 500 });
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminApi();
    const parsed = completeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ValidationError("Некорректные данные загруженного файла.");

    const data = parsed.data;
    await requireDepartmentWrite(admin, data.departmentId);
    const expectedPrefix = `departments/${data.departmentId}/`;
    if (!data.objectKey.startsWith(expectedPrefix) || data.objectKey.includes("..")) throw new ValidationError("Некорректный путь файла.");
    if (data.purpose === "HEAD_PHOTO" && !data.contentType.startsWith("image/")) throw new ValidationError("Для фотографии выберите JPG, PNG или WebP.");
    if (data.purpose === "MEDIA" && !data.title) throw new ValidationError("Укажите название материала.");

    const config = getServerConfig();
    const object = await getS3Client().send(new HeadObjectCommand({ Bucket: config.S3_BUCKET, Key: data.objectKey }));
    if (object.ContentLength !== data.fileSizeBytes || object.ContentType !== data.contentType) {
      throw new ValidationError("Параметры файла в хранилище не совпадают с загрузкой.");
    }

    if (data.purpose === "HEAD_PHOTO") {
      await db.departmentHead.upsert({
        where: { departmentId: data.departmentId },
        create: { departmentId: data.departmentId, firstName: "", lastName: "", photoObjectKey: data.objectKey, photoAlt: data.title || "Фотография заведующего отделением" },
        update: { photoObjectKey: data.objectKey, photoAlt: data.title || "Фотография заведующего отделением" },
      });
    } else {
      const maxOrder = await db.mediaItem.aggregate({ where: { departmentId: data.departmentId }, _max: { sortOrder: true } });
      await db.mediaItem.create({
        data: {
          departmentId: data.departmentId,
          kind: mediaKind(data.contentType),
          title: data.title!,
          description: data.description || "",
          status: PublicationStatus.DRAFT,
          storageObjectKey: data.objectKey,
          originalFilename: data.filename,
          mimeType: data.contentType,
          fileSizeBytes: BigInt(data.fileSizeBytes),
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        },
      });
    }

    await db.auditLog.create({ data: { adminUserId: admin.id, entityType: data.purpose === "HEAD_PHOTO" ? "department_head" : "media_item", action: "upload_complete", payload: { departmentId: data.departmentId, objectKey: data.objectKey, contentType: data.contentType } } });
    revalidatePath("/admin");
    revalidatePath("/portal");
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return jsonError(error);
  }
}

export function GET() {
  return NextResponse.json({ error: "Используйте POST для завершения загрузки." }, { status: 405, headers: { Allow: "POST" } });
}
