/// <reference path="./pdf-parse.d.ts" />
import { promises as fs } from "node:fs";
import { createWriteStream, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pdfParse from "pdf-parse";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const OUTPUT_PATH = path.join(repoRoot, "content", "index", "chunks.jsonl");
const NO_TEXT_REPORT = path.join(repoRoot, "content", "index", "no_text_pdfs.json");
const rawChunkSize = Number(process.env.CHUNK_PAGES || 2);
const PAGE_CHUNK_SIZE = Number.isFinite(rawChunkSize) && rawChunkSize > 0 ? rawChunkSize : 2;

function normalizeFilePath(filePath: string) {
  return filePath.split(path.sep).join("/");
}

function relativeToRepo(filePath: string) {
  return normalizeFilePath(path.relative(repoRoot, filePath));
}

async function walkPdfFiles(root: string) {
  const files: string[] = [];
  if (!existsSync(root)) return files;
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkPdfFiles(fullPath)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
      files.push(fullPath);
    }
  }
  return files;
}

function parseExplicitGrade(text: string) {
  const match = text.match(/\b(?:grade|gr|g)\s*:?\s*0*([0-9]{1,2}|r)\b/i);
  if (!match) return null;
  const raw = match[1].toLowerCase();
  if (raw === "r") return 0;
  const grade = Number(raw);
  return Number.isFinite(grade) ? grade : null;
}

function parseExplicitTerm(text: string) {
  const match = text.match(/\b(?:term|t)\s*:?\s*0*([1-4])\b/i);
  if (!match) return null;
  const term = Number(match[1]);
  return Number.isFinite(term) ? term : null;
}

function detectFromPath(relPath: string) {
  const segments = relPath.split("/");
  const gradeSegment = segments.find((seg) => seg.toLowerCase().startsWith("grade-"));
  const termSegment = segments.find((seg) => seg.toLowerCase().startsWith("term-"));

  let detectedGrade: number | null = null;
  let detectedTerm: number | null = null;
  let detectedSubject: string | null = null;

  if (gradeSegment) {
    const raw = gradeSegment.toLowerCase().replace("grade-", "");
    detectedGrade = raw === "r" ? 0 : Number(raw);
  }
  if (termSegment) {
    detectedTerm = Number(termSegment.toLowerCase().replace("term-", ""));
  }

  if (gradeSegment) {
    const gradeIndex = segments.indexOf(gradeSegment);
    const subjectCandidate = segments[gradeIndex + 1];
    if (subjectCandidate && !subjectCandidate.toLowerCase().startsWith("term-")) {
      detectedSubject = subjectCandidate;
    }
  }

  return { detectedGrade, detectedTerm, detectedSubject };
}

function docTypeFromName(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("memo") || lower.includes("memorandum") || lower.includes("answers")) return "memo";
  if (lower.includes("assessment") || lower.includes("test") || lower.includes("exam")) return "assessment";
  if (lower.includes("worksheet") || lower.includes("activity") || lower.includes("practice")) return "worksheet";
  if (lower.includes("slides") || lower.endsWith(".ppt") || lower.endsWith(".pptx")) return "slides";
  if (lower.includes("teacher") || lower.includes("notes")) return "teacher_notes";
  if (lower.includes("lesson")) return "lesson";
  return "resources";
}

const LANGUAGE_MARKERS = [
  "the",
  "and",
  "with",
  "from",
  "this",
  "these",
  "lesson",
  "students",
  "die",
  "en",
  "nie",
  "wat",
  "met",
  "vir",
  "leerders",
  "les",
];

function detectLanguageTokens(text: string) {
  const sample = text.toLowerCase();
  const hits: string[] = [];
  for (const token of LANGUAGE_MARKERS) {
    const pattern = new RegExp(`\\b${token}\\b`, "i");
    if (pattern.test(sample)) hits.push(token);
  }
  return hits;
}

type PdfTextItem = { str: string };
type PdfTextContent = { items: PdfTextItem[] };
type PdfPageProxy = {
  getTextContent: () => Promise<PdfTextContent>;
};

async function extractPdfPages(filePath: string) {
  const buffer = await fs.readFile(filePath);
  const pageTexts: string[] = [];
  await pdfParse(buffer, {
    pagerender: async (pageData: PdfPageProxy) => {
      const textContent = await pageData.getTextContent();
      const text = textContent.items.map((item: any) => item.str).join(" ");
      pageTexts.push(text);
      return text;
    },
  });
  return pageTexts;
}

async function main() {
  const pdfRoots = [
    path.join(repoRoot, "content", "gde_lrip_mip_mirror"),
    path.join(repoRoot, "content", "pdf"),
  ];

  const files = (
    await Promise.all(pdfRoots.map((root) => walkPdfFiles(root)))
  ).flat();
  if (!files.length) {
    console.log("No PDFs found under content/gde_lrip_mip_mirror or content/pdf.");
    return;
  }

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  const output = createWriteStream(OUTPUT_PATH, { encoding: "utf-8" });
  const noTextFiles: string[] = [];
  let chunkCount = 0;

  for (const filePath of files) {
    const relPath = relativeToRepo(filePath);
    const pathMeta = detectFromPath(relPath);
    const scanText = `${relPath} ${path.basename(filePath)}`;
    const detectedGradeRaw = pathMeta.detectedGrade ?? parseExplicitGrade(scanText);
    const detectedTermRaw = pathMeta.detectedTerm ?? parseExplicitTerm(scanText);
    const detectedGrade = Number.isFinite(detectedGradeRaw as number) ? (detectedGradeRaw as number) : null;
    const detectedTerm = Number.isFinite(detectedTermRaw as number) ? (detectedTermRaw as number) : null;
    const detectedSubject = pathMeta.detectedSubject ?? null;
    const docType = docTypeFromName(path.basename(filePath));

    let pageTexts: string[] = [];
    try {
      pageTexts = await extractPdfPages(filePath);
    } catch (error) {
      console.warn(`Failed to parse PDF: ${relPath}`);
      console.warn(error);
      continue;
    }
    const hasText = pageTexts.some((text) => text.trim().length > 0);
    if (!hasText) {
      const pages = pageTexts.length ? `1-${pageTexts.length}` : "1";
      noTextFiles.push(relPath);
      const chunk = {
        file_path: relPath,
        pages,
        text: "",
        detected_grade: detectedGrade ?? null,
        detected_term: detectedTerm ?? null,
        detected_subject: detectedSubject,
        language_tokens: [],
        doc_type: docType,
        no_text: true,
      };
      output.write(`${JSON.stringify(chunk)}\n`);
      chunkCount += 1;
      continue;
    }

    for (let i = 0; i < pageTexts.length; i += PAGE_CHUNK_SIZE) {
      const start = i + 1;
      const end = Math.min(i + PAGE_CHUNK_SIZE, pageTexts.length);
      const text = pageTexts.slice(i, end).join(" ").replace(/\s+/g, " ").trim();
      if (!text) continue;
      const pages = start === end ? `${start}` : `${start}-${end}`;
      const chunk = {
        file_path: relPath,
        pages,
        text,
        detected_grade: detectedGrade ?? null,
        detected_term: detectedTerm ?? null,
        detected_subject: detectedSubject,
        language_tokens: detectLanguageTokens(text),
        doc_type: docType,
      };
      output.write(`${JSON.stringify(chunk)}\n`);
      chunkCount += 1;
    }
  }

  await new Promise((resolve) => output.end(resolve));
  await fs.writeFile(NO_TEXT_REPORT, JSON.stringify({ count: noTextFiles.length, files: noTextFiles }, null, 2));
  console.log(`Wrote ${chunkCount} chunks to ${OUTPUT_PATH}`);
  if (noTextFiles.length) {
    console.log(`Flagged ${noTextFiles.length} PDFs with no text. See ${NO_TEXT_REPORT}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
