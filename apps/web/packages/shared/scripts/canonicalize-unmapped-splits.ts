import fs from "node:fs/promises";
import { existsSync, statSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSubjectKey } from "../src/subject-alias";

type Provenance = {
  source_pdf: string;
  extracted_week: number;
  page_range: [number, number];
};

type CanonicalizeResult = {
  provenancePath: string;
  sourcePdf: string;
  week: number;
  grade?: number;
  term?: number;
  subject?: string;
  phase?: string;
  destination?: string;
  moved: boolean;
  reason?: string;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const unmappedRoot = path.join(repoRoot, "content", "pdf", "_incoming", "unmapped_splits");
const reportJson = path.join(repoRoot, "content", "reports", "canonicalize_splits_report.json");
const reportMd = path.join(repoRoot, "content", "reports", "canonicalize_splits_report.md");

function normalizePath(value: string) {
  return value.split(path.sep).join("/");
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function tokenize(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function parseGrade(text: string) {
  const match =
    text.match(/\bgr(?:ade)?[-\s]?0?(\d{1,2})\b/i) ||
    text.match(/\bg0?(\d{1,2})\b/i) ||
    text.match(/\bgraad[-\s]?0?(\d{1,2})\b/i);
  if (!match) return null;
  const grade = Number(match[1]);
  if (!Number.isFinite(grade) || grade < 0 || grade > 12) return null;
  return grade;
}

function parseTerm(text: string) {
  const match =
    text.match(/\bterm[-\s]?0?([1-4])\b/i) ||
    text.match(/\bt0?([1-4])\b/i) ||
    text.match(/\bkwartaal[-\s]?0?([1-4])\b/i);
  if (!match) return null;
  const term = Number(match[1]);
  if (!Number.isFinite(term) || term < 1 || term > 4) return null;
  return term;
}

function derivePhase(grade: number) {
  if (grade <= 3) return "foundation";
  if (grade <= 6) return "intermediate";
  if (grade <= 9) return "senior";
  return "fet";
}

function loadOutline() {
  const outlinePath = path.join(repoRoot, "packages", "shared", "content", "course_outline.json");
  if (!existsSync(outlinePath)) return null;
  return JSON.parse(readFileSync(outlinePath, "utf-8"));
}

function getOutlineSubjectKeys(outline: any, phase: string, grade: number) {
  const gradeKey = grade === 0 ? "R" : String(grade);
  const gradeNode = outline?.phases?.[phase]?.grades?.[gradeKey];
  if (!gradeNode) return [];
  const keys = new Set<string>();
  for (const group of Object.values<any>(gradeNode.groups || {})) {
    for (const subjectKey of Object.keys((group as any).subjects || {})) {
      keys.add(subjectKey);
    }
  }
  return Array.from(keys);
}

function pickResourceFilename(sourceName: string) {
  const lower = sourceName.toLowerCase();
  if (lower.includes("lesson plan") || lower.includes("lesson")) return "lesson.pdf";
  return "resources.pdf";
}

async function listProvenanceFiles(root: string) {
  const results: string[] = [];
  if (!existsSync(root)) return results;
  const queue: string[] = [root];
  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else if (entry.isFile() && entry.name === "provenance.json") {
        results.push(fullPath);
      }
    }
  }
  return results.sort((a, b) => a.localeCompare(b));
}

function subjectFromContext(text: string, outlineKeys: string[], phase: string, grade: number) {
  const expanded = text
    .replace(/\befal\b/gi, "english fal")
    .replace(/\bafal\b/gi, "afrikaans fal")
    .replace(/\beat\b/gi, "first additional")
    .replace(/\bhuistaal\b/gi, "home language");
  const result = resolveSubjectKey({
    phase,
    grade,
    filename: expanded,
    folderHints: [],
    outlineKeys,
  });
  if (result.confidence !== "high" || !result.subjectKey) {
    return { subject: null, reason: result.reason };
  }
  return { subject: result.subjectKey, reason: "matched" };
}

function nextAvailablePath(folder: string, filename: string) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let candidate = path.join(folder, filename);
  if (!existsSync(candidate)) return candidate;
  let index = 2;
  while (existsSync(candidate)) {
    candidate = path.join(folder, `${base}-${index}${ext}`);
    index += 1;
  }
  return candidate;
}

async function moveFile(src: string, dest: string) {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
  await fs.unlink(src);
}

async function main() {
  if (!existsSync(unmappedRoot)) {
    console.log("No unmapped splits found.");
    return;
  }

  const provenanceFiles = await listProvenanceFiles(unmappedRoot);
  const outline = loadOutline();
  const results: CanonicalizeResult[] = [];
  const reasons: Record<string, number> = {};

  for (const provenancePath of provenanceFiles) {
    const folder = path.dirname(provenancePath);
    const source = JSON.parse(await fs.readFile(provenancePath, "utf-8")) as Provenance;
    const week = source.extracted_week;
    const sourcePdf = source.source_pdf;
    const contextText = `${sourcePdf} ${path.basename(folder)}`;
    const grade = parseGrade(contextText);
    const term = parseTerm(contextText);
    const missing: string[] = [];

    if (!grade) {
      reasons.missing_grade = (reasons.missing_grade || 0) + 1;
      missing.push("grade");
    }
    if (!term) {
      reasons.missing_term = (reasons.missing_term || 0) + 1;
      missing.push("term");
    }

    let phase: string | undefined;
    if (typeof grade === "number") {
      phase = derivePhase(grade);
    }

    let subject: string | null = null;
    let subjectReason = "";
    if (grade && phase) {
      const outlineKeys = outline ? getOutlineSubjectKeys(outline, phase, grade) : [];
      if (!outlineKeys.length) {
        subjectReason = "no_outline_subjects";
        reasons.missing_subject = (reasons.missing_subject || 0) + 1;
        missing.push("subject");
      } else {
        const subjectResult = subjectFromContext(contextText, outlineKeys, phase, grade);
        subject = subjectResult.subject;
        subjectReason = subjectResult.reason;
        if (!subject) {
          reasons.missing_subject = (reasons.missing_subject || 0) + 1;
          missing.push("subject");
        }
      }
    } else if (!grade || !phase) {
      reasons.missing_subject = (reasons.missing_subject || 0) + 1;
      subjectReason = "missing_grade_or_phase";
      missing.push("subject");
    }

    const splitFile = path.join(folder, `week-${pad2(week)}.source.pdf`);
    const moved: CanonicalizeResult = {
      provenancePath: normalizePath(path.relative(repoRoot, provenancePath)),
      sourcePdf,
      week,
      grade: grade || undefined,
      term: term || undefined,
      subject: subject || undefined,
      phase,
      moved: false,
    };

    if (!grade || !term || !subject || !phase) {
      moved.reason = missing.length ? `missing_${missing.join("_")}` : subjectReason || "missing_fields";
      results.push(moved);
      continue;
    }

    const destFolder = path.join(repoRoot, "content", "pdf", phase, `grade-${pad2(grade)}`, subject, `term-${pad2(term)}`, `week-${pad2(week)}`);
    const resourceName = pickResourceFilename(path.basename(sourcePdf));
    const targetFile = nextAvailablePath(destFolder, resourceName);

    if (existsSync(splitFile)) {
      await moveFile(splitFile, targetFile);
      await moveFile(provenancePath, path.join(destFolder, "provenance.json"));
      moved.moved = true;
      moved.destination = normalizePath(path.relative(repoRoot, targetFile));
    } else {
      moved.reason = "split_missing";
    }

    results.push(moved);
  }

  const movedCount = results.filter((r) => r.moved).length;
  const remaining = results.length - movedCount;

  const report = {
    generated_at: new Date().toISOString(),
    total_split_sets: results.length,
    moved_canonical: movedCount,
    remaining_unmapped: remaining,
    reasons,
    samples: results.slice(0, 10),
  };

  await fs.mkdir(path.dirname(reportJson), { recursive: true });
  await fs.writeFile(reportJson, JSON.stringify(report, null, 2));

  const lines: string[] = [];
  lines.push("# Canonicalize Unmapped Splits Report");
  lines.push("");
  lines.push(`Generated: ${report.generated_at}`);
  lines.push("");
  lines.push(`- Total split sets: ${report.total_split_sets}`);
  lines.push(`- Moved canonically: ${report.moved_canonical}`);
  lines.push(`- Remaining unmapped: ${report.remaining_unmapped}`);
  lines.push("");
  lines.push("## Reasons");
  Object.entries(reasons).forEach(([key, count]) => {
    lines.push(`- ${key}: ${count}`);
  });
  lines.push("");
  lines.push("## Sample mappings");
  report.samples.forEach((sample) => {
    lines.push(`- ${sample.provenancePath} -> ${sample.destination || "unmapped"} (${sample.reason || "ok"})`);
  });
  await fs.writeFile(reportMd, lines.join("\n"));

  console.log("Canonicalization complete.");
  console.log(`Moved: ${movedCount}`);
  console.log(`Remaining: ${remaining}`);
  console.log(`Report: ${reportJson}`);
  console.log(`Report: ${reportMd}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
