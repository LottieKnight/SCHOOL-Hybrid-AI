import fs from "node:fs/promises";
import { existsSync, statSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { resolveSubjectKey } from "../src/subject-alias";

type WeekOccurrence = {
  week: number;
  pages: number[];
  pageRange: { start: number; end: number };
};

type PdfWeekAnalysis = {
  filePath: string;
  fileName: string;
  totalPages: number;
  confidence: number;
  classification: "week_structured" | "term_structured" | "ambiguous";
  detectedWeeks: WeekOccurrence[];
};

type SplitEntry = {
  source: string;
  week: number;
  pageRange: [number, number];
  output: string;
  canonical: boolean;
  reason?: string;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const mirrorRoot = path.join(repoRoot, "content", "gde_lrip_mip_mirror");
const reportPath = path.join(repoRoot, "content", "reports", "pdf_week_structure_report.json");
const outputRoot = path.join(repoRoot, "content", "pdf");
const unmappedRoot = path.join(outputRoot, "_incoming", "unmapped_splits");
const weekSplitReportJson = path.join(repoRoot, "content", "reports", "week_split_report.json");
const weekSplitReportMd = path.join(repoRoot, "content", "reports", "week_split_report.md");

const CONFIDENCE_THRESHOLD = Number(process.env.WEEK_SPLIT_CONFIDENCE || 0.6);

function normalizePath(value: string) {
  return value.split(path.sep).join("/");
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function safeFolderName(value: string) {
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, "-").trim();
}

function extractGrade(filename: string) {
  const match =
    filename.match(/\bgr(?:ade)?[-\s]?0?(\d{1,2})\b/i) ||
    filename.match(/\bg0?(\d{1,2})\b/i);
  return match ? Number(match[1]) : null;
}

function extractTerm(filename: string) {
  const match = filename.match(/\bterm[-\s]?0?([1-4])\b/i) || filename.match(/\bt0?([1-4])\b/i);
  return match ? Number(match[1]) : null;
}

function extractPhaseFromPath(filePath: string) {
  const lower = filePath.toLowerCase();
  if (lower.includes("foundation")) return "foundation";
  if (lower.includes("intermediate")) return "intermediate";
  if (lower.includes("senior")) return "senior";
  if (lower.includes("fet")) return "fet";
  return null;
}

function loadOutlineKeys() {
  const outlinePath = path.join(repoRoot, "packages", "shared", "content", "course_outline.json");
  if (!existsSync(outlinePath)) return [];
  const outline = JSON.parse(readFileSync(outlinePath, "utf-8"));
  const keys = new Set<string>();
  for (const phase of Object.values<any>(outline.phases || {})) {
    for (const grade of Object.values<any>(phase.grades || {})) {
      for (const subjectKey of Object.keys(grade.subjects || {})) {
        keys.add(subjectKey);
      }
    }
  }
  return Array.from(keys);
}

function resolveSubject(filename: string, folderHints: string[], outlineKeys: string[], phase: string, grade: number) {
  const result = resolveSubjectKey({
    phase,
    grade,
    filename,
    folderHints,
    outlineKeys,
  });
  if (result.confidence !== "high" || !result.subjectKey) {
    return { subject: null, reason: result.reason };
  }
  return { subject: result.subjectKey, reason: "matched" };
}

function buildCanonicalPath(phase: string, grade: number, subject: string, term: number, week: number) {
  return path.join(outputRoot, phase, `grade-${pad2(grade)}`, subject, `term-${pad2(term)}`, `week-${pad2(week)}`);
}

function splitPdfPages(input: string, output: string, startPage: number, endPage: number) {
  const scriptPath = path.join(repoRoot, "packages", "shared", "scripts", "split_pdf_pages.py");
  const candidates: { cmd: string; args: string[] }[] = [];
  if (process.env.PYTHON) {
    candidates.push({ cmd: process.env.PYTHON, args: [] });
  }
  if (process.platform === "win32") {
    candidates.push({ cmd: "py", args: ["-3"] });
  }
  candidates.push({ cmd: "python3", args: [] }, { cmd: "python", args: [] });

  let lastError = "";
  for (const candidate of candidates) {
    const result = spawnSync(
      candidate.cmd,
      [...candidate.args, scriptPath, input, output, String(startPage), String(endPage)],
      { stdio: "inherit" }
    );
    if (result.status === 0) return;
    if (result.error) lastError = result.error.message;
  }
  throw new Error(`split_failed:${input}:${lastError || "python_unavailable"}`);
}

function buildProvenance(sourceRel: string, sourceBytes: number, week: number, range: [number, number]) {
  return {
    source_pdf: sourceRel,
    source_bytes: sourceBytes,
    extracted_week: week,
    page_range: range,
    generated_at: new Date().toISOString(),
    notes: "from week structure analyzer",
  };
}

function getProvenanceFilePath(outputDir: string, week: number, canonical: boolean) {
  if (canonical) {
    return path.join(outputDir, "provenance.json");
  }
  return path.join(outputDir, `week-${pad2(week)}.provenance.json`);
}

function ensureOutputFolder(folderPath: string) {
  if (!existsSync(folderPath)) {
    mkdirSync(folderPath, { recursive: true });
  }
}

async function writeJson(filePath: string, data: any) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function main() {
  if (!existsSync(reportPath)) {
    console.error("Missing pdf_week_structure_report.json");
    process.exit(1);
  }
  const report = JSON.parse(await fs.readFile(reportPath, "utf-8"));
  const results: PdfWeekAnalysis[] = report.results || [];
  const outlineKeys = loadOutlineKeys();

  const splits: SplitEntry[] = [];
  const failures: Record<string, number> = {};

  const eligible = results.filter(
    (entry) => entry.classification === "week_structured" && entry.confidence >= CONFIDENCE_THRESHOLD
  );

  for (const entry of eligible) {
    const sourceAbs = path.join(repoRoot, entry.filePath);
    if (!existsSync(sourceAbs)) {
      failures["missing_source"] = (failures["missing_source"] || 0) + 1;
      continue;
    }

    const sourceRel = normalizePath(entry.filePath);
    const filename = entry.fileName;
    const folderHint = path.dirname(sourceRel);
    const grade = extractGrade(filename);
    const term = extractTerm(filename);
    const phaseFromPath = extractPhaseFromPath(sourceRel);

    let phase: string | null = phaseFromPath;
    if (!phase && typeof grade === "number" && grade <= 3) {
      phase = "foundation";
    }

    const missing: string[] = [];
    if (!grade) missing.push("grade");
    if (!term) missing.push("term");
    if (!phase) missing.push("phase");

    const subjectResult =
      grade && phase
        ? resolveSubject(filename, [folderHint], outlineKeys, phase, grade)
        : { subject: null, reason: "missing grade/phase" };

    if (!subjectResult.subject) missing.push("subject");

    for (const weekEntry of entry.detectedWeeks) {
      const week = weekEntry.week;
      const range: [number, number] = [weekEntry.pageRange.start, weekEntry.pageRange.end];

      let outputDir: string;
      let outputFile: string;
      let canonical = false;
      if (missing.length === 0 && grade && term && phase && subjectResult.subject) {
        outputDir = buildCanonicalPath(phase, grade, subjectResult.subject, term, week);
        outputFile = path.join(outputDir, "lesson.pdf");
        canonical = true;
      } else {
        const base = safeFolderName(path.basename(filename, path.extname(filename)));
        outputDir = path.join(unmappedRoot, base);
        outputFile = path.join(outputDir, `week-${pad2(week)}.source.pdf`);
      }

      if (!existsSync(outputFile)) {
        ensureOutputFolder(outputDir);
        splitPdfPages(sourceAbs, outputFile, range[0], range[1]);
      }

      const provenance = buildProvenance(sourceRel, statSync(sourceAbs).size, week, range);
      await writeJson(getProvenanceFilePath(outputDir, week, canonical), provenance);

      if (!canonical && missing.length) {
        const key = `missing_${missing.join("_")}`;
        failures[key] = (failures[key] || 0) + 1;
      }

      splits.push({
        source: sourceRel,
        week,
        pageRange: range,
        output: normalizePath(path.relative(repoRoot, outputFile)),
        canonical,
        reason: canonical ? undefined : missing.join(","),
      });
    }
  }

  const canonicalSplits = splits.filter((s) => s.canonical).length;
  const unmappedSplits = splits.length - canonicalSplits;

  const reportData = {
    generated_at: new Date().toISOString(),
    confidence_threshold: CONFIDENCE_THRESHOLD,
    total_week_structured: eligible.length,
    total_splits: splits.length,
    canonical_splits: canonicalSplits,
    unmapped_splits: unmappedSplits,
    failure_reasons: failures,
    sample_outputs: splits.slice(0, 20),
  };

  await writeJson(weekSplitReportJson, reportData);

  const lines: string[] = [];
  lines.push("# Week Split Report");
  lines.push("");
  lines.push(`Generated: ${reportData.generated_at}`);
  lines.push("");
  lines.push(`- Week structured PDFs processed: ${reportData.total_week_structured}`);
  lines.push(`- Total splits: ${reportData.total_splits}`);
  lines.push(`- Canonical splits: ${reportData.canonical_splits}`);
  lines.push(`- Unmapped splits: ${reportData.unmapped_splits}`);
  lines.push("");
  lines.push("## Failure reasons");
  Object.entries(failures).forEach(([key, count]) => {
    lines.push(`- ${key}: ${count}`);
  });
  lines.push("");
  lines.push("## Sample outputs");
  reportData.sample_outputs.forEach((entry) => {
    lines.push(`- ${entry.output} (${entry.canonical ? "canonical" : "unmapped"})`);
  });

  await fs.writeFile(weekSplitReportMd, lines.join("\n"));

  console.log("Week splitting complete.");
  console.log(`Splits: ${splits.length}`);
  console.log(`Canonical: ${canonicalSplits}`);
  console.log(`Unmapped: ${unmappedSplits}`);
  console.log(`Report: ${weekSplitReportJson}`);
  console.log(`Report: ${weekSplitReportMd}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
