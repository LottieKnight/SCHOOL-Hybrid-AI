import type { Browser, BrowserContext, Page } from "playwright";

import type { Reporter } from "../../../../scripts/release-verify/result";
import { loadPlaywrightConfig } from "./config";
import { axesPath, cdpEvaluate, newContext, newWatch, openBrowser, settlePage, summarizeWatch, watchPage, withRetry } from "./harness";

interface AxeViolation {
  id: string;
  impact?: "minor" | "moderate" | "serious" | "critical";
  help: string;
  nodes: number;
  targets: string[];
}

interface AxeResult {
  violations: AxeViolation[];
}

const MANUAL_CHECKS = [
  { id: "landmark", check: (m: A11yMetrics) => m.mainCount > 0 },
  { id: "h1", check: (m: A11yMetrics) => m.h1Count === 1 },
  { id: "heading-order", check: (m: A11yMetrics) => m.headingSkips === 0 },
  { id: "44px-targets", check: (m: A11yMetrics) => m.smallTargets === 0 },
  { id: "alt-present", check: (m: A11yMetrics) => m.imagesMissingAlt === 0 },
] as const;

interface A11yMetrics {
  mainCount: number;
  h1Count: number;
  headingSkips: number;
  smallTargets: number;
  imagesMissingAlt: number;
  focusableCount: number;
}

const PAGES: Array<{ path: string; id: string; title: string }> = [
  { path: "/", id: "home", title: "Home, guest" },
  { path: "/learn", id: "learn", title: "Learn hub" },
  { path: "/past-papers", id: "past-papers", title: "Past-papers catalog" },
  { path: "/community", id: "community", title: "Community hub" },
  { path: "/daily-quiz", id: "daily-quiz", title: "Daily quiz" },
  { path: "/tutor", id: "assistant", title: "AI Tutor guest surface" },
];

const SCAN_METRICS_EXPR = `(() => {
  const doc = document;
  const mainCount = doc.querySelectorAll("main").length;
  const h1Count = doc.querySelectorAll("h1").length;
  const headings = Array.from(doc.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((h) => Number(h.tagName.slice(1)));
  let headingSkips = 0;
  for (let i = 1; i < headings.length; i += 1) {
    if (headings[i] > headings[i - 1] + 1) headingSkips += 1;
  }
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || (el).hidden) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const interactive = Array.from(doc.querySelectorAll("a,button,input,select,textarea,[tabindex],[role=button],[role=link],summary"))
    .filter(visible);
  const smallTargets = interactive.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width < 44 && r.height < 44;
  }).length;
  const imagesMissingAlt = Array.from(doc.querySelectorAll("img")).filter((img) => {
    const a = img.getAttribute("alt");
    return a === null;
  }).length;
  return {
    mainCount,
    h1Count,
    headingSkips,
    smallTargets,
    imagesMissingAlt,
    focusableCount: interactive.length,
  };
})()`;

export function scanMetrics(page: Page): Promise<A11yMetrics> {
  return cdpEvaluate(page, SCAN_METRICS_EXPR);
}

type AxeViolationImpact = NonNullable<AxeViolation["impact"]>;

export async function runAxe(page: Page): Promise<AxeResult> {
  const impacts = ["minor", "moderate", "serious", "critical"] as const;
  const expression = `(async () => {
    const impactList = ${JSON.stringify([...impacts])};
    const win = window;
    const axe = win.axe;
    if (!axe) return { violations: [] };
    const res = await axe.run(document, {});
    const violations = res.violations.map((v) => ({
      id: v.id,
      impact: impactList.includes(v.impact) ? v.impact : undefined,
      help: v.help || "",
      nodes: v.nodes.length,
      targets: v.nodes.slice(0, 5).map((n) => (n.target ? String(n.target) : (n.html || ""))).filter((t) => t.length > 0),
    }));
    return { violations };
  })()`;
  return cdpEvaluate<AxeResult>(page, expression);
}

export async function runA11y(reporter: Reporter): Promise<number> {
  const cfg = loadPlaywrightConfig();
  if (!cfg.baseUrl) {
    reporter.add({ suite: "playwright-a11y", id: "a11y-config", title: "Base URL required", test: "configuration", expected: "BASE_URL set", verdict: "BLOCKED", actual: "BASE_URL unset", timestamp: new Date().toISOString() });
    return 1;
  }
  const browser = await openBrowser({ headless: cfg.headless, slow: cfg.slowMotionMs });
  let failed = 0;
  for (const pageSpec of PAGES) {
    const ctx: BrowserContext = await newContext(browser, {});
    const page: Page = await ctx.newPage();
    const watch = newWatch();
    const off = watchPage(page, watch);
    try {
      const res = await page.goto(`${cfg.baseUrl}${pageSpec.path}`, { waitUntil: "load" });
      await page.addScriptTag({ path: axesPath() });
      await settlePage(page);
      const raw = await withRetry(() => runAxe(page));
      const metrics = await withRetry(() => scanMetrics(page));
      const gate = cfg.a11yGate;
      const gatePrios: Record<"critical" | "serious" | "moderate", AxeViolationImpact[]> = {
        critical: ["critical"],
        serious: ["critical", "serious"],
        moderate: ["critical", "serious", "moderate"],
      };
      const blocking =
        gate === "off"
          ? []
          : raw.violations.filter(
              (v) => v.impact !== undefined && gatePrios[gate].includes(v.impact as AxeViolationImpact)
            );
      const failedManual = MANUAL_CHECKS.filter((c) => !c.check(metrics));
      const fatal = watch.pageErrors.length > 0 || watch.hydrationErrors.length > 0;
      const fail = blocking.length > 0 || failedManual.length > 0 || fatal || (res ? res.status() >= 400 : true);
      const actual =
        `http=${res?.status()} axeViolations=${raw.violations.length} blockingAxe=${blocking.map((b) => `${b.id}(${b.nodes})`).join(",") || "none"} ` +
        `manual=${failedManual.map((f) => f.id).join(",") || "none"} ${summarizeWatch(watch)}`;
      reporter.add({
        suite: "playwright-a11y",
        id: `a11y-${pageSpec.id}`,
        title: `Accessibility: ${pageSpec.title}`,
        route: pageSpec.path,
        test: `axe-core ${cfg.a11yGate}-and-above + landmark/h1/heading-order/44px/alt checks`,
        expected: "no critical/serious axe violations (per gate), one h1, landmarks, 44px targets, no heading skips",
        verdict: fail ? "FAIL" : "PASS",
        actual,
        timestamp: new Date().toISOString(),
        evidence: [
          ...blocking.map((b) => `axe ${b.id} (${b.impact}) nodes=${b.nodes} targets=${b.targets.slice(0, 3).join(" ")}`),
          ...failedManual.map((f) => `manual ${f.id} failed`),
        ],
      });
      if (fail) failed += 1;
    } catch (error) {
      const stack = error instanceof Error && error.stack ? error.stack.split("\n").slice(0, 6).join("\n") : "";
      const message = error instanceof Error ? error.message : String(error);
      reporter.add({
        suite: "playwright-a11y",
        id: `a11y-${pageSpec.id}`,
        title: `Accessibility: ${pageSpec.title}`,
        route: pageSpec.path,
        test: "axe scan",
        expected: "scan completes",
        verdict: "BLOCKED",
        actual: `${message}\n${stack}`,
        timestamp: new Date().toISOString(),
      });
      failed += 1;
    } finally {
      off();
      await ctx.close();
    }
  }
  await browser.close();
  return failed;
}