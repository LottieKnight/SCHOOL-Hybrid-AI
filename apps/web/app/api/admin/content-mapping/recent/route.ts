import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import fsSync from "node:fs";
import path from "node:path";
import { isAdminSession } from "@/lib/admin";

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

async function readJsonSafe(filePath: string, fallback: any) {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  const admin = await isAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const repoRoot = findRepoRoot();
  const mappingsPath = path.join(repoRoot, "content", "mappings", "manual_mappings.json");
  if (!fsSync.existsSync(mappingsPath)) {
    return NextResponse.json({ mappings: [] });
  }
  const store = await readJsonSafe(mappingsPath, { mappings: [] });
  const mappings = (store.mappings || [])
    .slice()
    .sort((a: any, b: any) => {
      const aTime = new Date(a.mapped_at || 0).getTime();
      const bTime = new Date(b.mapped_at || 0).getTime();
      return bTime - aTime;
    })
    .slice(0, 100);
  return NextResponse.json({ mappings });
}

