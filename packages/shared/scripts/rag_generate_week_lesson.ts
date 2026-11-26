import { generateRagWeekLesson } from "../src/rag/generator.js";

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
  const phase = args.phase as any;
  const grade = numberArg(args, "grade");
  const subjectKey = args.subject || args.subjectKey;
  const term = numberArg(args, "term");
  const week = numberArg(args, "week");
  const topic = args.topic;
  const k = numberArg(args, "k");

  if (grade === null || term === null || week === null || !subjectKey) {
    console.error(
      "Usage: tsx scripts/rag_generate_week_lesson.ts --phase foundation --grade 4 --subject maths --term 1 --week 2 [--topic \"fractions\"]"
    );
    process.exit(1);
  }

  const result = await generateRagWeekLesson({
    phase,
    grade,
    subjectKey,
    term,
    week,
    topic,
    k: k ?? undefined,
  });

  console.log(`Generated lesson at ${result.filePath}`);
  console.log(`Report saved at ${result.reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
