import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { pool } from "./pool.js";

type UnlockFunnelRow = {
  total_attempts: string | number;
  total_unlocks: string | number;
};

type EquipmentQuoteLike = {
  status?: unknown;
};

function toInt(value: string | number | null | undefined) {
  if (typeof value === "number") return Math.trunc(value);
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function resolveQuoteFilePath() {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "data", "equipment_quotes.json"),
    path.join(cwd, "..", "data", "equipment_quotes.json"),
    path.join(cwd, "..", "..", "data", "equipment_quotes.json"),
    path.join(cwd, "apps", "web", "data", "equipment_quotes.json"),
    path.join(cwd, "..", "apps", "web", "data", "equipment_quotes.json"),
    path.join(cwd, "..", "..", "apps", "web", "data", "equipment_quotes.json"),
  ];

  for (const file of candidates) {
    if (existsSync(file)) return file;
  }

  return candidates[0];
}

async function readEquipmentQuotes() {
  const filePath = resolveQuoteFilePath();
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as EquipmentQuoteLike[]) : [];
  } catch {
    return [] as EquipmentQuoteLike[];
  }
}

export async function getUnlockFunnelSummary() {
  const result = await pool.query<UnlockFunnelRow>(
    `SELECT
       (SELECT COUNT(*)::bigint FROM quiz_attempts_v2) AS total_attempts,
       (SELECT COUNT(*)::bigint
        FROM wallet_ledger_entries
        WHERE type = 'DEBIT'
          AND ref_type = 'past_paper_detailed_report') AS total_unlocks`
  );

  const row = result.rows[0] ?? {
    total_attempts: 0,
    total_unlocks: 0,
  };
  const totalAttempts = toInt(row.total_attempts);
  const totalUnlocks = toInt(row.total_unlocks);

  return {
    totalAttempts,
    totalUnlocks,
    unlockConversionRate: totalAttempts > 0 ? totalUnlocks / totalAttempts : 0,
  };
}

export async function getQuoteFunnelSummary() {
  const rows = await readEquipmentQuotes();
  const totalQuotes = rows.length;

  let answeredQuotes = 0;
  let closedQuotes = 0;

  for (const row of rows) {
    const status = typeof row?.status === "string" ? row.status.trim().toLowerCase() : "received";
    if (status === "answered" || status === "closed") {
      answeredQuotes += 1;
    }
    if (status === "closed") {
      closedQuotes += 1;
    }
  }

  return {
    totalQuotes,
    answeredRate: totalQuotes > 0 ? answeredQuotes / totalQuotes : 0,
    closedRate: totalQuotes > 0 ? closedQuotes / totalQuotes : 0,
  };
}
