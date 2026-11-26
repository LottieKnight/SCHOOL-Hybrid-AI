import { NextRequest, NextResponse } from "next/server";
import { getPastPaperWithSourceById } from "@/lib/pastPapers/catalog";
import { getStorageProvider } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function storageKeyIsPdf(key: string | null, fallbackUrl: string | null) {
  if (key) return key.toLowerCase().endsWith(".pdf");
  if (fallbackUrl) return fallbackUrl.split("?")[0].toLowerCase().endsWith(".pdf");
  return false;
}

async function safeGetSignedUrl(key: string | null, fallback: string | null = null) {
  if (!key) return fallback;
  try {
    const url = await getStorageProvider().getSignedUrl(key);
    if (url.startsWith("/past-papers/")) return fallback ?? url;
    return url;
  } catch {
    return fallback;
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const paper = await getPastPaperWithSourceById(id);
  if (!paper) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [paperUrl, memoUrl] = await Promise.all([
    safeGetSignedUrl(paper.paperStorageKey, paper.paperUrlOriginal ?? null),
    safeGetSignedUrl(paper.memoStorageKey, paper.memoUrlOriginal ?? null),
  ]);

  return NextResponse.json({
    id: paper.id,
    title: paper.title,
    subject: paper.subject,
    grade: paper.grade,
    year: paper.year,
    session: paper.session,
    paperNumber: paper.paperNumber,
    language: paper.language,
    totalMarks: paper.totalMarks,
    durationMinutes: paper.durationMinutes,
    hasMemo: Boolean(paper.memoStorageKey),
    paperUrl: paperUrl && storageKeyIsPdf(paper.paperStorageKey, paper.paperUrlOriginal) ? paperUrl : null,
    memoUrl: memoUrl && storageKeyIsPdf(paper.memoStorageKey, paper.memoUrlOriginal) ? memoUrl : null,
  });
}
