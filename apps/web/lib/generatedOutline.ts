import fs from "node:fs";
import path from "node:path";
import type { GeneratedOutline, GeneratedOutlineSubject } from "@saedu/shared";

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

export function loadGeneratedOutline(): GeneratedOutline | null {
  const repoRoot = findRepoRoot();
  const filePath = path.join(repoRoot, "content", "generated_course_outline.json");
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as GeneratedOutline;
  } catch {
    return null;
  }
}

export function findGeneratedSubject(
  outline: GeneratedOutline | null,
  phase: string,
  grade: string,
  subjectKey: string
) {
  if (!outline) return null;
  const gradeNode = outline.phases?.[phase]?.grades?.[grade];
  if (!gradeNode) return null;
  if (gradeNode.subjects?.[subjectKey]) {
    return { subjectKey, subject: gradeNode.subjects[subjectKey] as GeneratedOutlineSubject };
  }
  const entry = Object.entries(gradeNode.subjects || {}).find(
    ([, subject]) => subject.sourceKey === subjectKey
  );
  if (entry) {
    return { subjectKey: entry[0], subject: entry[1] as GeneratedOutlineSubject };
  }
  return null;
}

export function findUnclassifiedSubject(
  outline: GeneratedOutline | null,
  phase: string,
  grade: string,
  subjectKey: string
) {
  if (!outline) return null;
  const gradeNode = outline.phases?.[phase]?.grades?.[grade];
  if (!gradeNode) return null;
  const entry = gradeNode.unclassified_subjects?.find((item) => item.sourceKey === subjectKey);
  if (!entry) return null;
  return entry;
}
