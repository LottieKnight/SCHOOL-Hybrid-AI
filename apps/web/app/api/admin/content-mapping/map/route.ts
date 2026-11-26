import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import fsSync from "node:fs";
import path from "node:path";
import { loadCourseOutline } from "@saedu/shared";
import { isAdminSession } from "@/lib/admin";
import { isSameOrigin } from "@/lib/csrf";

const RESOURCE_BASE: Record<string, string> = {
  lesson: "lesson",
  worksheet: "worksheet",
  assessment: "assessment",
  memo: "memo",
  resources: "resources",
  slides: "slides",
  teacher_notes: "teacher-notes",
  other: "resources",
};

const VALID_PHASES = new Set(["foundation", "intermediate", "senior", "fet"]);
const VALID_RESOURCE_TYPES = new Set(Object.keys(RESOURCE_BASE));

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

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function normalizePath(value: string) {
  return value.replace(/\\/g, "/");
}

function subjectExists(phase: string, grade: number, subject: string) {
  const outline = loadCourseOutline();
  const gradeKey = grade === 0 ? "R" : String(grade);
  const gradeNode = outline.phases[phase]?.grades?.[gradeKey];
  if (!gradeNode) return false;
  return Object.values(gradeNode.groups || {}).some((group: any) => {
    return Object.prototype.hasOwnProperty.call(group.subjects || {}, subject);
  });
}

function getManualMappingsPath(repoRoot: string) {
  return path.join(repoRoot, "content", "mappings", "manual_mappings.json");
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

function resolveSourcePath(repoRoot: string, sourceRelPath: string) {
  const normalized = normalizePath(sourceRelPath).replace(/^\/+/, "");
  if (normalized.includes("..")) return null;
  if (
    !normalized.startsWith("content/pdf/_incoming/") &&
    !normalized.startsWith("content/pdf/unmapped/") &&
    !normalized.startsWith("content/pdf/_incoming") &&
    !normalized.startsWith("content/pdf/unmapped")
  ) {
    return null;
  }
  return path.join(repoRoot, normalized);
}

function uniquePath(targetPath: string) {
  if (!fsSync.existsSync(targetPath)) return targetPath;
  const dir = path.dirname(targetPath);
  const ext = path.extname(targetPath);
  const base = path.basename(targetPath, ext);
  let counter = 2;
  let next = path.join(dir, `${base}-${counter}${ext}`);
  while (fsSync.existsSync(next)) {
    counter += 1;
    next = path.join(dir, `${base}-${counter}${ext}`);
  }
  return next;
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
    source_rel_path,
    phase,
    grade,
    subject,
    term,
    week,
    resource_type,
    notes,
  } = body as {
    source_rel_path?: string;
    phase?: string;
    grade?: number;
    subject?: string;
    term?: number;
    week?: number;
    resource_type?: string;
    notes?: string;
  };

  if (!source_rel_path || typeof source_rel_path !== "string") {
    return NextResponse.json({ error: "Missing source_rel_path" }, { status: 400 });
  }
  if (!phase || !VALID_PHASES.has(phase)) {
    return NextResponse.json({ error: "Invalid phase" }, { status: 400 });
  }
  const gradeValue = Number(grade);
  if (!Number.isFinite(gradeValue) || gradeValue < 1 || gradeValue > 12) {
    return NextResponse.json({ error: "Invalid grade" }, { status: 400 });
  }
  if (!subject || typeof subject !== "string") {
    return NextResponse.json({ error: "Invalid subject" }, { status: 400 });
  }
  const termValue = Number(term);
  if (!Number.isFinite(termValue) || termValue < 1 || termValue > 4) {
    return NextResponse.json({ error: "Invalid term" }, { status: 400 });
  }
  const weekValue = Number(week);
  if (!Number.isFinite(weekValue) || weekValue < 1 || weekValue > 52) {
    return NextResponse.json({ error: "Invalid week" }, { status: 400 });
  }
  if (!resource_type || !VALID_RESOURCE_TYPES.has(resource_type)) {
    return NextResponse.json({ error: "Invalid resource_type" }, { status: 400 });
  }

  if (!subjectExists(phase, gradeValue, subject)) {
    return NextResponse.json({ error: "Subject not found in course outline" }, { status: 400 });
  }

  const repoRoot = findRepoRoot();
  const sourceAbsPath = resolveSourcePath(repoRoot, source_rel_path);
  if (!sourceAbsPath) {
    return NextResponse.json({ error: "Invalid source path" }, { status: 400 });
  }
  if (!fsSync.existsSync(sourceAbsPath)) {
    return NextResponse.json({ error: "Source file not found" }, { status: 404 });
  }

  const ext = path.extname(sourceAbsPath) || (resource_type === "slides" ? ".pptx" : ".pdf");
  const baseName = RESOURCE_BASE[resource_type] || "resources";

  const destDir = path.join(
    repoRoot,
    "content",
    "pdf",
    phase,
    `grade-${pad2(gradeValue)}`,
    subject,
    `term-${pad2(termValue)}`,
    `week-${pad2(weekValue)}`
  );
  await fs.mkdir(destDir, { recursive: true });
  const targetPath = uniquePath(path.join(destDir, `${baseName}${ext}`));

  try {
    await fs.rename(sourceAbsPath, targetPath);
  } catch {
    await fs.copyFile(sourceAbsPath, targetPath);
    await fs.unlink(sourceAbsPath);
  }

  const mappingsPath = getManualMappingsPath(repoRoot);
  const mappingStore = await readJsonSafe(mappingsPath, { updated_at: new Date().toISOString(), mappings: [] });
  const mappedAt = new Date().toISOString();
  const normalizedSourceRel = normalizePath(source_rel_path);

  const mappingEntry = {
    source_rel_path: normalizedSourceRel,
    phase,
    grade: gradeValue,
    subject,
    term: termValue,
    week: weekValue,
    resource_type,
    notes: notes || "",
    mapped_at: mappedAt,
  };

  const existingIndex = (mappingStore.mappings || []).findIndex(
    (entry: any) => normalizePath(entry.source_rel_path) === normalizedSourceRel
  );
  if (existingIndex >= 0) {
    mappingStore.mappings[existingIndex] = { ...mappingStore.mappings[existingIndex], ...mappingEntry };
  } else {
    mappingStore.mappings.push(mappingEntry);
  }
  mappingStore.updated_at = mappedAt;
  await writeJsonAtomic(mappingsPath, mappingStore);

  const reportPath = path.join(repoRoot, "content", "reports", "gde_download_report.json");
  if (fsSync.existsSync(reportPath)) {
    const report = await readJsonSafe(reportPath, null);
    if (report?.unmapped_files?.length) {
      const sourceNormalized = normalizePath(sourceAbsPath);
      report.unmapped_files = report.unmapped_files.filter((entry: any) => {
        const entryPath = normalizePath(entry.path || "");
        return entryPath !== sourceNormalized;
      });
      await writeJsonAtomic(reportPath, report);
    }
  }

  return NextResponse.json({
    ok: true,
    source_rel_path: normalizedSourceRel,
    destination_path: normalizePath(path.relative(repoRoot, targetPath)),
    mapping: mappingEntry,
  });
}

