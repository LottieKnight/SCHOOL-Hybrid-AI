/// <reference path="./pdf-parse.d.ts" />
import { createWriteStream, existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pdfParse from "pdf-parse";
import { loadCourseOutline } from "../src/curriculum.js";
import { resolveSubjectKey } from "../src/subject-alias.js";
import { normalizeSubjectDir } from "../src/lesson-content.js";

type ChunkRecord = {
  file_path: string;
  page_start: number;
  page_end: number;
  detected_grade: number | null;
  detected_term: number | null;
  detected_subject_key: string | null;
  language_tokens: string[];
  phase: "foundation" | "intermediate" | "senior" | "fet" | null;
  doc_type: string;
  text: string;
};

type PdfTextItem = { str: string };
type PdfTextContent = { items: PdfTextItem[] };
type PdfPageProxy = {
  getTextContent: () => Promise<PdfTextContent>;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const OUTPUT_PATH = path.join(repoRoot, "content", "rag_v1", "index.jsonl");
const CHUNK_PAGES = (() => {
  const value = Number(process.env.RAG_V1_CHUNK_PAGES || 2);
  return Number.isFinite(value) && value > 0 ? value : 2;
})();

function normalizeFilePath(filePath: string) {
  return filePath.split(path.sep).join("/");
}

function relativeToRepo(filePath: string) {
  return normalizeFilePath(path.relative(repoRoot, filePath));
}

function gradeToPhase(grade: number) {
  if (grade <= 3) return "foundation";
  if (grade <= 6) return "intermediate";
  if (grade <= 9) return "senior";
  return "fet";
}

function parseGrade(text: string) {
  const match = text.match(/\b(?:grade|gr|g)\s*:?\s*0*([0-9]{1,2}|r)\b/i);
  if (!match) return null;
  const raw = match[1].toLowerCase();
  if (raw === "r") return 0;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function parseTerm(text: string) {
  const match = text.match(/\b(?:term|t)\s*:?\s*0*([1-4])\b/i);
  if (!match) return null;
  const num = Number(match[1]);
  return Number.isFinite(num) ? num : null;
}

function parseGradeFromPath(relPath: string) {
  const segment = relPath.split("/").find((part) => part.toLowerCase().startsWith("grade-"));
  if (!segment) return null;
  const raw = segment.toLowerCase().replace("grade-", "");
  if (raw === "r") return 0;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function parseTermFromPath(relPath: string) {
  const segment = relPath.split("/").find((part) => part.toLowerCase().startsWith("term-"));
  if (!segment) return null;
  const num = Number(segment.toLowerCase().replace("term-", ""));
  return Number.isFinite(num) ? num : null;
}

function detectSubjectFromPath(relPath: string) {
  const segments = relPath.split("/");
  const gradeIndex = segments.findIndex((segment) => segment.toLowerCase().startsWith("grade-"));
  if (gradeIndex < 0) return null;
  const candidate = segments[gradeIndex + 1];
  if (!candidate || candidate.toLowerCase().startsWith("term-")) return null;
  const normalized = normalizeSubjectDir(candidate);
  return normalized ? normalized : null;
}

const LANGUAGE_TOKENS = [
  "hl",
  "home language",
  "fal",
  "first additional language",
  "afal",
  "efal",
  "english",
  "afrikaans",
  "isi",
  "sesotho",
  "setswana",
  "xitsonga",
  "siswati",
  "isizulu",
  "xitsonga",
  "tshivenda",
  "sepedi",
];

function detectLanguageTokens(text: string) {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const token of LANGUAGE_TOKENS) {
    const pattern = new RegExp(`\\b${token}\\b`, "i");
    if (pattern.test(lower)) hits.push(token);
  }
  return Array.from(new Set(hits));
}

function docTypeFromName(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("memo") || lower.includes("memorandum") || lower.includes("answers")) return "memo";
  if (lower.includes("assessment") || lower.includes("test") || lower.includes("exam")) return "assessment";
  if (lower.includes("worksheet") || lower.includes("activity") || lower.includes("practice")) return "worksheet";
  if (lower.includes("lesson plan") || lower.includes("lesson")) return "lesson_plan";
  if (lower.includes("story")) return "story";
  if (lower.includes("guide")) return "guide";
  return "resources";
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

function resolveSubjectKeyForFile(params: {
  outline: any;
  phase: string | null;
  grade: number | null;
  filename: string;
  folderHints: string[];
  subjectCandidate: string | null;
}) {
  if (!params.phase || params.grade === null) {
    return params.subjectCandidate ?? null;
  }
  const outlineKeys = getOutlineSubjectKeys(params.outline, params.phase, params.grade);
  if (params.subjectCandidate && outlineKeys.includes(params.subjectCandidate)) {
    return params.subjectCandidate;
  }
  if (!outlineKeys.length) {
    return params.subjectCandidate ?? null;
  }
  const resolved = resolveSubjectKey({
    phase: params.phase,
    grade: params.grade,
    filename: params.filename,
    folderHints: params.folderHints,
    outlineKeys,
  });
  return resolved.subjectKey ?? params.subjectCandidate ?? null;
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
  const outline = loadCourseOutline();
  const pdfRoots = [
    path.join(repoRoot, "content", "gde_lrip_mip_mirror"),
    path.join(repoRoot, "content", "pdf"),
  ];

  const files = (await Promise.all(pdfRoots.map((root) => walkPdfFiles(root)))).flat();
  if (!files.length) {
    console.log("No PDFs found under content/gde_lrip_mip_mirror or content/pdf.");
    return;
  }

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  const output = createWriteStream(OUTPUT_PATH, { encoding: "utf-8" });

  let chunkCount = 0;
  let noTextCount = 0;

  for (const filePath of files) {
    const relPath = relativeToRepo(filePath);
    const scanText = `${relPath} ${path.basename(filePath)}`;
    const detectedGrade = parseGradeFromPath(relPath) ?? parseGrade(scanText);
    const detectedTerm = parseTermFromPath(relPath) ?? parseTerm(scanText);
    const phase = detectedGrade !== null ? gradeToPhase(detectedGrade) : null;
    const folderHints = relPath.split("/").slice(0, -1);
    const subjectCandidate = detectSubjectFromPath(relPath);
    const detectedSubjectKey = resolveSubjectKeyForFile({
      outline,
      phase,
      grade: detectedGrade,
      filename: path.basename(filePath),
      folderHints,
      subjectCandidate,
    });

    const docType = docTypeFromName(path.basename(filePath));

    let pageTexts: string[] = [];
    try {
      pageTexts = await extractPdfPages(filePath);
    } catch (error) {
      console.warn(`Failed to parse PDF: ${relPath}`);
      console.warn(error);
      continue;
    }

    if (!pageTexts.some((text) => text.trim().length > 0)) {
      noTextCount += 1;
      continue;
    }

    for (let idx = 0; idx < pageTexts.length; idx += CHUNK_PAGES) {
      const pageStart = idx + 1;
      const pageEnd = Math.min(idx + CHUNK_PAGES, pageTexts.length);
      const chunkText = pageTexts.slice(idx, pageEnd).join(" ").replace(/\s+/g, " ").trim();
      if (!chunkText) continue;
      const languageTokens = detectLanguageTokens(chunkText);

      const record: ChunkRecord = {
        file_path: relPath,
        page_start: pageStart,
        page_end: pageEnd,
        detected_grade: detectedGrade ?? null,
        detected_term: detectedTerm ?? null,
        detected_subject_key: detectedSubjectKey ?? null,
        language_tokens: languageTokens,
        phase,
        doc_type: docType,
        text: chunkText,
      };
      output.write(`${JSON.stringify(record)}\n`);
      chunkCount += 1;
    }
  }

  await new Promise((resolve) => output.end(resolve));
  console.log(`Wrote ${chunkCount} chunks to ${OUTPUT_PATH}`);
  if (noTextCount) {
    console.log(`PDFs with no text: ${noTextCount}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
