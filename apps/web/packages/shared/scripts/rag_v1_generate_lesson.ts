import { existsSync } from "node:fs";
import {
  generateLessonV1,
  getGeneratedLessonOutputPaths,
  writeGeneratedLessonFiles,
  type RagV1GenerateInput,
} from "../src/rag_v1/generator.js";

type ArgMap = Record<string, string>;

function parseArgs(argv: string[]) {
  const args: ArgMap = {};
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw.startsWith("--")) continue;
    const [key, inlineValue] = raw.slice(2).split("=");
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = "true";
    }
  }
  return args;
}

function numberArg(args: ArgMap, key: string) {
  const value = args[key];
  if (!value) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const phase = args.phase as RagV1GenerateInput["phase"];
  const grade = numberArg(args, "grade");
  const subjectKey = args.subject || args.subjectKey;
  const term = numberArg(args, "term");
  const week = numberArg(args, "week");
  const topic = args.topic;
  const k = numberArg(args, "k");
  const force = args.force === "true";

  if (grade === null || term === null || week === null || !subjectKey || !phase) {
    console.error(
      "Usage: tsx scripts/rag_v1_generate_lesson.ts --phase foundation --grade 4 --subject maths --term 1 --week 2 [--topic \"fractions\"] [--force true]"
    );
    process.exit(1);
  }

  const input: RagV1GenerateInput = {
    phase,
    grade,
    subjectKey,
    term,
    week,
    topic,
    topK: k ?? undefined,
    force,
  };

  const paths = getGeneratedLessonOutputPaths(input);
  if (!force && existsSync(paths.lessonPath)) {
    console.log(`Lesson already exists at ${paths.lessonPath}. Use --force true to regenerate.`);
    return;
  }

  const result = await generateLessonV1(input);
  const written = writeGeneratedLessonFiles({ input, result });

  console.log(`Generated lesson at ${written.lessonPath}`);
  console.log(`Sources saved at ${written.sourcesPath}`);
  console.log(`Report saved at ${written.generationPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
