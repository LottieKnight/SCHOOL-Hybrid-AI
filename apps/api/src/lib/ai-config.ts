// apps/api/src/lib/ai-config.ts
//
// Per-institution AI tutor configuration (Phase 3.3).
//
// The AI tutor call path in the web app reads global env vars (provider/model/
// key). Multi-tenancy means a contract holder should be able to pick their own
// model/provider (or have school's ops tune it) and have AI usage **accounted**
// at tenant level. This module owns the typed shape of `institution_settings
// .ai_config`: safe defaults, a sanitizer for the write path, and read/write
// helpers. Usage recording lives in lib/usage.ts (institution_ai_usage).

import { pool } from "../db/pool.js";

export type AiProvider = "openai" | "anthropic" | "ollama" | "azure" | "auto";

export interface AiConfig {
  enabled: boolean;
  provider: AiProvider;
  model: string;
  /** tier gate: only roles >= this may use the tutor ("" = everyone with learn:ai_tutor) */
  minRole: string;
  /** per-request max tokens cap */
  maxTokens: number;
  /** optional per-request rate limit (requests/min); 0 = use platform default */
  rateLimitPerMin: number;
  /** optional daily per-user request cap; 0 = platform default */
  dailyLimitPerUser: number;
  /** Est. cost model is platform-managed; this is the override multiplier. */
  costMultiplier: number;
}

export const DEFAULT_AI_CONFIG: AiConfig = {
  enabled: true,
  provider: "auto",
  model: "auto",
  minRole: "",
  maxTokens: 1024,
  rateLimitPerMin: 10,
  dailyLimitPerUser: 20,
  costMultiplier: 1,
};

const PROVIDERS: AiProvider[] = ["openai", "anthropic", "ollama", "azure", "auto"];

/**
 * Sanitise an untrusted `ai_config` JSONB blob into a safe, fully-populated
 * AiConfig (unknown providers/negative numbers/non-numeric dropped -> default).
 */
export function sanitizeAiConfig(raw: unknown): AiConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const bool = (v: unknown, def: boolean): boolean => (typeof v === "boolean" ? v : def);
  const str = (v: unknown, def: string, max = 120): string =>
    typeof v === "string" && v.trim() && v.trim().length <= max ? v.trim() : def;
  const num = (v: unknown, def: number, min = 0, max: number): number => {
    const n = Number(v);
    return Number.isFinite(n) && n >= min && n <= max ? n : def;
  };
  const provider = PROVIDERS.includes(r.provider as AiProvider) ? (r.provider as AiProvider) : DEFAULT_AI_CONFIG.provider;
  return {
    enabled: bool(r.enabled, DEFAULT_AI_CONFIG.enabled),
    provider,
    model: str(r.model, DEFAULT_AI_CONFIG.model),
    minRole: str(r.minRole, DEFAULT_AI_CONFIG.minRole),
    maxTokens: num(r.maxTokens, DEFAULT_AI_CONFIG.maxTokens, 128, 16384),
    rateLimitPerMin: num(r.rateLimitPerMin, DEFAULT_AI_CONFIG.rateLimitPerMin, 0, 600),
    dailyLimitPerUser: num(r.dailyLimitPerUser, DEFAULT_AI_CONFIG.dailyLimitPerUser, 0, 10000),
    costMultiplier: num(r.costMultiplier, DEFAULT_AI_CONFIG.costMultiplier, 0, 100),
  };
}

/** Read + normalise an institution's AI config (defaults if unset). */
export async function getInstitutionAiConfig(institutionId: string): Promise<AiConfig> {
  const result = await pool.query(
    `SELECT ai_config FROM institution_settings WHERE institution_id = $1`,
    [institutionId]
  );
  return sanitizeAiConfig(result.rows[0]?.ai_config ?? {});
}

/** Persist a sanitised AI config for an institution. */
export async function setInstitutionAiConfig(institutionId: string, raw: unknown): Promise<AiConfig> {
  const cfg = sanitizeAiConfig(raw);
  await pool.query(
    `INSERT INTO institution_settings (institution_id) VALUES ($1)
     ON CONFLICT (institution_id) DO NOTHING`,
    [institutionId]
  );
  await pool.query(
    `UPDATE institution_settings SET ai_config = $2::jsonb, updated_at = NOW() WHERE institution_id = $1`,
    [institutionId, JSON.stringify(cfg)]
  );
  return cfg;
}