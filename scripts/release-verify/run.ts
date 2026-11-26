import path from "node:path";
import { mkdirSync } from "node:fs";
import { loadConfig, missingRequiredEnv, describeConfig } from "./config.js";
import { Reporter } from "./result.js";
import { runEnvSuite } from "./suites/env.js";
import { runHealthSuite } from "./suites/health.js";
import { runGuestSuite } from "./suites/guest.js";
import { runAuthSuite } from "./suites/auth.js";
import { runAiLimitsSuite } from "./suites/ai-limits.js";
import { runPaidContentSuite } from "./suites/paid-content.js";
import { runChecklist14Suite } from "./suites/checklist-14.js";
import { runDynamicClaimsSuite } from "./suites/dynamic-claims.js";
import { runCanonicalSuite } from "./suites/canonical.js";

export interface SuiteRunner {
  (reporter: Reporter): Promise<void>;
}

const SUITES: Record<string, SuiteRunner> = {
  env: runEnvSuite,
  health: runHealthSuite,
  guest: runGuestSuite,
  auth: runAuthSuite,
  "ai-limits": runAiLimitsSuite,
  "paid-content": runPaidContentSuite,
  checklist14: runChecklist14Suite,
  "dynamic-claims": runDynamicClaimsSuite,
  canonical: runCanonicalSuite,
};

const SUITE_ORDER = ["env", "health", "guest", "auth", "ai-limits", "paid-content", "checklist14", "dynamic-claims", "canonical"];

async function main() {
  const args = process.argv.slice(2);
  const suiteArg = args.find((a) => a.startsWith("--suite="))?.split("=")[1];
  const reportArg = args.find((a) => a.startsWith("--report="))?.split("=")[1];
  const quiet = args.includes("--quiet");

  const config = loadConfig();
  const missing = missingRequiredEnv(config);
  const reporter = new Reporter();

  if (missing.length > 0) {
    for (const key of missing) {
      reporter.add({
        suite: "env",
        id: "missing",
        title: `${key} is required`,
        test: "configuration validated",
        expected: `${key} present`,
        verdict: "BLOCKED",
        actual: `${key} is unset; add to .env.verify or the environment`,
      });
    }
  } else {
    if (SUITE_ORDER.includes("env")) await runEnvSuite(reporter);
  }

  const requested = suiteArg ? suiteArg.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const wantsAll = requested.length === 0 || requested.includes("all");
  const selectedRaw = wantsAll ? SUITE_ORDER : requested;
  for (const name of selectedRaw) {
    const runner = SUITES[name];
    if (!runner) {
      console.error(`Unknown suite: ${name}`);
      process.exitCode = 1;
      continue;
    }
    if (name !== "env") await runner(reporter);
  }

  const outputDir = path.resolve(process.cwd(), config.outputDir);
  mkdirSync(outputDir, { recursive: true });
  const jsonPath = reportArg ?? path.join(outputDir, "release-verify.json");
  const mdPath = path.join(outputDir, "release-verify.md");
  reporter.writeMarkdown(mdPath);
  reporter.writeJson(jsonPath);

  const summary = reporter.summary();
  if (!quiet) {
    console.log("=== release-verify configuration ===");
    for (const line of describeConfig(config)) console.log(`  ${line}`);
    console.log("\n=== results ===");
    console.log(reporter.renderTable());
    console.log(`\nPASS=${summary.passed} FAIL=${summary.failed} BLOCKED=${summary.blocked} N/A=${summary.na} TOTAL=${summary.count}`);
    console.log(`Reports: json=${jsonPath} md=${mdPath}`);
  }
  if (summary.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("release-verify crashed:", error instanceof Error ? error.message : error);
  process.exitCode = 2;
});