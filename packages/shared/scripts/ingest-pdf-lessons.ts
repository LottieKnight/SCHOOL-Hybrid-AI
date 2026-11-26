/// <reference path="./pdf-parse.d.ts" />
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pdfParse from "pdf-parse";
import { runOcrForPdf, isOcrEnabled } from "../src/ocr-utils.js";
import {
  LessonSchema,
  getLessonJsonRoot,
} from "../src/lesson-content.js";
import { generateQuiz } from "../src/quiz-generator.js";
import { loadCourseOutline } from "../src/curriculum.js";
import { resolveSubjectKey } from "../src/subject-alias";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const DEFAULT_PDF_ROOT = path.join(repoRoot, "content", "pdf");
const MANUAL_MAPPINGS_PATH = path.join(repoRoot, "content", "mappings", "manual_mappings.json");
const AUTO_MAPPINGS_PATH = path.join(repoRoot, "content", "mappings", "auto_mappings.json");
const INGEST_REPORT_PATH = path.join(repoRoot, "content", "reports", "ingestion_report.md");
const SUBJECT_MISMATCH_REPORT_PATH = path.join(
  repoRoot,
  "content",
  "reports",
  "subject_mismatch_samples.md"
);
const AUTO_MAP_DRY_RUN =
  process.env.AUTO_MAP_DRY_RUN === "1" || process.env.AUTO_MAP_DRY_RUN === "true";

function normalizeFilePath(filePath: string) {
  return filePath.split(path.sep).join("/");
}

function buildScanText(filePath: string) {
  return normalizeFilePath(filePath).replace(/\//g, " ");
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function gradeToPhase(grade: number) {
  if (grade <= 3) return "foundation";
  if (grade <= 6) return "intermediate";
  if (grade <= 9) return "senior";
  return "fet";
}

function resolvePdfRoot() {
  const override = process.env.LESSON_PDF_ROOT;
  if (override) return override;
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "content", "pdf"),
    path.join(cwd, "..", "content", "pdf"),
    DEFAULT_PDF_ROOT,
    path.join(cwd, "packages", "shared", "content", "pdfs"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return DEFAULT_PDF_ROOT;
}

 

async function walkPdfFiles(root: string) {
  const files: string[] = [];
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith("_") || entry.name.toLowerCase() === "unmapped") {
        continue;
      }
      files.push(...(await walkPdfFiles(fullPath)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
      files.push(fullPath);
    }
  }
  return files;
}

async function hashFile(filePath: string) {
  const buffer = await fs.readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex");
}

function extractSections(text: string) {
  const sections: Record<string, string[]> = {};
  const lines = text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const headingMatchers: Record<string, RegExp> = {
    topic: /^(topic|title)\b/i,
    summary: /^(summary|overview)\b/i,
    outline: /^(lesson outline|outline|steps|lesson plan)\b/i,
    activities: /^(activities|activity|learning activities)\b/i,
    assessment: /^(assessment|assessment tasks|assessment activities)\b/i,
  };

  let current = "body";
  for (const line of lines) {
    const headingKey = Object.keys(headingMatchers).find((key) => headingMatchers[key].test(line));
    if (headingKey) {
      current = headingKey;
      sections[current] = [];
      continue;
    }
    if (!sections[current]) sections[current] = [];
    sections[current].push(line);
  }

  return sections;
}

function toBullets(lines: string[], fallbackText: string, limit = 6) {
  const bullets: string[] = [];
  lines.forEach((line) => {
    const cleaned = line.replace(/^[-*•\d.]+\s*/, "").trim();
    if (cleaned) bullets.push(cleaned);
  });
  if (bullets.length) return bullets.slice(0, limit);

  const sentences = fallbackText
    .replace(/\s+/g, " ")
    .split(/(?<=[.?!])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  return sentences.slice(0, limit);
}

type PdfTextItem = { str: string };
type PdfTextContent = { items: PdfTextItem[] };
type PdfPageProxy = {
  getTextContent: () => Promise<PdfTextContent>;
};

async function extractPdfText(filePath: string) {
  const buffer = await fs.readFile(filePath);
  const pageTexts: string[] = [];
  const data = await pdfParse(buffer, {
    pagerender: async (pageData: PdfPageProxy) => {
      const textContent = await pageData.getTextContent();
      const text = textContent.items.map((item: any) => item.str).join(" ");
      pageTexts.push(text);
      return text;
    },
  });
  const text = data.text || "";
  if (!text.trim() && isOcrEnabled()) {
    const ocrResult = await runOcrForPdf(filePath);
    if (ocrResult.used) {
      return { text: ocrResult.text, pageTexts: ocrResult.pageTexts };
    }
  }
  return { text, pageTexts };
}

type MappingEntry = {
  source_rel_path: string;
  phase: "foundation" | "intermediate" | "senior" | "fet";
  grade: number;
  subject: string;
  term: number;
  week: number;
  resource_type: string;
  notes?: string;
  mapped_at?: string;
  source?: string;
};

type SubjectMismatchSample = {
  file: string;
  phase: string;
  grade: number;
  term: number;
  week: number;
  reason: string;
  tokens: string[];
  candidates?: string[];
};

type AutoMapCandidate = {
  file: string;
  phase: string;
  grade: number;
  term: number;
  week: number;
  subject: string;
  resource_type: string;
  tokens: string[];
};

function parseExplicitWeek(text: string) {
  const match = text.match(/\b(?:week|wk|w)\s*:?\s*0*([0-9]{1,2})\b/i);
  if (!match) return null;
  const rangeCheck = text
    .slice(match.index ?? 0, (match.index ?? 0) + match[0].length + 6)
    .toLowerCase();
  if (rangeCheck.match(/-\s*\d+/) || rangeCheck.includes("to")) {
    return null;
  }
  const week = Number(match[1]);
  return Number.isFinite(week) ? week : null;
}

function parseExplicitTerm(text: string) {
  const match = text.match(/\b(?:term|t)\s*:?\s*0*([1-4])\b/i);
  if (!match) return null;
  const rangeCheck = text
    .slice(match.index ?? 0, (match.index ?? 0) + match[0].length + 6)
    .toLowerCase();
  if (rangeCheck.match(/-\s*\d+/) || rangeCheck.includes("to")) {
    return null;
  }
  const term = Number(match[1]);
  return Number.isFinite(term) ? term : null;
}

function parseExplicitGrade(text: string) {
  const match = text.match(/\b(?:grade|gr|g)\s*:?\s*0*([0-9]{1,2}|r)\b/i);
  if (!match) return null;
  const raw = match[1].toLowerCase();
  if (raw === "r") return 0;
  const grade = Number(raw);
  return Number.isFinite(grade) ? grade : null;
}

const outlineSubjectCache = new Map<string, string[]>();

function getOutlineSubjectKeys(outline: any, phase: string, grade: number) {
  const cacheKey = `${phase}:${grade}`;
  const cached = outlineSubjectCache.get(cacheKey);
  if (cached) return cached;
  const gradeKey = grade === 0 ? "R" : String(grade);
  const gradeNode = outline.phases?.[phase]?.grades?.[gradeKey];
  if (!gradeNode) {
    outlineSubjectCache.set(cacheKey, []);
    return [];
  }
  const keys = new Set<string>();
  for (const group of Object.values(gradeNode.groups || {})) {
    for (const subjectKey of Object.keys((group as any).subjects || {})) {
      keys.add(subjectKey);
    }
  }
  const list = Array.from(keys);
  outlineSubjectCache.set(cacheKey, list);
  return list;
}

function subjectExists(outline: any, phase: string, grade: number, subject: string) {
  return getOutlineSubjectKeys(outline, phase, grade).includes(subject);
}

function resourceTypeFromName(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("memo") || lower.includes("memorandum") || lower.includes("answers")) return "memo";
  if (lower.includes("assessment") || lower.includes("test") || lower.includes("exam")) return "assessment";
  if (lower.includes("worksheet") || lower.includes("activity") || lower.includes("practice")) return "worksheet";
  if (lower.includes("slides") || lower.endsWith(".ppt") || lower.endsWith(".pptx")) return "slides";
  if (lower.includes("teacher") || lower.includes("notes")) return "teacher_notes";
  if (lower.includes("lesson")) return "lesson";
  return "resources";
}

function baseNameForResourceType(type: string) {
  switch (type) {
    case "lesson":
      return "lesson";
    case "worksheet":
      return "worksheet";
    case "assessment":
      return "assessment";
    case "memo":
      return "memo";
    case "slides":
      return "slides";
    case "teacher_notes":
      return "teacher-notes";
    case "resources":
      return "resources";
    default:
      return "resources";
  }
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

async function writeIngestionReport(stats: {
  totalWeekFolders: number;
  lessonsGenerated: number;
  lessonsSkipped: { reason: string; count: number }[];
  autoMapped: number;
  subjectMismatch: number;
  missingLessonPdf: number;
  autoMapDryRun: boolean;
  autoMapCandidates: AutoMapCandidate[];
}) {
  const lines = [
    "# Ingestion Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    `Total week folders scanned: ${stats.totalWeekFolders}`,
    `Lessons generated: ${stats.lessonsGenerated}`,
    `Auto-mapped files: ${stats.autoMapped}`,
    `Auto-map dry run: ${stats.autoMapDryRun ? "true" : "false"}`,
    `Subject mismatch count: ${stats.subjectMismatch}`,
    `Missing lesson.pdf count: ${stats.missingLessonPdf}`,
    "",
    "## Lessons skipped (by reason)",
    "",
    "| Reason | Count |",
    "| --- | ---: |",
    ...stats.lessonsSkipped.map((entry) => `| ${entry.reason} | ${entry.count} |`),
    "",
  ];

  if (stats.autoMapDryRun && stats.autoMapCandidates.length) {
    lines.push("## Auto-map candidates (dry run)", "");
    lines.push("| File | Phase | Grade | Term | Week | Subject | Resource | Tokens |");
    lines.push("| --- | --- | ---: | ---: | ---: | --- | --- | --- |");
    stats.autoMapCandidates.slice(0, 50).forEach((candidate) => {
      const tokens = candidate.tokens.join(", ");
      lines.push(
        `| ${candidate.file} | ${candidate.phase} | ${candidate.grade} | ${candidate.term} | ${candidate.week} | ${candidate.subject} | ${candidate.resource_type} | ${tokens} |`
      );
    });
    lines.push("");
  }
  await fs.mkdir(path.dirname(INGEST_REPORT_PATH), { recursive: true });
  await fs.writeFile(INGEST_REPORT_PATH, lines.join("\n"));
}

async function writeSubjectMismatchSamples(samples: SubjectMismatchSample[]) {
  const lines = [
    "# Subject Mismatch Samples",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    `Total mismatches: ${samples.length}`,
    "",
    "| File | Phase | Grade | Term | Week | Reason | Tokens | Candidates |",
    "| --- | --- | ---: | ---: | ---: | --- | --- | --- |",
  ];
  samples.slice(0, 50).forEach((sample) => {
    const tokens = sample.tokens.join(", ");
    const candidates = sample.candidates?.join(", ") ?? "";
    lines.push(
      `| ${sample.file} | ${sample.phase} | ${sample.grade} | ${sample.term} | ${sample.week} | ${sample.reason} | ${tokens} | ${candidates} |`
    );
  });
  lines.push("");
  await fs.mkdir(path.dirname(SUBJECT_MISMATCH_REPORT_PATH), { recursive: true });
  await fs.writeFile(SUBJECT_MISMATCH_REPORT_PATH, lines.join("\n"));
}

function listWeekFolders(pdfRoot: string, pdfFiles: string[]) {
  const folders = new Map<string, string[]>();
  for (const filePath of pdfFiles) {
    const relPath = normalizeFilePath(path.relative(pdfRoot, filePath));
    const segments = relPath.split("/");
    if (segments.length < 6) continue;
    const [phase, gradeSegment, subjectSegment, termSegment, weekSegment] = segments;
    if (!phase || !gradeSegment || !subjectSegment || !termSegment || !weekSegment) continue;
    if (!gradeSegment.startsWith("grade-")) continue;
    if (!termSegment.startsWith("term-")) continue;
    if (!weekSegment.startsWith("week-")) continue;
    if (phase === "_incoming" || phase === "unmapped") continue;
    const folderKey = `${phase}/${gradeSegment}/${subjectSegment}/${termSegment}/${weekSegment}`;
    const list = folders.get(folderKey) ?? [];
    list.push(filePath);
    folders.set(folderKey, list);
  }
  return folders;
}

async function autoMapFiles(pdfRoot: string, outline: any) {
  const dryRun = AUTO_MAP_DRY_RUN;
  const autoStore = await readJsonSafe(AUTO_MAPPINGS_PATH, { updated_at: new Date().toISOString(), mappings: [] });
  const existingAuto = new Map<string, MappingEntry>();
  for (const entry of autoStore.mappings || []) {
    existingAuto.set(entry.source_rel_path, entry);
  }
  const autoMapped: MappingEntry[] = [];
  const autoMapCandidates: AutoMapCandidate[] = [];
  const mismatchSamples: SubjectMismatchSample[] = [];
  let subjectMismatchCount = 0;
  const candidates = [path.join(pdfRoot, "_incoming"), path.join(pdfRoot, "unmapped")];

  for (const candidateRoot of candidates) {
    if (!existsSync(candidateRoot)) continue;
    const stack = [candidateRoot];
    while (stack.length) {
      const current = stack.pop();
      if (!current) continue;
      const entries = await fs.readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
        } else if (entry.isFile()) {
          const sourceRelPath = normalizeFilePath(path.relative(repoRoot, fullPath));
          const pdfRelPath = normalizeFilePath(path.relative(pdfRoot, fullPath));
          const folderHint = path.dirname(pdfRelPath);
          const scanText = buildScanText(fullPath);
          const grade = parseExplicitGrade(scanText);
          const term = parseExplicitTerm(scanText);
          const week = parseExplicitWeek(scanText);
          if (grade === null || term === null || week === null) continue;
          const phase = gradeToPhase(grade);
          const outlineKeys = getOutlineSubjectKeys(outline, phase, grade);
          if (!outlineKeys.length) {
            subjectMismatchCount += 1;
            mismatchSamples.push({
              file: sourceRelPath,
              phase,
              grade,
              term,
              week,
              reason: "no outline keys",
              tokens: [],
            });
            continue;
          }
          const subjectResult = resolveSubjectKey({
            phase,
            grade,
            filename: entry.name,
            folderHints: [folderHint],
            outlineKeys,
          });
          if (!subjectResult.subjectKey) {
            subjectMismatchCount += 1;
            mismatchSamples.push({
              file: sourceRelPath,
              phase,
              grade,
              term,
              week,
              reason: subjectResult.reason,
              tokens: subjectResult.tokens,
              candidates: subjectResult.candidates,
            });
            continue;
          }
          const subject = subjectResult.subjectKey;
          if (!outlineKeys.includes(subject)) {
            subjectMismatchCount += 1;
            mismatchSamples.push({
              file: sourceRelPath,
              phase,
              grade,
              term,
              week,
              reason: "subject not in outline for grade",
              tokens: subjectResult.tokens,
            });
            continue;
          }

          const resourceType = resourceTypeFromName(entry.name);
          const baseName = baseNameForResourceType(resourceType);
          const ext = path.extname(entry.name) || ".pdf";
          const destDir = path.join(
            pdfRoot,
            phase,
            `grade-${pad2(grade)}`,
            subject,
            `term-${pad2(term)}`,
            `week-${pad2(week)}`
          );
          autoMapCandidates.push({
            file: sourceRelPath,
            phase,
            grade,
            term,
            week,
            subject,
            resource_type: resourceType,
            tokens: subjectResult.tokens,
          });

          if (dryRun) {
            continue;
          }

          await fs.mkdir(destDir, { recursive: true });
          const destPath = path.join(destDir, `${baseName}${ext}`);
          try {
            await fs.rename(fullPath, destPath);
          } catch {
            await fs.copyFile(fullPath, destPath);
            await fs.unlink(fullPath);
          }

          const mapping: MappingEntry = {
            source_rel_path: sourceRelPath,
            phase,
            grade,
            subject,
            term,
            week,
            resource_type: resourceType,
            notes: "auto-mapped via heuristic",
            mapped_at: new Date().toISOString(),
            source: "heuristic",
          };
          existingAuto.set(sourceRelPath, mapping);
          autoMapped.push(mapping);
        }
      }
    }
  }

  if (!dryRun) {
    autoStore.mappings = Array.from(existingAuto.values());
    autoStore.updated_at = new Date().toISOString();
    await writeJsonAtomic(AUTO_MAPPINGS_PATH, autoStore);
  }
  return {
    autoMappedCount: dryRun ? autoMapCandidates.length : autoMapped.length,
    subjectMismatchCount,
    mismatchSamples,
    autoMapCandidates,
    autoMapDryRun: dryRun,
  };
}

async function main() {
  const pdfRoot = resolvePdfRoot();
  const lessonRoot = getLessonJsonRoot();

  const outline = loadCourseOutline();
  const manualStore = await readJsonSafe(MANUAL_MAPPINGS_PATH, { mappings: [] });
  const autoMappingResult = await autoMapFiles(pdfRoot, outline);

  for (const mapping of manualStore.mappings || []) {
    const phase = mapping.phase;
    const grade = mapping.grade;
    const subject = mapping.subject;
    const term = mapping.term;
    const week = mapping.week;
    if (!phase || grade === null || grade === undefined || !subject || term === null || term === undefined || week === null || week === undefined) {
      continue;
    }
    const canonicalPath = path.join(
      pdfRoot,
      phase,
      `grade-${pad2(grade)}`,
      subject,
      `term-${pad2(term)}`,
      `week-${pad2(week)}`
    );
    if (!existsSync(canonicalPath)) {
      console.warn(`Manual mapping missing path: ${canonicalPath}`);
    }
  }

  const pdfFiles = await walkPdfFiles(pdfRoot);
  if (!pdfFiles.length) {
    console.log("No PDF files found in", pdfRoot);
    await writeSubjectMismatchSamples(autoMappingResult.mismatchSamples);
    await writeIngestionReport({
      totalWeekFolders: 0,
      lessonsGenerated: 0,
      lessonsSkipped: [{ reason: "no_pdf_files", count: 1 }],
      autoMapped: autoMappingResult.autoMappedCount,
      subjectMismatch: autoMappingResult.subjectMismatchCount,
      missingLessonPdf: 0,
      autoMapDryRun: autoMappingResult.autoMapDryRun,
      autoMapCandidates: autoMappingResult.autoMapCandidates,
    });
    return;
  }

  const weekFolders = listWeekFolders(pdfRoot, pdfFiles);
  const lessonsSkipped: Record<string, number> = {};
  let lessonsGenerated = 0;
  let missingLessonPdfCount = 0;

  for (const [folderKey, files] of weekFolders.entries()) {
    const [phase, gradeSegment, subjectKey, termSegment, weekSegment] = folderKey.split("/");
    const gradeNumber = Number(gradeSegment.replace("grade-", ""));
    const term = Number(termSegment.replace("term-", ""));
    const week = Number(weekSegment.replace("week-", ""));
    let effectiveSubject = subjectKey;
    if (!subjectExists(outline, phase, gradeNumber, effectiveSubject)) {
      const outlineKeys = getOutlineSubjectKeys(outline, phase, gradeNumber);
      const resolved = resolveSubjectKey({
        phase,
        grade: gradeNumber,
        filename: subjectKey,
        outlineKeys,
      });
      if (resolved.subjectKey) {
        effectiveSubject = resolved.subjectKey;
      } else {
        lessonsSkipped.subject_mismatch = (lessonsSkipped.subject_mismatch || 0) + 1;
      }
    }

    const pdfs = files.filter((filePath) => filePath.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) {
      lessonsSkipped.no_pdf = (lessonsSkipped.no_pdf || 0) + 1;
      continue;
    }

    const resourceEntries = [];
    const hashes = [];
    let lessonPdf = pdfs.find((filePath) => path.basename(filePath).toLowerCase().startsWith("lesson"));
    if (!lessonPdf) {
      lessonPdf = pdfs[0];
      missingLessonPdfCount += 1;
    }

    for (const filePath of pdfs) {
      const hash = await hashFile(filePath);
      hashes.push(hash);
      const relPath = normalizeFilePath(path.relative(pdfRoot, filePath));
      resourceEntries.push({
        title: path.basename(filePath),
        sourcePdfPath: relPath,
      });
    }

    const lessonPath = path.join(
      lessonRoot,
      `grade-${pad2(gradeNumber)}`,
      effectiveSubject,
      `term-${pad2(term)}`,
      `week-${pad2(week)}.json`
    );
    let shouldSkip = false;
    try {
      const existing = JSON.parse(await fs.readFile(lessonPath, "utf-8"));
      if (Array.isArray(existing.sourceHashes) && existing.sourceHashes.join(",") === hashes.join(",")) {
        shouldSkip = true;
      }
    } catch {
      shouldSkip = false;
    }

    if (shouldSkip) {
      lessonsSkipped.unchanged = (lessonsSkipped.unchanged || 0) + 1;
      continue;
    }

    const extracted = await extractPdfText(lessonPdf);
    const rawExtracted = (extracted.text || "").trim();
    const extractedText =
      rawExtracted ||
      resourceEntries.map((resource) => resource.title.replace(/\.pdf$/i, "")).join(" ");
    const sections = extractSections(extractedText);
    const summaryText = (sections.summary ?? []).join(" ").trim();
    const topicText = (sections.topic ?? []).join(" ").trim();

    const lessonOutline = toBullets(sections.outline ?? [], extractedText);
    const activities = toBullets(sections.activities ?? [], extractedText, 5);
    const assessment = toBullets(sections.assessment ?? [], extractedText, 4);

    const quiz = generateQuiz(extractedText, gradeNumber);

    const lesson = {
      version: 1,
      grade: gradeNumber,
      phase,
      term,
      week,
      subject: effectiveSubject,
      topic: topicText || `Week ${week} lesson`,
      summary: summaryText || lessonOutline.slice(0, 2).join(" ") || extractedText.slice(0, 160),
      lessonOutline,
      activities,
      assessment,
      resources: resourceEntries,
      extractedText,
      quiz,
      sourceHashes: hashes,
    };

    const validated = LessonSchema.parse(lesson);
    await fs.mkdir(path.dirname(lessonPath), { recursive: true });
    await fs.writeFile(lessonPath, JSON.stringify(validated, null, 2));
    console.log("Wrote lesson", lessonPath);
    lessonsGenerated += 1;
  }

  await writeIngestionReport({
    totalWeekFolders: weekFolders.size,
    lessonsGenerated,
    lessonsSkipped: Object.entries(lessonsSkipped).map(([reason, count]) => ({ reason, count })),
    autoMapped: autoMappingResult.autoMappedCount,
    subjectMismatch: autoMappingResult.subjectMismatchCount,
    missingLessonPdf: missingLessonPdfCount,
    autoMapDryRun: autoMappingResult.autoMapDryRun,
    autoMapCandidates: autoMappingResult.autoMapCandidates,
  });
  await writeSubjectMismatchSamples(autoMappingResult.mismatchSamples);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
