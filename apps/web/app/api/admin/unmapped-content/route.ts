import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { isAdminSession } from "@/lib/admin";

function findReportPath() {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "content", "reports", "gde_download_report.json"),
    path.join(cwd, "..", "content", "reports", "gde_download_report.json"),
    path.join(cwd, "..", "..", "content", "reports", "gde_download_report.json"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

function findPdfRoot() {
  const override = process.env.LESSON_PDF_ROOT;
  if (override) return override;
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "content", "pdf"),
    path.join(cwd, "..", "content", "pdf"),
    path.join(cwd, "..", "..", "content", "pdf"),
    path.join(cwd, "packages", "shared", "content", "pdfs"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

async function isAdmin(request: NextRequest) {
  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:4000";
  const sessionUrl = `${apiBase}/auth/session`;
  try {
    const response = await fetch(sessionUrl, {
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
      cache: "no-store",
    });
    if (!response.ok) return false;
    const data = await response.json();
    return isAdminSession(data);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const admin = await isAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const reportPath = findReportPath();
  if (!existsSync(reportPath)) {
    return NextResponse.json({
      downloaded_count: 0,
      failed_links: [],
      unmapped_files: [],
      normalized_files: [],
      reportPath,
      pdfRoot: findPdfRoot(),
    });
  }

  try {
    const raw = readFileSync(reportPath, "utf-8");
    const parsed = JSON.parse(raw);
    return NextResponse.json({
      ...parsed,
      reportPath,
      pdfRoot: findPdfRoot(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to read report",
        reportPath,
        pdfRoot: findPdfRoot(),
      },
      { status: 500 }
    );
  }
}

