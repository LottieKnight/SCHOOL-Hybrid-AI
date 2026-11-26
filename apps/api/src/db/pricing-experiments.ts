import { PoolClient } from "pg";
import { pool } from "./pool.js";

type PricingExperimentRow = {
  id: string;
  start_date: string;
  end_date: string | null;
  detailed_report_price_credits: string | number;
  weekly_free_unlocks: string | number;
  bundle_structure_json: unknown;
  created_by_admin: string;
  created_at: string;
  duration_seconds: string | number;
};

type MonetisationMetricsRow = {
  total_attempts: string | number;
  total_unlocks: string | number;
  total_credits_spent: string | number;
  spending_learners: string | number;
  active_learners: string | number;
  total_topup_revenue_zar: string | number;
  topup_count: string | number;
};

function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeMetricsRow(row: MonetisationMetricsRow) {
  const totalAttempts = toNumber(row.total_attempts);
  const totalUnlocks = toNumber(row.total_unlocks);
  const totalCreditsSpent = toNumber(row.total_credits_spent);
  const spendingLearners = toNumber(row.spending_learners);
  const activeLearners = toNumber(row.active_learners);
  const totalTopupRevenueZar = toNumber(row.total_topup_revenue_zar);
  const topupCount = toNumber(row.topup_count);

  return {
    totalAttempts,
    totalUnlocks,
    unlockConversionRate: totalAttempts > 0 ? totalUnlocks / totalAttempts : 0,
    totalCreditsSpent,
    spendingLearners,
    averageCreditsSpentPerLearner:
      spendingLearners > 0 ? totalCreditsSpent / spendingLearners : 0,
    totalTopupRevenueZar,
    topupCount,
    activeLearners,
    arpuProxyZar: activeLearners > 0 ? totalTopupRevenueZar / activeLearners : 0,
  };
}

function normalizeExperimentRow(row: PricingExperimentRow) {
  const durationSeconds = Math.max(0, Math.floor(toNumber(row.duration_seconds)));
  return {
    id: row.id,
    startDate: row.start_date,
    endDate: row.end_date,
    detailedReportPriceCredits: Math.max(
      1,
      Math.floor(toNumber(row.detailed_report_price_credits))
    ),
    weeklyFreeUnlocks: Math.max(0, Math.floor(toNumber(row.weekly_free_unlocks))),
    bundleStructureJson: row.bundle_structure_json ?? [],
    createdByAdmin: row.created_by_admin,
    createdAt: row.created_at,
    durationSeconds,
    durationDays: durationSeconds / (60 * 60 * 24),
    isActive: row.end_date == null,
  };
}

export async function getMonetisationMetricsForDateRange(input: {
  startDate: string;
  endDate: string | null;
}) {
  const endDate = input.endDate ?? new Date().toISOString();
  const result = await pool.query<MonetisationMetricsRow>(
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
       SELECT
         COALESCE(SUM(amount_zar), 0)::numeric(14, 2) AS total_topup_revenue_zar,
         COUNT(*)::bigint AS topup_count
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
       scoped_topups.topup_count
     FROM scoped_attempts
     CROSS JOIN scoped_unlocks
     CROSS JOIN scoped_spend
     CROSS JOIN scoped_active_learners
     CROSS JOIN scoped_topups`,
    [input.startDate, endDate]
  );

  const row = result.rows[0] ?? {
    total_attempts: 0,
    total_unlocks: 0,
    total_credits_spent: 0,
    spending_learners: 0,
    active_learners: 0,
    total_topup_revenue_zar: 0,
    topup_count: 0,
  };
  return normalizeMetricsRow(row);
}

export async function listPricingExperimentsWithMetrics(limit = 30) {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const result = await pool.query<PricingExperimentRow>(
    `SELECT
       id,
       start_date::text,
       end_date::text,
       detailed_report_price_credits,
       weekly_free_unlocks,
       bundle_structure_json,
       created_by_admin::text,
       created_at::text,
       EXTRACT(EPOCH FROM (COALESCE(end_date, NOW()) - start_date))::bigint AS duration_seconds
     FROM pricing_experiments
     ORDER BY start_date DESC
     LIMIT $1`,
    [safeLimit]
  );

  const experiments = await Promise.all(
    result.rows.map(async (row) => {
      const normalized = normalizeExperimentRow(row);
      const metrics = await getMonetisationMetricsForDateRange({
        startDate: normalized.startDate,
        endDate: normalized.endDate,
      });
      return {
        ...normalized,
        metrics,
      };
    })
  );

  return experiments;
}

type Queryable = Pick<PoolClient, "query">;

async function closeActivePricingExperiments(client: Queryable, endDate: string) {
  await client.query(
    `UPDATE pricing_experiments
     SET end_date = $1::timestamptz
     WHERE end_date IS NULL`,
    [endDate]
  );
}

export async function startPricingExperiment(input: {
  detailedReportPriceCredits: number;
  weeklyFreeUnlocks: number;
  bundleStructureJson: unknown;
  createdByAdmin: string;
  startDate?: string | null;
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const startDate = input.startDate ?? new Date().toISOString();

    await closeActivePricingExperiments(client, startDate);

    const inserted = await client.query<PricingExperimentRow>(
      `INSERT INTO pricing_experiments (
         start_date,
         detailed_report_price_credits,
         weekly_free_unlocks,
         bundle_structure_json,
         created_by_admin
       ) VALUES ($1::timestamptz, $2, $3, $4::jsonb, $5::uuid)
       RETURNING
         id,
         start_date::text,
         end_date::text,
         detailed_report_price_credits,
         weekly_free_unlocks,
         bundle_structure_json,
         created_by_admin::text,
         created_at::text,
         EXTRACT(EPOCH FROM (COALESCE(end_date, NOW()) - start_date))::bigint AS duration_seconds`,
      [
        startDate,
        Math.max(1, Math.floor(input.detailedReportPriceCredits)),
        Math.max(0, Math.floor(input.weeklyFreeUnlocks)),
        JSON.stringify(input.bundleStructureJson ?? []),
        input.createdByAdmin,
      ]
    );

    const row = inserted.rows[0];
    if (!row) {
      throw new Error("Failed to create pricing experiment.");
    }

    await client.query("COMMIT");
    return normalizeExperimentRow(row);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
