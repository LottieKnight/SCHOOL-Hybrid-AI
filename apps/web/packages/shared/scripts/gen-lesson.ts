import { generateAiLesson } from "../src/gen/lessonGenerator";
import { getDbPool, closeDbPool } from "../src/gen/db";

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

async function findWeekNodeId(input: {
  phase: string;
  grade: number;
  subjectKey: string;
  term: number;
  week: number;
}) {
  const pool = getDbPool();
  const result = await pool.query<{ id: string }>(
    "SELECT id FROM curriculum_nodes WHERE type = 'WEEK' AND metadata->>'phase' = $1 AND metadata->>'grade' = $2 AND metadata->>'subjectKey' = $3 AND metadata->>'term' = $4 AND metadata->>'week' = $5 LIMIT 1",
    [input.phase, String(input.grade), input.subjectKey, String(input.term), String(input.week)]
  );
  return result.rows[0]?.id ?? null;
}

async function nextLessonVersion(input: {
  phase: string;
  grade: number;
  subjectKey: string;
  term: number;
  week: number;
}) {
  const pool = getDbPool();
  const result = await pool.query<{ max_version: number | null }>(
    "SELECT MAX(version) AS max_version FROM lessons WHERE phase = $1 AND grade = $2 AND subject_key = $3 AND term = $4 AND week = $5",
    [input.phase, input.grade, input.subjectKey, input.term, input.week]
  );
  const maxVersion = result.rows[0]?.max_version ?? 0;
  return Number.isFinite(maxVersion) ? maxVersion + 1 : 1;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const phase = args.phase;
  const grade = numberArg(args, "grade");
  const term = numberArg(args, "term");
  const week = numberArg(args, "week");
  const subjectKey = args.subjectKey || args.subject;
  const topic = args.topic;

  if (!phase || grade === null || term === null || week === null || !subjectKey) {
    console.error(
      "Usage: tsx scripts/gen-lesson.ts --phase foundation --grade 3 --subjectKey mathematics --term 1 --week 2 [--topic \"fractions\"]"
    );
    process.exit(1);
  }

  const result = await generateAiLesson({
    phase: phase as any,
    grade,
    subjectKey,
    term,
    week,
    topic,
  });

  const pool = getDbPool();
  const nodeId = await findWeekNodeId({ phase, grade, subjectKey, term, week });
  const version = await nextLessonVersion({ phase, grade, subjectKey, term, week });
  const insert = await pool.query<{ id: string }>(
    "INSERT INTO lessons (node_id, phase, grade, subject_key, term, week, title, topic, content, version, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PUBLISHED') RETURNING id",
    [
      nodeId,
      phase,
      grade,
      subjectKey,
      term,
      week,
      result.content.title,
      result.content.topic,
      JSON.stringify(result.content),
      version,
    ]
  );

  await closeDbPool();
  console.log(`Generated lesson ${insert.rows[0]?.id ?? ""} (v${version})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
