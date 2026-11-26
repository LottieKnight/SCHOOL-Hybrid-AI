import { promises as fs } from "node:fs";
import path from "node:path";
import { LessonSchema, getLessonJsonRoot } from "../src/lesson-content.js";
import { z } from "zod";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

async function walkJsonFiles(root: string) {
  const files: string[] = [];
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkJsonFiles(fullPath)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
      files.push(fullPath);
    }
  }
  return files;
}

function resolvePdfRoot() {
  const override = process.env.LESSON_PDF_ROOT;
  if (override) return override;
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
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

function validateQuiz(lesson: any, filePath: string) {
  const errors: string[] = [];
  const quiz = lesson.quiz;
  if (!quiz?.questions || quiz.questions.length < 6) {
    errors.push(`Quiz must contain at least 6 questions (${quiz?.questions?.length ?? 0})`);
  }
  quiz?.questions?.forEach((question: any, index: number) => {
    if (!question.prompt) errors.push(`Question ${index + 1} has empty prompt`);
    if (!question.answer) errors.push(`Question ${index + 1} has empty answer`);
    if (!question.explanation) errors.push(`Question ${index + 1} has empty explanation`);
    if (question.type === "mcq") {
      if (!Array.isArray(question.options) || question.options.length < 3 || question.options.length > 5) {
        errors.push(`Question ${index + 1} MCQ must have 3-5 options`);
      }
    }
  });
  if (errors.length) {
    throw new Error(`${filePath}\n  - ${errors.join("\n  - ")}`);
  }
}

const ShellLessonSchema = z.object({
  isShell: z.literal(true),
  grade: z.number(),
  subject: z.string(),
  term: z.number(),
  week: z.number(),
  topic: z.string(),
  summary: z.string(),
  keyPoints: z.array(z.string()),
  resources: z.array(
    z.object({
      title: z.string(),
      sourcePdfPath: z.string(),
    })
  ),
  quiz: z.object({
    questions: z.array(z.any()),
  }),
});

function validateShellQuiz(lesson: any, filePath: string) {
  const errors: string[] = [];
  const quiz = lesson.quiz;
  if (!quiz?.questions || quiz.questions.length < 5) {
    errors.push(`Quiz must contain at least 5 questions (${quiz?.questions?.length ?? 0})`);
  }
  quiz?.questions?.forEach((question: any, index: number) => {
    if (!question.prompt) errors.push(`Question ${index + 1} has empty prompt`);
    if (!question.answer) errors.push(`Question ${index + 1} has empty answer`);
    if (!question.explanation) errors.push(`Question ${index + 1} has empty explanation`);
    if (question.type === "mcq") {
      if (!Array.isArray(question.options) || question.options.length < 3 || question.options.length > 5) {
        errors.push(`Question ${index + 1} MCQ must have 3-5 options`);
      }
    }
  });
  if (errors.length) {
    throw new Error(`${filePath}\n  - ${errors.join("\n  - ")}`);
  }
}

async function main() {
  const root = getLessonJsonRoot();
  const pdfRoot = resolvePdfRoot();
  const files = await walkJsonFiles(root);
  const errors: string[] = [];

  const lessonFiles = files.filter((file) => /[\\/]+term-\d+[\\/]+week-\d+\.json$/i.test(file));
  const shellFiles = files.filter((file) => /[\\/]+term-\d+[\\/]+week-\d+\.shell\.json$/i.test(file));
  for (const file of lessonFiles) {
    try {
      const raw = await fs.readFile(file, "utf-8");
      const data = LessonSchema.parse(JSON.parse(raw));
      validateQuiz(data, file);
      if (Array.isArray(data.resources)) {
        data.resources.forEach((resource: any) => {
          if (!resource?.sourcePdfPath) return;
          const absPath = path.join(pdfRoot, resource.sourcePdfPath);
          if (!existsSync(absPath)) {
            throw new Error(`${file}\n  - Missing resource file: ${resource.sourcePdfPath}`);
          }
        });
      }
    } catch (error: any) {
      errors.push(error?.message || String(error));
    }
  }

  for (const file of shellFiles) {
    try {
      const raw = await fs.readFile(file, "utf-8");
      const data = ShellLessonSchema.parse(JSON.parse(raw));
      validateShellQuiz(data, file);
      if (Array.isArray(data.resources)) {
        data.resources.forEach((resource: any) => {
          if (!resource?.sourcePdfPath) return;
          const absPath = path.join(pdfRoot, resource.sourcePdfPath);
          if (!existsSync(absPath)) {
            throw new Error(`${file}\n  - Missing resource file: ${resource.sourcePdfPath}`);
          }
        });
      }
    } catch (error: any) {
      errors.push(error?.message || String(error));
    }
  }

  if (errors.length) {
    console.error("Lesson validation failed:");
    errors.forEach((error) => console.error(error));
    process.exit(1);
  }

  console.log(`Validated ${lessonFiles.length} lesson files and ${shellFiles.length} shell files.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
