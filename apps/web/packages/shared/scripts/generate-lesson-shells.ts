import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pdfParse from "pdf-parse";
import { generateQuiz } from "../src/quiz-generator.js";
import { getLessonJsonRoot } from "../src/lesson-content.js";

type ShellLesson = {
  isShell: true;
  grade: number;
  subject: string;
  term: number;
  week: number;
  topic: string;
  summary: string;
  keyPoints: string[];
  resources: { title: string; sourcePdfPath: string }[];
  quiz: { questions: any[] };
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function normalizeFilePath(filePath: string) {
  return filePath.split(path.sep).join("/");
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function resolvePdfRoot() {
  const override = process.env.LESSON_PDF_ROOT;
  if (override) return override;
  const candidates = [
    path.join(repoRoot, "content", "pdf"),
    path.join(process.cwd(), "content", "pdf"),
    path.join(process.cwd(), "..", "content", "pdf"),
    path.join(process.cwd(), "..", "..", "content", "pdf"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

function splitSentences(text: string) {
  return text
    .replace(/\r/g, " ")
    .replace(/\n+/g, " ")
    .split(/(?<=[.?!])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function pickKeyPoints(text: string, limit: number) {
  const sentences = splitSentences(text);
  const points: string[] = [];
  for (const sentence of sentences) {
    if (!points.includes(sentence)) {
      points.push(sentence);
    }
    if (points.length >= limit) break;
  }
  return points;
}

async function extractTextFromPdf(filePath: string) {
  const buffer = await fs.readFile(filePath);
  const data = await pdfParse(buffer);
  return data.text || "";
}

async function extractTextForWeek(pdfFiles: string[], maxChars: number) {
  const lessonPdf = pdfFiles.find((file) => path.basename(file).toLowerCase() === "lesson.pdf");
  if (lessonPdf) {
    const text = await extractTextFromPdf(lessonPdf);
    return text.slice(0, maxChars);
  }

  let combined = "";
  const sorted = [...pdfFiles].sort((a, b) => a.localeCompare(b));
  for (const filePath of sorted) {
    const text = await extractTextFromPdf(filePath);
    combined += ` ${text}`;
    if (combined.length >= maxChars) break;
  }
  return combined.slice(0, maxChars);
}

async function walkWeekFolders(root: string) {
  const folders: string[] = [];
  if (!existsSync(root)) return folders;
  const phases = await fs.readdir(root, { withFileTypes: true });
  for (const phaseEntry of phases) {
    if (!phaseEntry.isDirectory()) continue;
    if (phaseEntry.name.startsWith("_") || phaseEntry.name.toLowerCase() === "unmapped") continue;
    const phasePath = path.join(root, phaseEntry.name);
    const gradeDirs = await fs.readdir(phasePath, { withFileTypes: true });
    for (const gradeEntry of gradeDirs) {
      if (!gradeEntry.isDirectory() || !gradeEntry.name.startsWith("grade-")) continue;
      const gradePath = path.join(phasePath, gradeEntry.name);
      const subjectDirs = await fs.readdir(gradePath, { withFileTypes: true });
      for (const subjectEntry of subjectDirs) {
        if (!subjectEntry.isDirectory()) continue;
        const subjectPath = path.join(gradePath, subjectEntry.name);
        const termDirs = await fs.readdir(subjectPath, { withFileTypes: true });
        for (const termEntry of termDirs) {
          if (!termEntry.isDirectory() || !termEntry.name.startsWith("term-")) continue;
          const termPath = path.join(subjectPath, termEntry.name);
          const weekDirs = await fs.readdir(termPath, { withFileTypes: true });
          for (const weekEntry of weekDirs) {
            if (!weekEntry.isDirectory() || !weekEntry.name.startsWith("week-")) continue;
            folders.push(path.join(termPath, weekEntry.name));
          }
        }
      }
    }
  }
  return folders;
}

async function main() {
  const pdfRoot = resolvePdfRoot();
  const lessonRoot = getLessonJsonRoot();
  const weekFolders = await walkWeekFolders(pdfRoot);
  const generated: string[] = [];

  for (const folderPath of weekFolders) {
    const relPath = normalizeFilePath(path.relative(pdfRoot, folderPath));
    const segments = relPath.split("/");
    if (segments.length < 5) continue;
    const [phase, gradeSegment, subjectKey, termSegment, weekSegment] = segments;
    if (!gradeSegment.startsWith("grade-") || !termSegment.startsWith("term-") || !weekSegment.startsWith("week-")) {
      continue;
    }
    const gradeNumber = Number(gradeSegment.replace("grade-", ""));
    const term = Number(termSegment.replace("term-", ""));
    const week = Number(weekSegment.replace("week-", ""));
    if (!Number.isFinite(gradeNumber) || !Number.isFinite(term) || !Number.isFinite(week)) continue;

    const lessonPath = path.join(
      lessonRoot,
      `grade-${pad2(gradeNumber)}`,
      subjectKey,
      `term-${pad2(term)}`,
      `week-${pad2(week)}.json`
    );
    if (existsSync(lessonPath)) continue;

    const shellPath = path.join(
      lessonRoot,
      `grade-${pad2(gradeNumber)}`,
      subjectKey,
      `term-${pad2(term)}`,
      `week-${pad2(week)}.shell.json`
    );
    if (existsSync(shellPath)) continue;

    const files = await fs.readdir(folderPath, { withFileTypes: true });
    const pdfFiles = files
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"))
      .map((entry) => path.join(folderPath, entry.name));
    if (!pdfFiles.length) continue;

    const extractedText = (await extractTextForWeek(pdfFiles, 12000)).trim();
    const sentences = splitSentences(extractedText);
    const topic =
      sentences[0]?.slice(0, 120) ||
      `${subjectKey.replace(/-/g, " ")} week ${week}`;
    const summary = sentences.slice(0, 2).join(" ") || `Auto-generated preview for week ${week}.`;
    const keyPoints = pickKeyPoints(extractedText, 5);
    const quiz = generateQuiz(extractedText, gradeNumber);

    const resources = pdfFiles.map((filePath) => ({
      title: path.basename(filePath),
      sourcePdfPath: normalizeFilePath(path.relative(pdfRoot, filePath)),
    }));

    const shellLesson: ShellLesson = {
      isShell: true,
      grade: gradeNumber,
      subject: subjectKey,
      term,
      week,
      topic,
      summary,
      keyPoints,
      resources,
      quiz,
    };

    await fs.mkdir(path.dirname(shellPath), { recursive: true });
    await fs.writeFile(shellPath, JSON.stringify(shellLesson, null, 2));
    generated.push(shellPath);
  }

  console.log(`Generated ${generated.length} shell lessons.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
