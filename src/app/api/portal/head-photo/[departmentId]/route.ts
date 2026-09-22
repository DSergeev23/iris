import { GetObjectCommand } from "@aws-sdk/client-s3";
import { PublicationStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { logFailure } from "@/lib/logger";
import { getS3Client } from "@/lib/s3";

const departmentIdSchema = z.string().uuid();

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  const parsed = departmentIdSchema.safeParse((await params).departmentId);
  if (!parsed.success) return NextResponse.json({ error: "Фотография недоступна." }, { status: 404 });

  try {
    const head = await db.departmentHead.findFirst({
      where: { departmentId: parsed.data, department: { status: PublicationStatus.PUBLISHED } },
      select: { photoObjectKey: true },
    });
    if (!head?.photoObjectKey) return NextResponse.json({ error: "Фотография недоступна." }, { status: 404 });

    const object = await getS3Client().send(new GetObjectCommand({ Bucket: getServerConfig().S3_BUCKET, Key: head.photoObjectKey }));
    if (!object.Body) throw new Error("S3 returned an empty response.");

    const contentType = object.ContentType;
    return new Response(object.Body.transformToWebStream(), {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": contentType === "image/jpeg" || contentType === "image/png" || contentType === "image/webp" ? contentType : "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    logFailure("portal_head_photo_load_failed", error, { departmentId: parsed.data });
    return NextResponse.json({ error: "Фотография временно недоступна." }, { status: 503 });
  }
}
