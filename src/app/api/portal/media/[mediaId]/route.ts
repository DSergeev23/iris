import { PublicationStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getS3ReadUrl } from "@/lib/s3";

const mediaIdSchema = z.string().uuid();

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ mediaId: string }> }) {
  const parsed = mediaIdSchema.safeParse((await params).mediaId);
  if (!parsed.success) return NextResponse.json({ error: "Материал недоступен." }, { status: 404 });

  try {
    const media = await db.mediaItem.findFirst({
      where: { id: parsed.data, status: PublicationStatus.PUBLISHED, department: { status: PublicationStatus.PUBLISHED } },
      select: { storageObjectKey: true },
    });
    if (!media) return NextResponse.json({ error: "Материал недоступен." }, { status: 404 });

    const url = await getS3ReadUrl(media.storageObjectKey);
    return NextResponse.redirect(url, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch {
    return NextResponse.json({ error: "Не удалось загрузить материал. Попробуйте ещё раз." }, { status: 503 });
  }
}
