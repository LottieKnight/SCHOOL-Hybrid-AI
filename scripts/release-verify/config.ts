import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Environment-driven configuration for the production verification runner.
 *
 * Nothing here may be committed with real values. The loader reads an optional
 * `.env.verify` file (gitignored) then process.env. Every credential is read
 * ONLY from the environment and is NEVER printed by the runner.
 */

const VERIFY_DOTENV = path.resolve(process.cwd(), ".env.verify");

export interface VerifyConfig {
  baseUrl?: string;
  apiBaseUrl?: string;
  testUserEmail?: string;
  testUserPassword?: string;
  adminTestUserEmail?: string;
  adminTestUserPassword?: string;
  paidTestUserEmail?: string;
  paidTestUserPassword?: string;
  pastPaperId?: string;
  pastPaperAttemptId?: string;
  pastPaperOwnerEmail?: string;
  pastPaperOwnerPassword?: string;
  verifyAiAnonDaily: boolean;
  verifyAuthAiLimits: boolean;
  redisVerifyUrl?: string;
  metricsToken?: string;
  outputDir: string;
  allowInsecure: boolean;
}

function loadDotEnv(): Record<string, string> {
  if (!existsSync(VERIFY_DOTENV)) return {};
  const out: Record<string, string> = {};
  for (const rawLine of readFileSync(VERIFY_DOTENV, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

function boolFromEnv(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "yes";
}

export function loadConfig(): VerifyConfig {
  const fileEnv = loadDotEnv();
  const env = { ...fileEnv, ...process.env };
  return {
    baseUrl: env.BASE_URL,
    apiBaseUrl: env.API_BASE_URL,
    testUserEmail: env.TEST_USER_EMAIL,
    testUserPassword: env.TEST_USER_PASSWORD,
    adminTestUserEmail: env.ADMIN_TEST_USER_EMAIL,
    adminTestUserPassword: env.ADMIN_TEST_USER_PASSWORD,
    paidTestUserEmail: env.PAID_TEST_USER_EMAIL,
    paidTestUserPassword: env.PAID_TEST_USER_PASSWORD,
    pastPaperId: env.PAST_PAPER_ID,
    pastPaperAttemptId: env.PAST_PAPER_ATTEMPT_ID,
    pastPaperOwnerEmail: env.PAST_PAPER_OWNER_EMAIL,
    pastPaperOwnerPassword: env.PAST_PAPER_OWNER_PASSWORD,
    verifyAiAnonDaily: boolFromEnv(env.VERIFY_AI_ANON_DAILY),
    verifyAuthAiLimits: boolFromEnv(env.VERIFY_AUTH_AI_LIMITS),
    redisVerifyUrl: env.REDIS_VERIFY_URL,
    metricsToken: env.METRICS_TOKEN,
    outputDir: env.VERIFY_OUTPUT_DIR || "artifacts/release-verify",
    allowInsecure: boolFromEnv(env.ALLOW_INSECURE),
  };
}

export function missingRequiredEnv(config: VerifyConfig): string[] {
  const missing: string[] = [];
  if (!config.baseUrl) missing.push("BASE_URL");
  return missing;
}

export function describeConfig(config: VerifyConfig): string[] {
  const lines: string[] = [];
  lines.push(`BASE_URL            : ${config.baseUrl ?? "(unset)"}`);
  lines.push(`API_BASE_URL        : ${config.apiBaseUrl ?? "(unset; default: same origin proxy)"}`);
  lines.push(
    `TEST_USER           : ${config.testUserEmail ? "set (identity never printed)" : "(unset)"}`
  );
  lines.push(
    `ADMIN_TEST_USER     : ${config.adminTestUserEmail ? "set (identity never printed)" : "(unset)"}`
  );
  lines.push(
    `PAID_TEST_USER      : ${config.paidTestUserEmail ? "set (identity never printed)" : "(unset)"}`
  );
  lines.push(`PAST_PAPER_ATTEMPT : ${config.pastPaperAttemptId ? "set" : "(unset)"}`);
  lines.push(`VERIFY_AI_ANON_DAILY : ${config.verifyAiAnonDaily}`);
  lines.push(`VERIFY_AUTH_AI_LIMITS: ${config.verifyAuthAiLimits}`);
  lines.push(`REDIS_VERIFY_URL     : ${config.redisVerifyUrl ? "set (value never printed)" : "(unset)"}`);
  lines.push(`OUTPUT_DIR           : ${config.outputDir}`);
  return lines;
}