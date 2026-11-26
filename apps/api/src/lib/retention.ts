// apps/api/src/lib/retention.ts
//
// POPIA §14 data-retention policy registry. Operator-readable/overridable windows
// that replace the cron's hard-coded values. NULLs fall back to these defaults:

import { pool } from "../db/pool.js";

export const RETENTION_DEFAULTS = {
  "account.inactivity_anonymize_years": 3,
  "account.unverified_cleanup_years": 1,
  "ledger.financial_retention_years": 7,
} as const;

export type RetentionKey = keyof typeof RETENTION_DEFAULTS;

export interface RetentionPolicy {
  policy_key: string;
  display_name: string;
  policy_value_years: string | null;
  effective_from: string | null;
  updated_by: string | null;
  updated_at: string;
}

export async function listRetentionPolicies(): Promise<RetentionPolicy[]> {

  const result = await pool.query<RetentionPolicy>(
    `SELECT policy_key, display_name, policy_value_years, effective_from, updated_by, updated_at
     FROM retention_policies ORDER BY policy_key`
  );
  return result.rows;
}

export async function getRetentionYears(key: string): Promise<number> {
  const defaultYears = (RETENTION_DEFAULTS as Record<string, number>)[key] ?? 3;

  const result = await pool.query<{ policy_value_years: string | null }>(
    `SELECT policy_value_years FROM retention_policies WHERE policy_key = $1`,
    [key]
  );
  const raw = result.rows[0]?.policy_value_years ?? null;
  const asNumber = raw === null ? NaN : Number(raw);
  return Number.isFinite(asNumber) && asNumber > 0 ? asNumber : defaultYears;
}

export async function setRetentionYears(input: {
  policyKey: string;
  years: number;
  updatedBy: string;
}): Promise<RetentionPolicy | null> {

  if (!Number.isFinite(input.years) || input.years < 0 || input.years > 50) {
    throw new Error("retention years must be between 0 and 50");
  }
  const result = await pool.query<RetentionPolicy>(
    `UPDATE retention_policies
     SET policy_value_years = $2::text,
         updated_by = $3,
         updated_at = NOW(),
         effective_from = NOW()
     WHERE policy_key = $1
     RETURNING policy_key, display_name, policy_value_years, effective_from, updated_by, updated_at`,
    [input.policyKey, String(input.years), input.updatedBy]
  );
  return result.rows[0] ?? null;
}