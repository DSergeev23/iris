import { GetObjectCommand } from "@aws-sdk/client-s3";
import { PublicationStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getS3Client } from "@/lib/s3";
import { getServerConfig } from "@/lib/config";
import { logFailure } from "@/lib/logger";

const mediaIdSchema = z.string().uuid();

function unavailable(request: Request, status: number) {
  if (request.headers.get("accept")?.includes("text/html")) {
    return new Response("<!doctype html><html lang=\"ru\"><meta charset=\"utf-8\"><title>Материал недоступен</title><main><h1>Материал временно недоступен</h1><p>Попробуйте открыть его позже.</p><a href=\"/portal\">Вернуться в портал</a></main></html>", {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'" },
    });
  }
  return NextResponse.json({ error: "Материал временно недоступен. Попробуйте ещё раз." }, { status });
}

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ mediaId: string }> }) {
  const parsed = mediaIdSchema.safeParse((await params).mediaId);
  if (!parsed.success) return unavailable(request, 404);

  try {
    const media = await db.mediaItem.findFirst({
      where: { id: parsed.data, status: PublicationStatus.PUBLISHED, department: { status: PublicationStatus.PUBLISHED } },
      select: { storageObjectKey: true, mimeType: true },
    });
    if (!media) return unavailable(request, 404);

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
  } catch (error) {
    logFailure("portal_media_load_failed", error, { mediaId: parsed.data });
    return unavailable(request, 503);
  }
}
