import { pool } from "./pool.js";

export type DifficultyBias = -1 | 0 | 1;

export type QuizAttemptInput = {
  learnerId: string;
  subject: string;
  grade: number;
  lessonKey: string;
  topicTag?: string | null;
  scorePercent: number;
  correctCount: number;
  totalCount: number;
};

function clampBias(value: number): DifficultyBias {
  if (value >= 1) return 1;
  if (value <= -1) return -1;
  return 0;
}

function toNumber(value: any, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export async function recordQuizAttempt(input: QuizAttemptInput) {
  const result = await pool.query(
    `
      INSERT INTO quiz_attempts (
        learner_id,
        subject,
        grade,
        lesson_key,
        topic_tag,
        score_percent,
        correct_count,
        total_count
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      input.learnerId,
      input.subject,
      input.grade,
      input.lessonKey,
      input.topicTag ?? null,
      input.scorePercent,
      input.correctCount,
      input.totalCount,
    ]
  );

  const bias = await computeDifficultyBias({
    learnerId: input.learnerId,
    subject: input.subject,
    grade: input.grade,
    topicTag: input.topicTag ?? null,
  });

  await pool.query(
    `
      INSERT INTO learner_skills (
        learner_id,
        subject,
        grade,
        topic_tag,
        difficulty_bias,
        last_attempt_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (learner_id, subject, grade, topic_tag)
      DO UPDATE SET
        difficulty_bias = EXCLUDED.difficulty_bias,
        last_attempt_at = EXCLUDED.last_attempt_at,
        updated_at = NOW()
    `,
    [input.learnerId, input.subject, input.grade, input.topicTag ?? null, bias]
  );

  return { attempt: result.rows[0], bias };
}

export async function computeDifficultyBias(options: {
  learnerId: string;
  subject: string;
  grade: number;
  topicTag?: string | null;
}) {
  const values: any[] = [options.learnerId, options.subject, options.grade];
  let topicClause = "";
  if (options.topicTag) {
    values.push(options.topicTag);
    topicClause = ` AND topic_tag = $${values.length}`;
  }

  const result = await pool.query(
    `
      SELECT score_percent
      FROM quiz_attempts
      WHERE learner_id = $1
        AND subject = $2
        AND grade = $3
        ${topicClause}
      ORDER BY created_at DESC
      LIMIT 3
    `,
    values
  );

  if (!result.rows.length) return 0 as DifficultyBias;
  const avg =
    result.rows.reduce((total, row) => total + toNumber(row.score_percent, 0), 0) /
    result.rows.length;

  if (avg >= 80) return 1 as DifficultyBias;
  if (avg <= 45) return -1 as DifficultyBias;
  return 0 as DifficultyBias;
}

export async function getLearnerSkillBias(options: {
  learnerId: string;
  subject: string;
  grade: number;
  topicTag?: string | null;
}) {
  const values: any[] = [options.learnerId, options.subject, options.grade];
  let topicClause = "";
  if (options.topicTag) {
    values.push(options.topicTag);
    topicClause = ` AND topic_tag = $${values.length}`;
  } else {
    topicClause = " AND topic_tag IS NULL";
  }

  const result = await pool.query(
    `
      SELECT difficulty_bias
      FROM learner_skills
      WHERE learner_id = $1
        AND subject = $2
        AND grade = $3
        ${topicClause}
      LIMIT 1
    `,
    values
  );

  if (!result.rows.length) {
    const computed = await computeDifficultyBias({
      learnerId: options.learnerId,
      subject: options.subject,
      grade: options.grade,
      topicTag: options.topicTag ?? null,
    });
    return clampBias(computed);
  }

  return clampBias(toNumber(result.rows[0]?.difficulty_bias, 0));
}
