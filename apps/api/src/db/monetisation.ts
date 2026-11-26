import { pool } from "./pool.js";

export type MonetisationRange = "7d" | "30d";
type MonetisationSummaryScope = "range" | "experiment";

export type MonetisationSummary = {
  range: MonetisationRange;
  rangeDays: number;
  generatedAt: string;
  scope: MonetisationSummaryScope;
  experimentId: string | null;
  experimentStartDate: string | null;
  experimentEndDate: string | null;
  totalAttempts: number;
  totalUnlocks: number;
  unlockConversionRate: number;
  totalCreditsSpent: number;
  spendingLearners: number;
  averageCreditsSpentPerLearner: number;
  weeklyTopupCount: number;
  totalTopupRevenueZar: number;
  activeLearners: number;
  arpuProxyZar: number;
};

type MonetisationSummaryRow = {
  total_attempts: string | number;
  total_unlocks: string | number;
  total_credits_spent: string | number;
  spending_learners: string | number;
  active_learners: string | number;
  total_topup_revenue_zar: string | number;
  weekly_topup_count: string | number;
};

function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeRangeDays(range: MonetisationRange) {
  return range === "30d" ? 30 : 7;
}

type PricingExperimentWindowRow = {
  id: string;
  start_date: string;
  end_date: string | null;
};

type PricingExperimentWindow = {
  id: string;
  startDate: string;
  endDate: string | null;
};

function normalizeSummaryRow(row: MonetisationSummaryRow) {
  const totalAttempts = toNumber(row.total_attempts);
  const totalUnlocks = toNumber(row.total_unlocks);
  const totalCreditsSpent = toNumber(row.total_credits_spent);
  const spendingLearners = toNumber(row.spending_learners);
  const activeLearners = toNumber(row.active_learners);
  const totalTopupRevenueZar = toNumber(row.total_topup_revenue_zar);
  const weeklyTopupCount = toNumber(row.weekly_topup_count);

  return {
    totalAttempts,
    totalUnlocks,
    unlockConversionRate: totalAttempts > 0 ? totalUnlocks / totalAttempts : 0,
    totalCreditsSpent,
    spendingLearners,
    averageCreditsSpentPerLearner:
      spendingLearners > 0 ? totalCreditsSpent / spendingLearners : 0,
    weeklyTopupCount,
    totalTopupRevenueZar,
    activeLearners,
    arpuProxyZar: activeLearners > 0 ? totalTopupRevenueZar / activeLearners : 0,
  };
}

function fallbackSummaryRow(): MonetisationSummaryRow {
  return {
    total_attempts: 0,
    total_unlocks: 0,
    total_credits_spent: 0,
    spending_learners: 0,
    active_learners: 0,
    total_topup_revenue_zar: 0,
    weekly_topup_count: 0,
  };
}

async function fetchMonetisationSummaryForRelativeRange(rangeDays: number) {
  const result = await pool.query<MonetisationSummaryRow>(
    `WITH scoped_attempts AS (
       SELECT COUNT(*)::bigint AS total_attempts
       FROM quiz_attempts_v2
       WHERE created_at >= NOW() - ($1::text || ' days')::interval
     ),
     scoped_unlocks AS (
       SELECT COUNT(*)::bigint AS total_unlocks
       FROM wallet_ledger_entries
       WHERE type = 'DEBIT'
         AND ref_type = 'past_paper_detailed_report'
         AND created_at >= NOW() - ($1::text || ' days')::interval
     ),
     scoped_spend AS (
       SELECT
         COALESCE(SUM(amount_credits), 0)::bigint AS total_credits_spent,
         COUNT(DISTINCT user_id)::bigint AS spending_learners
       FROM wallet_ledger_entries
       WHERE type = 'DEBIT'
         AND created_at >= NOW() - ($1::text || ' days')::interval
     ),
     scoped_active_learners AS (
       SELECT COUNT(DISTINCT user_id)::bigint AS active_learners
       FROM (
         SELECT learner_id AS user_id
         FROM quiz_attempts_v2
         WHERE created_at >= NOW() - ($1::text || ' days')::interval
         UNION
         SELECT user_id
         FROM wallet_ledger_entries
         WHERE created_at >= NOW() - ($1::text || ' days')::interval
       ) AS scoped_activity
     ),
     scoped_topups AS (
       SELECT COALESCE(SUM(amount_zar), 0)::numeric(14, 2) AS total_topup_revenue_zar
       FROM wallet_topups
       WHERE status = 'succeeded'
         AND created_at >= NOW() - ($1::text || ' days')::interval
     ),
     weekly_topups AS (
       SELECT COUNT(*)::bigint AS weekly_topup_count
       FROM wallet_topups
       WHERE status = 'succeeded'
         AND created_at >= NOW() - INTERVAL '7 days'
     )
     SELECT
       scoped_attempts.total_attempts,
       scoped_unlocks.total_unlocks,
       scoped_spend.total_credits_spent,
       scoped_spend.spending_learners,
       scoped_active_learners.active_learners,
       scoped_topups.total_topup_revenue_zar,
       weekly_topups.weekly_topup_count
     FROM scoped_attempts
     CROSS JOIN scoped_unlocks
     CROSS JOIN scoped_spend
     CROSS JOIN scoped_active_learners
     CROSS JOIN scoped_topups
     CROSS JOIN weekly_topups`,
    [String(rangeDays)]
  );
  return normalizeSummaryRow(result.rows[0] ?? fallbackSummaryRow());
}

async function getPricingExperimentWindowById(
  experimentId: string
): Promise<PricingExperimentWindow | null> {
  const result = await pool.query<PricingExperimentWindowRow>(
    `SELECT id::text, start_date::text, end_date::text
     FROM pricing_experiments
     WHERE id = $1::uuid
     LIMIT 1`,
    [experimentId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    startDate: row.start_date,
    endDate: row.end_date,
  };
}

async function fetchMonetisationSummaryForWindow(startDate: string, endDate: string | null) {
  const effectiveEndDate = endDate ?? new Date().toISOString();
  const result = await pool.query<MonetisationSummaryRow>(
    `WITH scoped_attempts AS (
       SELECT COUNT(*)::bigint AS total_attempts
       FROM quiz_attempts_v2
       WHERE created_at >= $1::timestamptz
         AND created_at < $2::timestamptz
     ),
     scoped_unlocks AS (
       SELECT COUNT(*)::bigint AS total_unlocks
       FROM wallet_ledger_entries
       WHERE type = 'DEBIT'
         AND ref_type = 'past_paper_detailed_report'
         AND created_at >= $1::timestamptz
         AND created_at < $2::timestamptz
     ),
     scoped_spend AS (
       SELECT
         COALESCE(SUM(amount_credits), 0)::bigint AS total_credits_spent,
         COUNT(DISTINCT user_id)::bigint AS spending_learners
       FROM wallet_ledger_entries
       WHERE type = 'DEBIT'
         AND created_at >= $1::timestamptz
         AND created_at < $2::timestamptz
     ),
     scoped_active_learners AS (
       SELECT COUNT(DISTINCT user_id)::bigint AS active_learners
       FROM (
         SELECT learner_id AS user_id
         FROM quiz_attempts_v2
         WHERE created_at >= $1::timestamptz
           AND created_at < $2::timestamptz
         UNION
         SELECT user_id
         FROM wallet_ledger_entries
         WHERE created_at >= $1::timestamptz
           AND created_at < $2::timestamptz
       ) AS scoped_activity
     ),
     scoped_topups AS (
       SELECT COALESCE(SUM(amount_zar), 0)::numeric(14, 2) AS total_topup_revenue_zar
       FROM wallet_topups
       WHERE status = 'succeeded'
         AND created_at >= $1::timestamptz
         AND created_at < $2::timestamptz
     ),
     scoped_topup_count AS (
       SELECT COUNT(*)::bigint AS weekly_topup_count
       FROM wallet_topups
       WHERE status = 'succeeded'
         AND created_at >= $1::timestamptz
         AND created_at < $2::timestamptz
     )
     SELECT
       scoped_attempts.total_attempts,
       scoped_unlocks.total_unlocks,
       scoped_spend.total_credits_spent,
       scoped_spend.spending_learners,
       scoped_active_learners.active_learners,
       scoped_topups.total_topup_revenue_zar,
       scoped_topup_count.weekly_topup_count
     FROM scoped_attempts
     CROSS JOIN scoped_unlocks
     CROSS JOIN scoped_spend
     CROSS JOIN scoped_active_learners
     CROSS JOIN scoped_topups
     CROSS JOIN scoped_topup_count`,
    [startDate, effectiveEndDate]
  );

  return normalizeSummaryRow(result.rows[0] ?? fallbackSummaryRow());
}

function computeRangeDaysFromWindow(startDate: string, endDate: string | null) {
  const startMs = Date.parse(startDate);
  const endMs = Date.parse(endDate ?? new Date().toISOString());
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return 1;
  }
  return Math.max(1, Math.ceil((endMs - startMs) / (24 * 60 * 60 * 1000)));
}

export async function getMonetisationSummary(
  range: MonetisationRange
): Promise<MonetisationSummary>;
export async function getMonetisationSummary(
  range: MonetisationRange,
  options: { experimentId?: string | null }
): Promise<MonetisationSummary | null>;
export async function getMonetisationSummary(
  range: MonetisationRange,
  options?: { experimentId?: string | null }
): Promise<MonetisationSummary | null> {
  const experimentId = options?.experimentId?.trim() ?? "";
  if (experimentId.length > 0) {
    const experiment = await getPricingExperimentWindowById(experimentId);
    if (!experiment) {
      return null;
    }
    const scoped = await fetchMonetisationSummaryForWindow(experiment.startDate, experiment.endDate);
    return {
      range,
      rangeDays: computeRangeDaysFromWindow(experiment.startDate, experiment.endDate),
      generatedAt: new Date().toISOString(),
      scope: "experiment" as MonetisationSummaryScope,
      experimentId: experiment.id,
      experimentStartDate: experiment.startDate,
      experimentEndDate: experiment.endDate,
      ...scoped,
    };
  }

  const rangeDays = normalizeRangeDays(range);
  const scoped = await fetchMonetisationSummaryForRelativeRange(rangeDays);

  return {
    range,
    rangeDays,
    generatedAt: new Date().toISOString(),
    scope: "range" as MonetisationSummaryScope,
    experimentId: null,
    experimentStartDate: null,
    experimentEndDate: null,
    ...scoped,
  };
}
