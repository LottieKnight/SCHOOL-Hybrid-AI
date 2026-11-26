import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/pastPapers/db";
import { getUserContextFromRequest } from "@/lib/pastPapers/auth";

export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await getUserContextFromRequest();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: pastPaperId } = await params;

  const existing = await db.findFirst("PastPaperBookmark", {
    where: { userId, pastPaperId },
    select: ["id"],
  });

  if (existing) {
    await db.delete("PastPaperBookmark", { userId, pastPaperId });
    return NextResponse.json({ bookmarked: false });
  }

  await db.create("PastPaperBookmark", { userId, pastPaperId });
  return NextResponse.json({ bookmarked: true });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await getUserContextFromRequest();
  if (!userId) return NextResponse.json({ bookmarked: false });

  const { id: pastPaperId } = await params;
  const existing = await db.findFirst("PastPaperBookmark", {
    where: { userId, pastPaperId },
    select: ["id"],
  });

  return NextResponse.json({ bookmarked: Boolean(existing) });
}
