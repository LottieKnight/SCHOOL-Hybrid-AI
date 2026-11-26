import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import fsSync from "node:fs";
import path from "node:path";
import { loadCourseOutline } from "@saedu/shared";
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

function pad2(value: number) {
  return String(value).padStart(2, "0");
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
  return Array.from(keys).sort();
}

export async function GET(request: NextRequest) {
  const admin = await isAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repoRoot = findRepoRoot();
  const outlinePath = path.join(repoRoot, "content", "generated_course_outline.json");
  if (!fsSync.existsSync(outlinePath)) {
    return NextResponse.json({ error: "generated_course_outline.json not found" }, { status: 404 });
  }

  const raw = await fs.readFile(outlinePath, "utf-8");
  const outline = JSON.parse(raw) as any;
  const items: any[] = [];

  for (const [phaseKey, phase] of Object.entries(outline.phases || {})) {
    for (const [gradeKey, grade] of Object.entries((phase as any).grades || {})) {
      for (const entry of (grade as any).unclassified_subjects || []) {
        let weekCount = 0;
        let resourcesOnlyCount = 0;
        const samplePaths: string[] = [];
        for (const [termKey, term] of Object.entries(entry.terms || {})) {
          for (const [weekKey, week] of Object.entries((term as any).weeks || {})) {
            weekCount += 1;
            if ((week as any).resourcesOnly) resourcesOnlyCount += 1;
            if (samplePaths.length < 3) {
              samplePaths.push(
                `content/pdf/${phaseKey}/grade-${gradeKey}/${entry.sourceKey}/term-${pad2(Number(termKey))}/week-${pad2(
                  Number(weekKey)
                )}/`
              );
            }
          }
        }
        items.push({
          phase: phaseKey,
          grade: gradeKey,
          source_subject_key: entry.sourceKey,
          reason: entry.reason,
          week_count: weekCount,
          resources_only_count: resourcesOnlyCount,
          sample_paths: samplePaths,
        });
      }
    }
  }

  const subjectKeys = collectSubjectKeys();
  return NextResponse.json({ items, subject_keys: subjectKeys });
}

