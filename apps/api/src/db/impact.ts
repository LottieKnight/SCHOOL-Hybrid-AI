import { pool } from "./pool.js";

export type ImpactRange = "7d" | "30d";

type AttemptsPerDayRow = {
  day: string;
  attempts: string | number;
};

type InclusionSummaryRow = {
  lite_mode_usage_percent: string | number;
  median_unlock_payload_size: string | number;
  median_learn_payload_size_proxy: string | number;
  unlock_payload_sample_count: string | number;
  learn_payload_sample_count: string | number;
  active_users: string | number;
};

function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeRangeDays(range: ImpactRange) {
  return range === "30d" ? 30 : 7;
}

export async function getImpactSummary(range: ImpactRange) {
  const rangeDays = normalizeRangeDays(range);

  const activitySummary = await pool.query<{
    dau: string | number;
    wau: string | number;
    active_users: string | number;
  }>(
    `WITH activity AS (
       SELECT learner_id AS user_id, created_at
       FROM quiz_attempts_v2
       WHERE created_at >= NOW() - ($1::text || ' days')::interval
       UNION ALL
       SELECT learner_id AS user_id, created_at
       FROM lesson_engagements
       WHERE created_at >= NOW() - ($1::text || ' days')::interval
       UNION ALL
       SELECT sender_id AS user_id, created_at
       FROM messages
       WHERE created_at >= NOW() - ($1::text || ' days')::interval
       UNION ALL
       SELECT user_id, created_at
       FROM product_events
       WHERE user_id IS NOT NULL
         AND created_at >= NOW() - ($1::text || ' days')::interval
     )
     SELECT
       COUNT(DISTINCT CASE WHEN created_at >= NOW() - INTERVAL '1 day' THEN user_id END)::int AS dau,
       COUNT(DISTINCT CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN user_id END)::int AS wau,
       COUNT(DISTINCT user_id)::int AS active_users
     FROM activity`,
    [String(rangeDays)]
  );

  const attemptsPerDay = await pool.query<AttemptsPerDayRow>(
    `WITH days AS (
       SELECT generate_series(
         date_trunc('day', NOW() - ($1::text || ' days')::interval),
         date_trunc('day', NOW()),
         INTERVAL '1 day'
       ) AS day
     ),
     counts AS (
       SELECT date_trunc('day', created_at) AS day, COUNT(*)::int AS attempts
       FROM quiz_attempts_v2
       WHERE created_at >= NOW() - ($1::text || ' days')::interval
       GROUP BY date_trunc('day', created_at)
     )
     SELECT to_char(days.day, 'YYYY-MM-DD') AS day, COALESCE(counts.attempts, 0)::int AS attempts
     FROM days
     LEFT JOIN counts ON counts.day = days.day
     ORDER BY days.day ASC`,
    [String(rangeDays)]
  );

  const improvement = await pool.query<{
    avg_improvement: string | number;
    pair_count: string | number;
    total_positive_improvement: string | number;
  }>(
    `WITH ranked AS (
       SELECT
         learner_id,
         lesson_key,
         score_percent::float AS score,
         ROW_NUMBER() OVER (
           PARTITION BY learner_id, lesson_key
           ORDER BY created_at ASC
         ) AS rn
       FROM quiz_attempts_v2
       WHERE created_at >= NOW() - ($1::text || ' days')::interval
     ),
     paired AS (
       SELECT
         first_attempt.learner_id,
         first_attempt.lesson_key,
         (second_attempt.score - first_attempt.score) AS improvement
       FROM ranked first_attempt
       JOIN ranked second_attempt
         ON second_attempt.learner_id = first_attempt.learner_id
        AND second_attempt.lesson_key = first_attempt.lesson_key
        AND first_attempt.rn = 1
        AND second_attempt.rn = 2
     )
     SELECT
       COALESCE(AVG(improvement), 0)::float AS avg_improvement,
       COUNT(*)::int AS pair_count,
       COALESCE(SUM(GREATEST(improvement, 0)), 0)::float AS total_positive_improvement
     FROM paired`,
    [String(rangeDays)]
  );

  const unlockAndAttemptTotals = await pool.query<{
    unlock_count: string | number;
    attempts_total: string | number;
  }>(
    `SELECT
       COALESCE((
         SELECT COUNT(*)::int
         FROM wallet_ledger_entries
         WHERE type = 'DEBIT'
           AND ref_type = 'past_paper_detailed_report'
           AND created_at >= NOW() - ($1::text || ' days')::interval
       ), 0) AS unlock_count,
       COALESCE((
         SELECT COUNT(*)::int
         FROM quiz_attempts_v2
         WHERE created_at >= NOW() - ($1::text || ' days')::interval
       ), 0) AS attempts_total`,
    [String(rangeDays)]
  );

  const liteModeUsage = await pool.query<{
    lite_mode_percent: string | number;
    lite_mode_users: string | number;
  }>(
    `WITH activity AS (
       SELECT learner_id AS user_id
       FROM quiz_attempts_v2
       WHERE created_at >= NOW() - ($1::text || ' days')::interval
       UNION
       SELECT learner_id AS user_id
       FROM lesson_engagements
       WHERE created_at >= NOW() - ($1::text || ' days')::interval
       UNION
       SELECT sender_id AS user_id
       FROM messages
       WHERE created_at >= NOW() - ($1::text || ' days')::interval
       UNION
       SELECT user_id
       FROM product_events
       WHERE user_id IS NOT NULL
         AND created_at >= NOW() - ($1::text || ' days')::interval
     )
     SELECT
       COALESCE(
         100.0 * SUM(CASE WHEN up.lite_mode THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
         0
       )::float AS lite_mode_percent,
       COALESCE(SUM(CASE WHEN up.lite_mode THEN 1 ELSE 0 END), 0)::int AS lite_mode_users
     FROM activity
     LEFT JOIN user_profiles up ON up.user_id = activity.user_id`,
    [String(rangeDays)]
  );

  const ttiProxy = await pool.query<{
    median_tti_proxy_ms: string | number;
    tti_sample_count: string | number;
  }>(
    `SELECT
       COALESCE(
         percentile_cont(0.5) WITHIN GROUP (
           ORDER BY (metadata->>'ttiMs')::numeric
         ),
         0
       )::float AS median_tti_proxy_ms,
       COUNT(*)::int AS tti_sample_count
     FROM product_events
     WHERE event_name = 'perf_page_load'
       AND created_at >= NOW() - ($1::text || ' days')::interval
       AND (metadata->>'ttiMs') ~ '^[0-9]+(\\.[0-9]+)?$'`,
    [String(rangeDays)]
  );

  const creditsSpent = await pool.query<{
    credits_spent_total: string | number;
  }>(
    `SELECT
       COALESCE(SUM(amount_credits), 0)::bigint AS credits_spent_total
     FROM wallet_ledger_entries
     WHERE type = 'DEBIT'
       AND created_at >= NOW() - ($1::text || ' days')::interval`,
    [String(rangeDays)]
  );

  const activityRow = activitySummary.rows[0];
  const improvementRow = improvement.rows[0];
  const unlockRow = unlockAndAttemptTotals.rows[0];
  const liteModeRow = liteModeUsage.rows[0];
  const ttiRow = ttiProxy.rows[0];
  const creditRow = creditsSpent.rows[0];

  const attemptsTotal = toNumber(unlockRow?.attempts_total);
  const unlockCount = toNumber(unlockRow?.unlock_count);
  const unlockConversionRatePercent =
    attemptsTotal > 0 ? (unlockCount / attemptsTotal) * 100 : 0;

  const totalPositiveImprovement = toNumber(improvementRow?.total_positive_improvement);
  const creditsSpentTotal = toNumber(creditRow?.credits_spent_total);
  const creditsSpentPerImprovementUnit =
    totalPositiveImprovement > 0 ? creditsSpentTotal / totalPositiveImprovement : 0;

  return {
    range,
    rangeDays,
    generatedAt: new Date().toISOString(),
    dau: toNumber(activityRow?.dau),
    wau: toNumber(activityRow?.wau),
    activeUsers: toNumber(activityRow?.active_users),
    attemptsSubmittedPerDay: attemptsPerDay.rows.map((row) => ({
      day: row.day,
      attempts: toNumber(row.attempts),
    })),
    avgScoreImprovementAttempt1To2: toNumber(improvementRow?.avg_improvement),
    improvementPairCount: toNumber(improvementRow?.pair_count),
    unlockConversionRatePercent,
    liteModeUsagePercent: toNumber(liteModeRow?.lite_mode_percent),
    liteModeUsers: toNumber(liteModeRow?.lite_mode_users),
    medianTtiProxyMs: toNumber(ttiRow?.median_tti_proxy_ms),
    ttiSampleCount: toNumber(ttiRow?.tti_sample_count),
    creditsSpentTotal,
    creditsSpentPerImprovementUnit,
    unlockCount,
    attemptsTotal,
  };
}

export async function getImpactInclusionSummary(range: ImpactRange) {
  const rangeDays = normalizeRangeDays(range);
  const result = await pool.query<InclusionSummaryRow>(
    `WITH scoped_events AS (
       SELECT user_id, event_name, metadata
       FROM product_events
       WHERE created_at >= NOW() - ($1::text || ' days')::interval
     ),
     active_users AS (
       SELECT DISTINCT user_id
       FROM scoped_events
       WHERE user_id IS NOT NULL
         AND event_name IN ('perf_page_load', 'lite_mode_session', 'past_paper_unlock')
     ),
     lite_users AS (
       SELECT DISTINCT user_id
       FROM scoped_events
       WHERE user_id IS NOT NULL
         AND (
           event_name = 'lite_mode_session'
           OR (
             event_name = 'perf_page_load'
             AND COALESCE(metadata->>'liteMode', 'false') = 'true'
           )
         )
     ),
     unlock_payload AS (
       SELECT (metadata->>'payloadBytes')::numeric AS payload_bytes
       FROM scoped_events
       WHERE event_name = 'past_paper_unlock'
         AND (metadata->>'payloadBytes') ~ '^[0-9]+(\\.[0-9]+)?$'
     ),
     learn_payload AS (
       SELECT (metadata->>'payloadBytes')::numeric AS payload_bytes
       FROM scoped_events
       WHERE event_name = 'perf_page_load'
         AND COALESCE(metadata->>'route', '') LIKE '/learn%'
         AND (metadata->>'payloadBytes') ~ '^[0-9]+(\\.[0-9]+)?$'
     )
     SELECT
       COALESCE(
         100.0 * (SELECT COUNT(*) FROM lite_users)
           / NULLIF((SELECT COUNT(*) FROM active_users), 0),
         0
       )::float AS lite_mode_usage_percent,
       COALESCE(
         (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY payload_bytes) FROM unlock_payload),
         0
       )::float AS median_unlock_payload_size,
       COALESCE(
         (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY payload_bytes) FROM learn_payload),
         0
       )::float AS median_learn_payload_size_proxy,
       (SELECT COUNT(*)::int FROM unlock_payload) AS unlock_payload_sample_count,
       (SELECT COUNT(*)::int FROM learn_payload) AS learn_payload_sample_count,
       (SELECT COUNT(*)::int FROM active_users) AS active_users`,
    [String(rangeDays)]
  );

  const row = result.rows[0] ?? {
    lite_mode_usage_percent: 0,
    median_unlock_payload_size: 0,
    median_learn_payload_size_proxy: 0,
    unlock_payload_sample_count: 0,
    learn_payload_sample_count: 0,
    active_users: 0,
  };

  return {
    range,
    rangeDays,
    generatedAt: new Date().toISOString(),
    liteModeUsagePercent: toNumber(row.lite_mode_usage_percent),
    medianUnlockPayloadSize: toNumber(row.median_unlock_payload_size),
    medianLearnPayloadSizeProxy: toNumber(row.median_learn_payload_size_proxy),
    unlockPayloadSampleCount: toNumber(row.unlock_payload_sample_count),
    learnPayloadSampleCount: toNumber(row.learn_payload_sample_count),
    activeUsers: toNumber(row.active_users),
  };
}
