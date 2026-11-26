import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type GeneratedOutlineWeek = {
  hasLessonJson: boolean;
  resourcesCount: number;
  resourcesOnly: boolean;
};

export type GeneratedOutlineSubject = {
  displayName: string;
  sourceKey: string;
  terms: Record<string, { weeks: Record<string, GeneratedOutlineWeek> }>;
};

export type UnclassifiedSubject = {
  sourceKey: string;
  reason: string;
  terms: Record<string, { weeks: Record<string, GeneratedOutlineWeek> }>;
};

export type GeneratedOutline = {
  generated_at: string;
  stats: {
    total_subjects: number;
    unclassified_subjects: number;
    total_week_nodes: number;
  };
  phases: Record<
    string,
    {
      grades: Record<
        string,
        {
          subjects: Record<string, GeneratedOutlineSubject>;
          unclassified_subjects: UnclassifiedSubject[];
        }
      >;
    }
  >;
};

function findRepoRoot() {
  const cwd = process.cwd();
  const candidates = [cwd, path.join(cwd, ".."), path.join(cwd, "..", "..")];
  let fallback = cwd;
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "content"))) {
      fallback = candidate;
      if (existsSync(path.join(candidate, "apps"))) {
        return candidate;
      }
    }
  }
  return fallback;
}

export function loadGeneratedOutline(): GeneratedOutline | null {
  const repoRoot = findRepoRoot();
  const filePath = path.join(repoRoot, "content", "generated_course_outline.json");
  if (!existsSync(filePath)) return null;
  try {
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as GeneratedOutline;
  } catch {
    return null;
  }
}
