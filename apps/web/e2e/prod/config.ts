import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Env-driven config for the production Playwright harness. Shares the release
 * verification conventions: credentials come only from the environment / a
 * gitignored .env.verify file and are never printed.
 */

const DOTENV = path.resolve(process.cwd(), ".env.verify");

function loadDotEnv(): Record<string, string> {
  if (!existsSync(DOTENV)) return {};
  const out: Record<string, string> = {};
  for (const rawLine of readFileSync(DOTENV, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

function bool(v: string | undefined): boolean {
  return v === "1" || v === "true" || v === "yes";
}

export interface PlaywrightConfig {
  baseUrl?: string;
  testUserEmail?: string;
  testUserPassword?: string;
  revisionArtifactId?: string;
  adminTestUserEmail?: string;
  adminTestUserPassword?: string;
  paidTestUserEmail?: string;
  paidTestUserPassword?: string;
  pastPaperId?: string;
  pastPaperAttemptId?: string;
  outputDir: string;
  a11yGate: "critical" | "serious" | "moderate" | "off";
  enableRegisterTest: boolean;
  disposableEmail?: string;
  slowMotionMs: number;
  timeoutMs: number;
  headless: boolean;
  concurrent: boolean;
}

export function loadPlaywrightConfig(): PlaywrightConfig {
  const fileEnv = loadDotEnv();
  const env = { ...fileEnv, ...process.env };
  return {
    baseUrl: env.BASE_URL,
    testUserEmail: env.TEST_USER_EMAIL,
    testUserPassword: env.TEST_USER_PASSWORD,
    revisionArtifactId: env.REVISION_ARTIFACT_ID,
    adminTestUserEmail: env.ADMIN_TEST_USER_EMAIL,
    adminTestUserPassword: env.ADMIN_TEST_USER_PASSWORD,
    paidTestUserEmail: env.PAID_TEST_USER_EMAIL,
    paidTestUserPassword: env.PAID_TEST_USER_PASSWORD,
    pastPaperId: env.PAST_PAPER_ID,
    pastPaperAttemptId: env.PAST_PAPER_ATTEMPT_ID,
    outputDir: env.PW_OUTPUT_DIR || "artifacts/release-verify/playwright",
    a11yGate: (env.PW_A11Y_GATE ?? "serious") as PlaywrightConfig["a11yGate"],
    enableRegisterTest: bool(env.ENABLE_REGISTER_TEST),
    disposableEmail: env.REGISTER_DISPOSABLE_EMAIL,
    slowMotionMs: Number(env.PW_SLOW_MO ?? 0),
    timeoutMs: Number(env.PW_TIMEOUT_MS ?? 45_000),
    headless: !bool(env.PW_HEADED),
    concurrent: bool(env.PW_CONCURRENT),
  };
}
