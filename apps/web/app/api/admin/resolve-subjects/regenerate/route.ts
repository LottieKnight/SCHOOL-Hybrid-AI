import { NextRequest, NextResponse } from "next/server";
import { writeGeneratedOutline } from "@saedu/shared";
import fsSync from "node:fs";
import path from "node:path";
import { isAdminSession } from "@/lib/admin";
import { isSameOrigin } from "@/lib/csrf";

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

function findRepoRoot() {
  const cwd = process.cwd();
  const candidates = [cwd, path.join(cwd, ".."), path.join(cwd, "..", "..")];
  for (const candidate of candidates) {
    if (fsSync.existsSync(path.join(candidate, "content"))) {
      return candidate;
    }
  }
  return cwd;
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const admin = await isAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const repoRoot = findRepoRoot();
  const outline = await writeGeneratedOutline(repoRoot);
  return NextResponse.json({ ok: true, stats: outline.stats });
}

