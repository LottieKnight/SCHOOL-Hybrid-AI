import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import fsSync from "node:fs";
import path from "node:path";
import { loadCourseOutline } from "@saedu/shared";
import { writeGeneratedOutline } from "@saedu/shared";
import { isAdminSession } from "@/lib/admin";
import { isSameOrigin } from "@/lib/csrf";

const VALID_PHASES = new Set(["foundation", "intermediate", "senior", "fet", "any"]);

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

function collectSubjectKeys() {
  const outline = loadCourseOutline();
  const keys = new Set<string>();
  Object.values(outline.phases || {}).forEach((phase: any) => {
    Object.values(phase.grades || {}).forEach((grade: any) => {
      Object.values(grade.groups || {}).forEach((group: any) => {
        Object.keys(group.subjects || {}).forEach((key) => keys.add(key));
      });
    });
  });
  return Array.from(keys);
}

async function readJsonSafe(filePath: string, fallback: any) {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(filePath: string, data: any) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, filePath);
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const admin = await isAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const {
    source_subject_key,
    phase,
    resolved_subject_key,
    display_name_override,
    notes,
    confirm_any,
    confirm_merge,
    regenerate,
  } = body as {
    source_subject_key?: string;
    phase?: string;
    resolved_subject_key?: string;
    display_name_override?: string;
    notes?: string;
    confirm_any?: boolean;
    confirm_merge?: boolean;
    regenerate?: boolean;
  };

  if (!source_subject_key || typeof source_subject_key !== "string") {
    return NextResponse.json({ error: "Missing source_subject_key" }, { status: 400 });
  }
  if (!phase || !VALID_PHASES.has(phase)) {
    return NextResponse.json({ error: "Invalid phase" }, { status: 400 });
  }
  if (!resolved_subject_key || typeof resolved_subject_key !== "string") {
    return NextResponse.json({ error: "Missing resolved_subject_key" }, { status: 400 });
  }

  const subjectKeys = collectSubjectKeys();
  if (!subjectKeys.includes(resolved_subject_key)) {
    return NextResponse.json({ error: "Resolved subject key not in CAPS outline" }, { status: 400 });
  }

  if (phase === "any" && !confirm_any) {
    return NextResponse.json(
      { error: "Phase=any requires confirmation", code: "confirm_any_required" },
      { status: 409 }
    );
  }

  const repoRoot = findRepoRoot();
  const mappingPath = path.join(repoRoot, "content", "mappings", "subject_resolutions.json");
  const store = await readJsonSafe(mappingPath, { updated_at: new Date().toISOString(), rules: [] });
  const rules = store.rules || [];

  const conflicting = rules.find(
    (rule: any) =>
      rule.resolved_subject_key === resolved_subject_key &&
      rule.source_subject_key !== source_subject_key &&
      (rule.phase === "any" || rule.phase === phase || phase === "any")
  );
  if (conflicting && !confirm_merge) {
    return NextResponse.json(
      {
        error: "Resolution would merge with existing rule",
        code: "confirm_merge_required",
        conflict: conflicting,
      },
      { status: 409 }
    );
  }

  const rule = {
    source_subject_key,
    phase,
    resolved_subject_key,
    display_name_override: display_name_override || undefined,
    notes: notes || "",
  };

  const existingIndex = rules.findIndex(
    (entry: any) => entry.source_subject_key === source_subject_key && entry.phase === phase
  );
  if (existingIndex >= 0) {
    rules[existingIndex] = { ...rules[existingIndex], ...rule };
  } else {
    rules.push(rule);
  }

  store.rules = rules;
  store.updated_at = new Date().toISOString();
  await writeJsonAtomic(mappingPath, store);

  let regenerated = null;
  if (regenerate) {
    regenerated = await writeGeneratedOutline(repoRoot);
  }

  return NextResponse.json({ ok: true, rule, regenerated: regenerate ? regenerated?.stats : null });
}

