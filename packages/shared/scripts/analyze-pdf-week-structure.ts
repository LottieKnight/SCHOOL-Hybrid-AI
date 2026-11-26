import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pdfParse from "pdf-parse";
import { runOcrForPdf, getOcrMaxPages, isOcrEnabled } from "../src/ocr-utils.js";

type WeekOccurrence = {
  week: number;
  pages: number[];
  pageRange: { start: number; end: number };
};

type PdfWeekAnalysis = {
  filePath: string;
  fileName: string;
  totalPages: number;
  textLayerPresent: boolean;
  ocrAttempted: boolean;
  ocrUsed: boolean;
  ocrError?: string;
  detectedWeeks: WeekOccurrence[];
  occurrencesCount: number;
  distinctWeeks: number;
  confidence: number;
  classification: "week_structured" | "term_structured" | "ambiguous";
  termMarkers: number;
  weekMarkerSamples: { week: number; pages: number[] };
  notes?: string[];
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const mirrorRootDefault = path.join(repoRoot, "content", "gde_lrip_mip_mirror");
const reportJsonPath = path.join(repoRoot, "content", "reports", "pdf_week_structure_report.json");
const reportMdPath = path.join(repoRoot, "content", "reports", "pdf_week_structure_report.md");

const MAX_PAGES = Number(process.env.PDF_MAX_PAGES || 250);
const TIMEOUT_MS = Number(process.env.PDF_TIMEOUT_MS || 60000);
const OCR_MAX_PAGES = getOcrMaxPages();

function normalizePath(filePath: string) {
  return filePath.split(path.sep).join("/");
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function resolveMirrorRoot() {
  const override = process.env.GDE_MIRROR_ROOT;
  if (override) return override;
  const candidates = [
    mirrorRootDefault,
    path.join(process.cwd(), "content", "gde_lrip_mip_mirror"),
    path.join(process.cwd(), "..", "content", "gde_lrip_mip_mirror"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

async function listPdfFiles(root: string) {
  const files: string[] = [];
  if (!existsSync(root)) return files;
  const queue: string[] = [root];
  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
        files.push(fullPath);
      }
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function detectTermMarkers(text: string) {
  const matches = text.match(/\bterm\s*0*([1-4])\b/gi);
  return matches ? matches.length : 0;
}

function normalizeRangeDashArtifacts(text: string) {
  return text
    .replace(/\u00e2\u20ac[\u201c\u201d]/g, "-")
    .replace(/[\u2010-\u2015\u2212]/g, "-");
}

function findWeekMarkers(text: string) {
  const markers: number[] = [];
  const regex = /\bweek\s*0*([1-9]\d?)\b\s*:*/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const weekNum = Number(match[1]);
    if (!Number.isFinite(weekNum)) continue;
    const tail = normalizeRangeDashArtifacts(
      text.slice(match.index + match[0].length, match.index + match[0].length + 12)
    );
    if (/^\s*-\s*\d/.test(tail)) continue;
    if (/^\s*to\s*\d/i.test(tail)) continue;
    markers.push(weekNum);
  }
  return markers;
}

function computeWeekOccurrences(pageTexts: string[], totalPages: number) {
  const occurrences = new Map<number, Set<number>>();
  pageTexts.forEach((text, index) => {
    if (!text) return;
    const markers = findWeekMarkers(text);
    for (const weekNum of markers) {
      if (!occurrences.has(weekNum)) occurrences.set(weekNum, new Set<number>());
      occurrences.get(weekNum)?.add(index + 1);
    }
  });

  const ordered = [...occurrences.entries()]
    .map(([week, pagesSet]) => ({ week, pages: [...pagesSet].sort((a, b) => a - b) }))
    .sort((a, b) => a.pages[0] - b.pages[0]);

  const ranges: WeekOccurrence[] = ordered.map((item, idx) => {
    const start = item.pages[0];
    const next = ordered[idx + 1];
    const end = next ? Math.max(start, next.pages[0] - 1) : totalPages;
    return {
      week: item.week,
      pages: item.pages,
      pageRange: { start, end },
    };
  });

  return ranges;
}

function computeConfidence(distinctWeeks: number, occurrences: number) {
  if (!distinctWeeks && !occurrences) return 0;
  const weekScore = Math.min(distinctWeeks, 6) / 6;
  const occurrenceScore = Math.min(occurrences, 12) / 12;
  const score = weekScore * 0.6 + occurrenceScore * 0.4;
  return Math.round(score * 100) / 100;
}

function classifyAnalysis(distinctWeeks: number, occurrences: number, termMarkers: number, confidence: number) {
  if (distinctWeeks >= 2 && occurrences >= distinctWeeks + 1 && confidence >= 0.4) {
    return "week_structured" as const;
  }
  if (distinctWeeks === 0 && termMarkers > 0) {
    return "term_structured" as const;
  }
  return "ambiguous" as const;
}

async function extractPageTexts(filePath: string) {
  const buffer = await fs.readFile(filePath);
  const pageTexts: string[] = [];
  const data = await pdfParse(buffer, {
    pagerender: async (pageData: { pageIndex?: number; getTextContent: (opts: { disableCombineTextItems: boolean }) => Promise<{ items: { str: string }[] }> }) => {
      const pageIndex = pageData.pageIndex ?? 0;
      if (pageIndex >= MAX_PAGES) {
        return "";
      }
      const textContent = await pageData.getTextContent({ disableCombineTextItems: false });
      const strings = textContent.items.map((item: any) => item.str).join(" ");
      pageTexts[pageIndex] = strings;
      return strings;
    },
  });
  return { pageTexts, totalPages: data.numpages || pageTexts.length, fullText: data.text || "" };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  let timeoutHandle: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(`timeout:${label}`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutHandle!);
  }
}

async function analyzePdf(filePath: string): Promise<PdfWeekAnalysis> {
  const notes: string[] = [];
  let pageTexts: string[] = [];
  let totalPages = 0;
  let fullText = "";
  let textLayerPresent = false;
  let ocrAttempted = false;
  let ocrUsed = false;
  let ocrError: string | undefined;
  try {
    const result = await withTimeout(extractPageTexts(filePath), TIMEOUT_MS, path.basename(filePath));
    pageTexts = result.pageTexts;
    totalPages = result.totalPages || pageTexts.length;
    fullText = result.fullText || "";
    textLayerPresent = fullText.trim().length > 0;
  } catch (error: any) {
    notes.push(error?.message || "extract_failed");
  }

  if (!textLayerPresent && isOcrEnabled()) {
    ocrAttempted = true;
    const ocrResult = await runOcrForPdf(filePath, OCR_MAX_PAGES);
    if (ocrResult.used) {
      ocrUsed = true;
      pageTexts = ocrResult.pageTexts;
      fullText = ocrResult.text;
    } else if (ocrResult.error) {
      ocrError = ocrResult.error;
      notes.push(`ocr_failed:${ocrResult.error}`);
    }
  }

  const termMarkers = detectTermMarkers(fullText);
  const weekOccurrences = computeWeekOccurrences(pageTexts, totalPages || pageTexts.length);
  const occurrencesCount = weekOccurrences.reduce((sum, entry) => sum + entry.pages.length, 0);
  const distinctWeeks = weekOccurrences.length;
  const confidence = computeConfidence(distinctWeeks, occurrencesCount);
  const classification = classifyAnalysis(distinctWeeks, occurrencesCount, termMarkers, confidence);

  if (!textLayerPresent) {
    notes.push("no_text_layer_detected");
    if (!ocrAttempted) {
      notes.push("ocr_not_attempted");
    }
  }

  return {
    filePath: normalizePath(path.relative(repoRoot, filePath)),
    fileName: path.basename(filePath),
    totalPages: totalPages || pageTexts.length,
    textLayerPresent,
    ocrAttempted,
    ocrUsed,
    ocrError,
    detectedWeeks: weekOccurrences,
    occurrencesCount,
    distinctWeeks,
    confidence,
    classification,
    termMarkers,
    weekMarkerSamples: weekOccurrences.slice(0, 5).map((entry) => ({ week: entry.week, pages: entry.pages.slice(0, 3) })),
    notes: notes.length ? notes : undefined,
  };
}

function buildMarkdownReport(results: PdfWeekAnalysis[], stats: any) {
  const lines: string[] = [];
  lines.push("# PDF Week Structure Report");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Total PDFs: ${stats.total}`);
  lines.push(`- Week structured: ${stats.week_structured}`);
  lines.push(`- Term structured: ${stats.term_structured}`);
  lines.push(`- Ambiguous: ${stats.ambiguous}`);
  lines.push(`- OCR used: ${stats.ocr_used}`);
  lines.push(`- Week structured from OCR: ${stats.week_structured_from_ocr}`);
  lines.push(`- OCR failures: ${stats.ocr_failures_total}`);
  lines.push("");
  if (stats.ocr_failure_samples?.length) {
    lines.push("## OCR failures (sample)");
    stats.ocr_failure_samples.forEach((entry: any) => {
      lines.push(`- ${entry.filePath}: ${entry.ocrError}`);
    });
    lines.push("");
  }
  lines.push("## Top 20 week-structured PDFs (by confidence)");
  lines.push("");
  stats.topWeekStructured.forEach((entry: PdfWeekAnalysis, index: number) => {
    const weeks = entry.detectedWeeks.map((w) => `W${pad2(w.week)}:${w.pageRange.start}-${w.pageRange.end}`).join(", ");
    lines.push(
      `${index + 1}. ${entry.filePath} (confidence ${entry.confidence}) weeks: ${weeks || "none"}`
    );
  });
  lines.push("");
  lines.push("## Samples (week markers)");
  lines.push("");
  results.slice(0, 20).forEach((entry) => {
    if (!entry.weekMarkerSamples.length) return;
    lines.push(`- ${entry.filePath}: ${entry.weekMarkerSamples.map((s) => `W${s.week}@p${s.pages.join(",")}`).join("; ")}`);
  });
  return lines.join("\n");
}

async function main() {
  const mirrorRoot = resolveMirrorRoot();
  const pdfFiles = await listPdfFiles(mirrorRoot);
  if (!pdfFiles.length) {
    console.log("No PDFs found under", mirrorRoot);
    return;
  }

  const results: PdfWeekAnalysis[] = [];
  for (const filePath of pdfFiles) {
    const analysis = await analyzePdf(filePath);
    results.push(analysis);
  }

  const ocrFailures = results.filter((r) => r.ocrError);
  const stats = {
    total: results.length,
    week_structured: results.filter((r) => r.classification === "week_structured").length,
    term_structured: results.filter((r) => r.classification === "term_structured").length,
    ambiguous: results.filter((r) => r.classification === "ambiguous").length,
    ocr_used: results.filter((r) => r.ocrUsed).length,
    week_structured_from_ocr: results.filter((r) => r.ocrUsed && r.classification === "week_structured").length,
    ocr_failures_total: ocrFailures.length,
    ocr_failure_samples: ocrFailures.slice(0, 10),
    topWeekStructured: results
      .filter((r) => r.classification === "week_structured")
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 20),
  };

  const report = {
    generated_at: new Date().toISOString(),
    mirror_root: normalizePath(path.relative(repoRoot, mirrorRoot)),
    stats,
    results,
  };

  await fs.mkdir(path.dirname(reportJsonPath), { recursive: true });
  await fs.writeFile(reportJsonPath, JSON.stringify(report, null, 2));
  await fs.writeFile(reportMdPath, buildMarkdownReport(results, stats));

  console.log("PDF week structure analysis complete.");
  console.log(`Total PDFs: ${stats.total}`);
  console.log(`Week structured: ${stats.week_structured}`);
  console.log(`Term structured: ${stats.term_structured}`);
  console.log(`Ambiguous: ${stats.ambiguous}`);
  console.log(`Report: ${reportJsonPath}`);
  console.log(`Report: ${reportMdPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
