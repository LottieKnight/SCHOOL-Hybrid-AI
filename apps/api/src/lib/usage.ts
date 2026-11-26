// apps/api/src/lib/usage.ts
//
// Durable institutional usage telemetry (Phase 3).
//
// Provides (a) the write-side collector used by auth/activity/AI paths to
// increment daily rollups and record AI token/cost accounting, and (b) the
// read-side dashboard queries for institutional usage, seat utilisation and AI
// spend. All reads are scoped by institution_id so multi-tenant isolation holds
// regardless of caller (JWT admin / read:analytics API key / superadmin).

import { pool } from "../db/pool.js";

export interface DailyUsageRow {
  institutionId: string;
  day: string;
  activeUsers: number;
  logins: number;
  sessions: number;
  lessonEngagements: number;
  aiRequests: number;
}

// ---------------------------------------------------------------- write-side

/** Bump counters on the daily rollup for an institution (idempotent upsert). */
export async function recordDailyUsage(
  institutionId: string,
  bump: Partial<{ activeUsers: number; logins: number; sessions: number; lessonEngagements: number; aiRequests: number }> = {}
): Promise<void> {
  const inc = (v: number | undefined) => v ?? 0;
  await pool.query(
    `INSERT INTO institution_usage_daily (institution_id, day, active_users, logins, sessions, lesson_engagements, ai_requests)
     VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6)
     ON CONFLICT (institution_id, day) DO UPDATE SET
       active_users    = institution_usage_daily.active_users    + EXCLUDED.active_users,
       logins          = institution_usage_daily.logins          + EXCLUDED.logins,
       sessions        = institution_usage_daily.sessions        + EXCLUDED.sessions,
       lesson_engagements = institution_usage_daily.lesson_engagements + EXCLUDED.lesson_engagements,
       ai_requests     = institution_usage_daily.ai_requests     + EXCLUDED.ai_requests,
       updated_at      = NOW()`,
    [institutionId, inc(bump.activeUsers), inc(bump.logins), inc(bump.sessions), inc(bump.lessonEngagements), inc(bump.aiRequests)]
  );
  if (inc(bump.activeUsers) > 0) {
    // maintain the durable active-user count on the settings row for cheap seat
    // utilisation reads
    await pool.query(
      `UPDATE institution_settings
       SET onboarded_user_count = GREATEST(onboarded_user_count, (SELECT count(*)::int FROM users WHERE institution_id = $1)),
           updated_at = NOW()
       WHERE institution_id = $1`,
      [institutionId]
    );
  }
}

/** Record an AI usage line (token/cost accounting). */
export async function recordAiUsage(input: {
  institutionId: string;
  userId?: string;
  provider: string;
  model: string;
  purpose?: string;
  promptTokens: number;
  completionTokens: number;
  costZar?: number;
}): Promise<void> {
  await pool.query(
    `INSERT INTO institution_ai_usage (institution_id, user_id, provider, model, purpose, prompt_tokens, completion_tokens, total_tokens, cost_zar)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      input.institutionId,
      input.userId ?? null,
      input.provider,
      input.model,
      input.purpose ?? "tutor",
      input.promptTokens,
      input.completionTokens,
      input.promptTokens + input.completionTokens,
      input.costZar ?? 0,
    ]
  );
  await recordDailyUsage(input.institutionId, { aiRequests: 1 });
}

// ---------------------------------------------------------------- read-side

function dailyRow(r: any): DailyUsageRow {
  return {
    institutionId: r.institution_id,
    day: String(r.day),
    activeUsers: Number(r.active_users ?? 0),
    logins: Number(r.logins ?? 0),
    sessions: Number(r.sessions ?? 0),
    lessonEngagements: Number(r.lesson_engagements ?? 0),
    aiRequests: Number(r.ai_requests ?? 0),
  };
}

/** Time-series of daily usage for an institution over the last `days` days. */
export async function getInstitutionUsage(institutionId: string, days = 30): Promise<DailyUsageRow[]> {
  const result = await pool.query(
    `SELECT institution_id, day, active_users, logins, sessions, lesson_engagements, ai_requests
     FROM institution_usage_daily
     WHERE institution_id = $1 AND day >= CURRENT_DATE - $2::int
     ORDER BY day ASC`,
    [institutionId, days]
  );
  return result.rows.map(dailyRow);
}

/** Aggregated totals over a window (used for dashboard headline cards). */
export async function getInstitutionUsageTotals(institutionId: string, days = 30): Promise<{
  activeUsers: number;
  logins: number;
  sessions: number;
  lessonEngagements: number;
  aiRequests: number;
  totalDays: number;
}> {
  const result = await pool.query(
    `SELECT COALESCE(sum(active_users),0)::int                    AS active_users,
            COALESCE(sum(logins),0)::int                         AS logins,
            COALESCE(sum(sessions),0)::int                       AS sessions,
            COALESCE(sum(lesson_engagements),0)::int             AS lesson_engagements,
            COALESCE(sum(ai_requests),0)::int                    AS ai_requests,
            count(*)::int                                        AS total_days
     FROM institution_usage_daily
     WHERE institution_id = $1 AND day >= CURRENT_DATE - $2::int`,
    [institutionId, days]
  );
  const r = result.rows[0];
  return {
    activeUsers: r.active_users,
    logins: r.logins,
    sessions: r.sessions,
    lessonEngagements: r.lesson_engagements,
    aiRequests: r.ai_requests,
    totalDays: r.total_days,
  };
}

/** AI spend summarised over a window (tokens + est. cost in ZAR). */
export async function getInstitutionAiUsage(institutionId: string, days = 30): Promise<{
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costZar: number;
  byModel: Array<{ model: string; requests: number; totalTokens: number; costZar: number }>;
}> {
  const result = await pool.query(
    `SELECT count(*)::int                                        AS requests,
            COALESCE(sum(prompt_tokens),0)::int                  AS prompt_tokens,
            COALESCE(sum(completion_tokens),0)::int              AS completion_tokens,
            COALESCE(sum(total_tokens),0)::int                   AS total_tokens,
            COALESCE(sum(cost_zar),0)::numeric                   AS cost_zar
     FROM institution_ai_usage
     WHERE institution_id = $1 AND performed_at >= NOW() - $2 * INTERVAL '1 day'`,
    [institutionId, days]
  );
  const byModel = await pool.query(
    `SELECT model, count(*)::int AS requests, COALESCE(sum(total_tokens),0)::int AS total_tokens,
            COALESCE(sum(cost_zar),0)::numeric AS cost_zar
     FROM institution_ai_usage
     WHERE institution_id = $1 AND performed_at >= NOW() - $2 * INTERVAL '1 day'
     GROUP BY model ORDER BY requests DESC`,
    [institutionId, days]
  );
  const r = result.rows[0];
  return {
    requests: r.requests,
    promptTokens: r.prompt_tokens,
    completionTokens: r.completion_tokens,
    totalTokens: r.total_tokens,
    costZar: Number(r.cost_zar),
    byModel: byModel.rows,
  };
}

/** Seat utilisation: licensed seats vs onboarded users (0..>1 ratio). */
export async function getSeatUtilisation(institutionId: string): Promise<{
  licensedSeats: number;
  onboardedUsers: number;
  utilisationPct: number;
}> {
  const result = await pool.query(
    `SELECT license_seats, onboarded_user_count FROM institution_settings WHERE institution_id = $1`,
    [institutionId]
  );
  const seats = Number(result.rows[0]?.license_seats ?? 0);
  const onboarded = Number(result.rows[0]?.onboarded_user_count ?? 0);
  const pct = seats > 0 ? Math.min((onboarded / seats) * 100, 999) : 0;
  return { licensedSeats: seats, onboardedUsers: onboarded, utilisationPct: Number(pct.toFixed(1)) };
}

/** Tenant-wide picture for the admin console (superadmin). */
export async function getPlatformOverview() {
  const institutions = await pool.query(
    `SELECT
        (SELECT count(*)::int FROM institutions WHERE is_active = TRUE)           AS active_institutions,
        (SELECT count(*)::int FROM institution_settings)                          AS configured_institutions,
        (SELECT count(*)::int FROM invoices WHERE status IN ('issued','partially_paid')) AS open_invoices,
        (SELECT COALESCE(sum(gross_amount_zar - amount_paid_zar),0)::numeric FROM invoices
           WHERE status IN ('issued','partially_paid','overdue'))                 AS outstanding_zar,
        (SELECT count(*)::int FROM users WHERE institution_id IS NOT NULL)        AS onboarded_users,
        (SELECT count(*)::int FROM lti_registrations)                             AS lti_registrations,
        (SELECT count(*)::int FROM lti_launch_events)                             AS lti_launches,
        (SELECT count(*)::int FROM institution_ai_usage)                          AS ai_requests_total`
  );
  const byTier = await pool.query(
    `SELECT tier, count(*)::int AS count FROM institution_settings GROUP BY tier ORDER BY tier`
  );
  return { ...institutions.rows[0], byTier: byTier.rows };
}