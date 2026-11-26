import { pool } from "./pool.js";

export async function createDispute(input: {
  sessionId: string;
  openedBy: "learner" | "tutor";
  category: "no_show" | "quality" | "misconduct" | "billing" | "other";
  description: string;
  evidenceUploads?: string[];
}) {
  const result = await pool.query(
    `
      INSERT INTO disputes (session_id, opened_by, status, category, description, evidence_uploads)
      VALUES ($1, $2, 'open', $3, $4, $5)
      RETURNING *
    `,
    [
      input.sessionId,
      input.openedBy,
      input.category,
      input.description,
      input.evidenceUploads ?? [],
    ]
  );
  return result.rows[0];
}

export async function listDisputes(status?: string) {
  const values: any[] = [];
  const clauses: string[] = [];
  if (status) {
    values.push(status);
    clauses.push(`d.status = $${values.length}`);
  }
  const result = await pool.query(
    `
      SELECT d.*, s.tutor_id, s.learner_id, s.status as session_status
      FROM disputes d
      JOIN tutor_sessions s ON s.id = d.session_id
      ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY d.created_at DESC
    `,
    values
  );
  return result.rows;
}

export async function updateDispute(input: {
  id: string;
  status: "under_review" | "resolved" | "rejected";
  adminNotes?: string | null;
  resolvedAt?: string | null;
}) {
  const result = await pool.query(
    `
      UPDATE disputes
      SET status = $1,
          admin_notes = $2,
          resolved_at = $3,
          updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `,
    [input.status, input.adminNotes ?? null, input.resolvedAt ?? null, input.id]
  );
  return result.rows[0] ?? null;
}

export async function createRefundTransaction(input: {
  sessionId: string;
  amount: number;
  reason: string;
  status?: "pending" | "processed" | "failed";
}) {
  const result = await pool.query(
    `
      INSERT INTO refund_transactions (session_id, amount, reason, status)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [input.sessionId, input.amount, input.reason, input.status ?? "pending"]
  );
  return result.rows[0];
}

export async function addTutorStrike(input: {
  tutorId: string;
  sessionId?: string | null;
  reason: "late_cancel" | "no_show" | "misconduct" | "fraud";
  points: number;
}) {
  const result = await pool.query(
    `
      INSERT INTO tutor_strikes (tutor_id, session_id, reason, points)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [input.tutorId, input.sessionId ?? null, input.reason, input.points]
  );
  return result.rows[0];
}

export async function addTrustEvent(input: {
  actorId: string;
  sessionId?: string | null;
  type: "off_platform_attempt" | "fraud_flag" | "abuse";
  severity: "low" | "medium" | "high";
  metadata?: Record<string, unknown>;
}) {
  const result = await pool.query(
    `
      INSERT INTO trust_events (actor_id, session_id, type, severity, metadata)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [input.actorId, input.sessionId ?? null, input.type, input.severity, input.metadata ?? {}]
  );
  return result.rows[0];
}

export type TrustEventRecord = {
  id: string;
  actor_id: string;
  actor_email: string;
  actor_name: string;
  session_id: string | null;
  type: "off_platform_attempt" | "fraud_flag" | "abuse";
  severity: "low" | "medium" | "high";
  status: "new" | "in_review" | "resolved";
  assigned_admin_id: string | null;
  assigned_admin_name: string | null;
  resolved_at: string | null;
  metadata: Record<string, unknown> | null;
  updated_at: string;
  created_at: string;
};

export async function listTrustEvents(options?: {
  limit?: number;
  type?: "off_platform_attempt" | "fraud_flag" | "abuse";
  severity?: "low" | "medium" | "high";
  status?: "new" | "in_review" | "resolved";
  assignedAdminId?: string;
}): Promise<TrustEventRecord[]> {
  const limit = Math.min(Math.max(options?.limit ?? 40, 1), 100);
  const type = options?.type ?? null;
  const severity = options?.severity ?? null;
  const status = options?.status ?? null;
  const assignedAdminId = options?.assignedAdminId ?? null;
  const result = await pool.query<TrustEventRecord>(
    `SELECT
       te.id,
       te.actor_id,
       u.email AS actor_email,
       COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS actor_name,
       te.session_id,
       te.type,
       te.severity,
       te.status,
       te.assigned_admin_id,
       COALESCE(NULLIF(TRIM(admin_u.first_name || ' ' || admin_u.last_name), ''), admin_u.email) AS assigned_admin_name,
       te.resolved_at,
       te.metadata,
       te.updated_at,
       te.created_at
     FROM trust_events te
     JOIN users u ON u.id = te.actor_id
     LEFT JOIN users admin_u ON admin_u.id = te.assigned_admin_id
     WHERE ($2::text IS NULL OR te.type = $2::text)
       AND ($3::text IS NULL OR te.severity = $3::text)
       AND ($4::text IS NULL OR te.status = $4::text)
       AND ($5::uuid IS NULL OR te.assigned_admin_id = $5::uuid)
     ORDER BY te.created_at DESC
     LIMIT $1`,
    [limit, type, severity, status, assignedAdminId]
  );
  return result.rows;
}

export async function incrementLearnerRisk(userId: string, fields: { cancellations?: number; disputes?: number }) {
  const cancellations = fields.cancellations ?? 0;
  const disputes = fields.disputes ?? 0;
  await pool.query(
    `
      INSERT INTO learner_risk_scores (learner_id, cancellations, disputes)
      VALUES ($1, $2, $3)
      ON CONFLICT (learner_id)
      DO UPDATE SET
        cancellations = learner_risk_scores.cancellations + $2,
        disputes = learner_risk_scores.disputes + $3,
        updated_at = NOW()
    `,
    [userId, cancellations, disputes]
  );
}

export async function countRecentDisputes(userId: string, hours: number) {
  const result = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM disputes d
      JOIN tutor_sessions s ON s.id = d.session_id
      WHERE s.learner_id = $1 AND d.created_at >= NOW() - ($2 || ' hours')::interval
    `,
    [userId, hours]
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function countRecentCancellations(userId: string, hours: number) {
  const result = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM tutor_sessions
      WHERE learner_id = $1
        AND status IN ('cancelled_by_learner')
        AND cancelled_at >= NOW() - ($2 || ' hours')::interval
    `,
    [userId, hours]
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function recordLessonEngagement(input: {
  learnerId: string;
  lessonKey: string;
  openedAt: string;
  timeSpentSeconds: number;
  completed: boolean;
}) {
  const result = await pool.query(
    `
      INSERT INTO lesson_engagements (learner_id, lesson_key, opened_at, time_spent_seconds, completed)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [input.learnerId, input.lessonKey, input.openedAt, input.timeSpentSeconds, input.completed]
  );

  if (input.completed) {
    // Award XP: 50 XP for completing a lesson
    await pool.query(
      `INSERT INTO user_xp_ledger (user_id, amount, action_type, metadata) VALUES ($1, $2, $3, $4)`,
      [input.learnerId, 50, 'LESSON_COMPLETE', JSON.stringify({ lessonKey: input.lessonKey })]
    );
  }

  return result.rows[0];
}

export async function recordQuizAttemptV2(input: {
  learnerId: string;
  lessonKey: string;
  subject: string;
  grade: number;
  scorePercent: number;
  timeSpentSeconds: number;
  answersJson: Record<string, unknown>;
}) {
  const result = await pool.query(
    `
      INSERT INTO quiz_attempts_v2 (learner_id, lesson_key, subject, grade, score_percent, time_spent_seconds, answers_json)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [
      input.learnerId,
      input.lessonKey,
      input.subject,
      input.grade,
      input.scorePercent,
      input.timeSpentSeconds,
      input.answersJson,
    ]
  );
  const attempt = result.rows[0];

  // Award XP: 100 XP base + score bonus
  const xpAmount = 100 + Math.round(input.scorePercent);
  await pool.query(
    `INSERT INTO user_xp_ledger (user_id, amount, action_type, metadata) VALUES ($1, $2, $3, $4)`,
    [input.learnerId, xpAmount, 'QUIZ_COMPLETE', JSON.stringify({ lessonKey: input.lessonKey, score: input.scorePercent })]
  );

  if (input.scorePercent < 70) {
    const days = input.scorePercent < 40 ? 1 : input.scorePercent < 55 ? 3 : 7;
    await pool.query(
      `
        INSERT INTO learner_spaced_reviews (
          learner_id,
          lesson_key,
          subject,
          grade,
          next_review_at,
          score_percent,
          status,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, NOW() + ($5 || ' days')::interval, $6, 'pending', NOW(), NOW())
        ON CONFLICT (learner_id, lesson_key)
        DO UPDATE SET
          subject = EXCLUDED.subject,
          grade = EXCLUDED.grade,
          next_review_at = EXCLUDED.next_review_at,
          score_percent = EXCLUDED.score_percent,
          status = 'pending',
          updated_at = NOW()
      `,
      [input.learnerId, input.lessonKey, input.subject, input.grade, String(days), input.scorePercent]
    );
  } else if (input.scorePercent >= 85) {
    await pool.query(
      `
        UPDATE learner_spaced_reviews
        SET status = 'done',
            score_percent = $3,
            updated_at = NOW()
        WHERE learner_id = $1
          AND lesson_key = $2
      `,
      [input.learnerId, input.lessonKey, input.scorePercent]
    );
  }

  return attempt;
}

export async function listSpacedReviews(userId: string, options?: { dueOnly?: boolean; limit?: number }) {
  const dueOnly = Boolean(options?.dueOnly);
  const limit = Math.min(options?.limit ?? 20, 100);
  const result = await pool.query(
    `
      SELECT id,
             lesson_key,
             subject,
             grade,
             next_review_at,
             score_percent,
             status,
             created_at,
             updated_at
      FROM learner_spaced_reviews
      WHERE learner_id = $1
        AND status = 'pending'
        AND ($2::boolean = false OR next_review_at <= NOW())
      ORDER BY next_review_at ASC
      LIMIT $3
    `,
    [userId, dueOnly, limit]
  );
  return result.rows;
}

export async function setSpacedReviewStatus(input: {
  userId: string;
  reviewId: string;
  status: "done" | "dismissed";
}) {
  const result = await pool.query(
    `
      UPDATE learner_spaced_reviews
      SET status = $3,
          updated_at = NOW()
      WHERE id = $1
        AND learner_id = $2
      RETURNING id, lesson_key, status, updated_at
    `,
    [input.reviewId, input.userId, input.status]
  );
  return result.rows[0] ?? null;
}

export async function upsertLessonCheckpoint(input: {
  learnerId: string;
  lessonKey: string;
  sectionKey: string;
  completed: boolean;
  notes?: string | null;
}) {
  const result = await pool.query(
    `
      INSERT INTO lesson_checkpoints (learner_id, lesson_key, section_key, completed, notes, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (learner_id, lesson_key, section_key)
      DO UPDATE SET
        completed = EXCLUDED.completed,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING learner_id, lesson_key, section_key, completed, notes, updated_at
    `,
    [input.learnerId, input.lessonKey, input.sectionKey, input.completed, input.notes ?? null]
  );
  return result.rows[0] ?? null;
}

export async function listLessonCheckpoints(input: { learnerId: string; lessonKey: string }) {
  const result = await pool.query(
    `
      SELECT learner_id, lesson_key, section_key, completed, notes, updated_at
      FROM lesson_checkpoints
      WHERE learner_id = $1
        AND lesson_key = $2
      ORDER BY section_key ASC
    `,
    [input.learnerId, input.lessonKey]
  );
  return result.rows;
}

export async function getLearnerRecommendations(userId: string, limit = 6) {
  const boundedLimit = Math.min(Math.max(limit, 1), 20);
  const result = await pool.query(
    `
      SELECT lesson_key,
             subject,
             grade,
             AVG(score_percent)::float AS avg_score,
             MAX(created_at) AS last_attempt_at,
             COUNT(*)::int AS attempts
      FROM quiz_attempts_v2
      WHERE learner_id = $1
      GROUP BY lesson_key, subject, grade
      HAVING AVG(score_percent) < 75
      ORDER BY avg_score ASC, last_attempt_at DESC
      LIMIT $2
    `,
    [userId, boundedLimit]
  );
  return result.rows.map((row) => ({
    lessonKey: row.lesson_key as string,
    subject: row.subject as string,
    grade: Number(row.grade),
    avgScore: Number(row.avg_score),
    attempts: Number(row.attempts),
    reason: Number(row.avg_score) < 55 ? "Low mastery" : "Needs reinforcement",
  }));
}

export async function getLearnerProgressSummary(userId: string) {
  const scores = await pool.query(
    `
      SELECT lesson_key, score_percent, created_at
      FROM quiz_attempts_v2
      WHERE learner_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `,
    [userId]
  );
  const engagement = await pool.query(
    `
      SELECT lesson_key, time_spent_seconds, created_at
      FROM lesson_engagements
      WHERE learner_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `,
    [userId]
  );
  const stats = await pool.query(
    `
      SELECT
        COALESCE(AVG(score_percent)::float, 0) AS avg_score,
        COUNT(*)::int AS attempts
      FROM quiz_attempts_v2
      WHERE learner_id = $1
    `,
    [userId]
  );
  const dueReviews = await listSpacedReviews(userId, { dueOnly: true, limit: 10 });
  const recommendations = await getLearnerRecommendations(userId, 6);
  return {
    scores: scores.rows,
    engagement: engagement.rows,
    stats: {
      avgScore: Number(stats.rows[0]?.avg_score ?? 0),
      attempts: Number(stats.rows[0]?.attempts ?? 0),
    },
    dueReviews,
    recommendations,
  };
}

export async function getAdminAnalyticsSummary() {
  const scores = await pool.query(
    `
      SELECT subject, grade, AVG(score_percent)::float AS avg_score, COUNT(*)::int AS attempts
      FROM quiz_attempts_v2
      GROUP BY subject, grade
      ORDER BY grade, subject
    `
  );
  const engagement = await pool.query(
    `
      SELECT lesson_key, COUNT(*)::int AS opens, AVG(time_spent_seconds)::float AS avg_time
      FROM lesson_engagements
      GROUP BY lesson_key
      ORDER BY opens DESC
      LIMIT 50
    `
  );
  return { scores: scores.rows, engagement: engagement.rows };
}
