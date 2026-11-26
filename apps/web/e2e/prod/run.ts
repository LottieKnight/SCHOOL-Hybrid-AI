import { mkdirSync } from "node:fs";
import path from "node:path";

import { Reporter } from "../../../../scripts/release-verify/result";
import { loadPlaywrightConfig } from "./config";
import { runA11y } from "./a11y";
import { runJourneys } from "./journeys";
import { runPerf } from "./perf";
import { runVisual } from "./visual";

function parseArgs(): string[] {
  const mode: string[] = [];
  for (const a of process.argv.slice(2)) {
    if (a === "--all") mode.push("journeys", "a11y", "perf", "visual");
    else mode.push(a);
  }
  if (mode.length === 0) mode.push("help");
  return mode;
}

async function main(): Promise<void> {
  const mode = parseArgs();
  const cfg = loadPlaywrightConfig();
  if (mode.includes("help")) {
    console.log(
      [
        "Playwright release harness (apps/web/e2e/prod)",
        "",
        "Usage: tsx apps/web/e2e/prod/run.ts [--all|<area> [--report <file>]]",
        "",
        "Areas:",
        "  journeys        browser journeys (guest surface, guest dashboard, login UI, authed dashboard, revision lifecycle, logout)",
        "  a11y            axe-core scans + landmark/h1/heading-order/44px/alt on page set",
        "  perf            LCP/INP/CLS/TTFB + payload breakdown, desktop (+mobile via PW_CONCURRENT=1)",
        "  visual          18-viewport responsive matrix, overflow/clipped/touch-target + screen-ratio audit",
        "",
        "Env (from process env or .env.verify):",
        "  BASE_URL            required",
        "  TEST_USER_EMAIL/PASSWORD   required for authed journeys",
        "  REVISION_ARTIFACT_ID       optional saved artifact fixture for revision-lifecycle",
        "  PW_A11Y_GATE        critical|serious|moderate|off  (default serious)",
        "  PW_HEADED, PW_SLOW_MO, PW_TIMEOUT_MS, PW_CONCURRENT, PW_OUTPUT_DIR",
      ].join("\n")
    );
    process.exitCode = 2;
    return;
  }

  if (!cfg.baseUrl) {
    console.error("BASE_URL is required (set it in .env.verify or the environment).");
    process.exitCode = 2;
    return;
  }

  mkdirSync(cfg.outputDir, { recursive: true });
  const reporter = new Reporter();

  let failures = 0;
  if (mode.includes("journeys")) {
    const names = mode.find((m) => m !== "journeys" && m !== "a11y" && m !== "perf" && m !== "visual" && m !== "all");
    const selected = mode.includes("all") ? ["all"] : (names ? names.split(",") : ["all"]);
    failures += await runJourneys(reporter, selected);
  }
  if (mode.includes("a11y")) failures += await runA11y(reporter);
  if (mode.includes("perf")) failures += await runPerf(reporter);
  if (mode.includes("visual")) failures += await runVisual(reporter);

  const mdPath = path.join(cfg.outputDir, "playwright.md");
  const jsonPath = path.join(cfg.outputDir, "playwright.json");
  reporter.writeMarkdown(mdPath);
  reporter.writeJson(jsonPath);

  console.log(`playwright harness complete: ${failures} failing checks`);
  console.log(`reports: ${mdPath}, ${jsonPath}`);
  process.exitCode = failures > 0 ? 2 : 0;
}

void main();
