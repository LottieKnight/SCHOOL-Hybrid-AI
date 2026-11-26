import fs from "node:fs";
import path from "node:path";
import type { ContentIndex } from "@saedu/shared";
import { SCHOOL_LESSON_STORAGE_ROOT, UNIVERSITY_LESSON_STORAGE_ROOT } from "@/lib/lessonRouting";

export type ContentMode = "caps" | "available" | "generated" | "ai";
export const CONTENT_ROOT = "content";
export { SCHOOL_LESSON_STORAGE_ROOT, UNIVERSITY_LESSON_STORAGE_ROOT };

function findRepoRoot() {
  const cwd = process.cwd();
  const candidates = [cwd, path.join(cwd, ".."), path.join(cwd, "..", "..")];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "content"))) {
      return candidate;
    }
  }
  return cwd;
}

export function loadContentIndex(): ContentIndex | null {
  const repoRoot = findRepoRoot();
  const filePath = path.join(repoRoot, CONTENT_ROOT, "content_index.json");
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as ContentIndex;
  } catch {
    return null;
  }
}

export function getMode(searchParams?: { mode?: string }): ContentMode {
  if (searchParams?.mode === "caps") return "caps";
  if (searchParams?.mode === "generated") return "generated";
  if (searchParams?.mode === "ai") return "available";
  return "available";
}

export function appendMode(href: string, mode: ContentMode) {
  const param =
    mode === "caps"
      ? "mode=caps"
      : mode === "generated"
      ? "mode=generated"
      : mode === "ai"
      ? "mode=available"
      : "mode=available";
  return href.includes("?") ? `${href}&${param}` : `${href}?${param}`;
}

export const AVAILABLE_GROUP_KEY = "available-content";

export function resolveRepoContentPath(...segments: string[]) {
  return path.join(findRepoRoot(), CONTENT_ROOT, ...segments);
}

export function normalizeOutlineGradeKey(grade: string) {
  const trimmed = grade.trim().toLowerCase();
  if (trimmed === "00" || trimmed === "0" || trimmed === "r") return "R";
  return String(Number.parseInt(trimmed, 10));
}
