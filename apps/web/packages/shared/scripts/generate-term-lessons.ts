import { generateWeekLesson } from "../src/lesson-generator.js";

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
  const grade = numberArg(args, "grade");
  const term = numberArg(args, "term");
  const subject = args.subject;
  const phase = args.phase as any;
  const topic = args.topic;
  const topK = numberArg(args, "topK");
  const startWeek = numberArg(args, "startWeek") ?? 1;
  const endWeek = numberArg(args, "endWeek") ?? 10;
  const indexPath = args.indexPath;
  const model = args.model;

  if (grade === null || term === null || !subject) {
    console.error(
      "Usage: tsx scripts/generate-term-lessons.ts --grade 4 --subject maths --term 1 [--phase foundation] [--startWeek 1 --endWeek 10]"
    );
    process.exit(1);
  }

  for (let week = startWeek; week <= endWeek; week += 1) {
    console.log(`Generating week ${week}...`);
    await generateWeekLesson(
      {
        phase,
        grade,
        subject,
        term,
        week,
        topic,
        topK: topK ?? undefined,
      },
      { indexPath, model }
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
