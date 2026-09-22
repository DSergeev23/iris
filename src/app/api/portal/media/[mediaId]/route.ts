import { GetObjectCommand } from "@aws-sdk/client-s3";
import { PublicationStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getS3Client } from "@/lib/s3";
import { getServerConfig } from "@/lib/config";

const mediaIdSchema = z.string().uuid();

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ mediaId: string }> }) {
  const parsed = mediaIdSchema.safeParse((await params).mediaId);
  if (!parsed.success) return NextResponse.json({ error: "Материал недоступен." }, { status: 404 });

  try {
    const media = await db.mediaItem.findFirst({
      where: { id: parsed.data, status: PublicationStatus.PUBLISHED, department: { status: PublicationStatus.PUBLISHED } },
      select: { storageObjectKey: true, mimeType: true },
    });
    if (!media) return NextResponse.json({ error: "Материал недоступен." }, { status: 404 });

    const range = request.headers.get("range") ?? undefined;
    const object = await getS3Client().send(new GetObjectCommand({
      Bucket: getServerConfig().S3_BUCKET,
      Key: media.storageObjectKey,
      Range: range,
    }));
    if (!object.Body) throw new Error("S3 returned an empty response.");

    const headers = new Headers({
      "Accept-Ranges": object.AcceptRanges ?? "bytes",
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": media.mimeType,
    });
    if (object.ContentLength !== undefined) headers.set("Content-Length", String(object.ContentLength));
    if (object.ContentRange) headers.set("Content-Range", object.ContentRange);
    return new Response(object.Body.transformToWebStream(), { status: object.ContentRange ? 206 : 200, headers });
  } catch {
    return NextResponse.json({ error: "Не удалось загрузить материал. Попробуйте ещё раз." }, { status: 503 });
  }
}
