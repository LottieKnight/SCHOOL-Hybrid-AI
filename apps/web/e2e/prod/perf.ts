import type { Browser, BrowserContext, Page } from "playwright";

import type { Reporter } from "../../../../scripts/release-verify/result";
import { loadPlaywrightConfig } from "./config";
import { cdpEvaluate, newContext, openBrowser, watchPage, newWatch, summarizeWatch, settlePage } from "./harness";

interface PerfBundle {
  lcp?: number;
  cls?: number;
  inp?: number;
  ttfb?: number;
  transferBytes: number;
  jsBytes: number;
  imageBytes: number;
  fontBytes: number;
  cssBytes: number;
  requests: number;
  biggest: string[];
}

const INIT = `
  window.__perfz = {
    lcp: 0, cls: 0, inp: 0, entries: [],
  };
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === "largest-contentful-paint" && entry.startTime > 0) {
          window.__perfz.lcp = entry.startTime;
        }
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      let cls = window.__perfz.cls;
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) cls += entry.value;
      }
      window.__perfz.cls = cls;
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      let worst = window.__perfz.inp;
      for (const entry of list.getEntries()) {
        if (entry.interactionId && entry.duration > worst) worst = entry.duration;
      }
      window.__perfz.inp = worst;
    }).observe({ type: "event", buffered: true, durationThreshold: 16 });
  } catch (_) {}
`;

const PROFILES: Record<
  "mobile" | "desktop",
  {
    viewport: { width: number; height: number };
    userAgent: string | null;
    deviceScaleFactor: number;
    hasTouch: boolean;
    throttle: { downloadThroughput: number; uploadThroughput: number; latency: number } | null;
    cpuRate: number;
  }
> = {
  mobile: {
    viewport: { width: 390, height: 844 },
    userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    deviceScaleFactor: 3,
    hasTouch: true,
    throttle: { downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (768 * 1024) / 8, latency: 150 },
    cpuRate: 4,
  },
  desktop: {
    viewport: { width: 1440, height: 900 },
    userAgent: null,
    deviceScaleFactor: 1,
    hasTouch: false,
    throttle: null,
    cpuRate: 1,
  },
};

const PAGES: Array<{ path: string; id: string; title: string }> = [
  { path: "/", id: "home", title: "Home, guest" },
  { path: "/learn", id: "learn", title: "Learn hub" },
  { path: "/past-papers", id: "past-papers", title: "Past-papers catalog" },
  { path: "/community", id: "community", title: "Community hub" },
  { path: "/tutor", id: "assistant", title: "AI Tutor guest surface" },
];

const BUDGETS: Record<string, { lcpMs: number; cls: number; inpMs: number; ttfbMs: number; transferMb: number }> = {
  home: { lcpMs: 2500, cls: 0.1, inpMs: 200, ttfbMs: 800, transferMb: 2.5 },
  learn: { lcpMs: 2500, cls: 0.1, inpMs: 200, ttfbMs: 800, transferMb: 2.5 },
  "past-papers": { lcpMs: 3000, cls: 0.1, inpMs: 200, ttfbMs: 800, transferMb: 3 },
  community: { lcpMs: 3000, cls: 0.1, inpMs: 200, ttfbMs: 800, transferMb: 3 },
  assistant: { lcpMs: 3000, cls: 0.1, inpMs: 200, ttfbMs: 800, transferMb: 3 },
};

const COLLECT_PERF_EXPR = `(() => {
  const perfz = window.__perfz || { lcp: 0, cls: 0, inp: 0 };
  const naw = performance.getEntriesByType("navigation")[0];
  const ttfb = naw ? naw.responseStart - naw.requestStart : undefined;
  const res = performance.getEntriesByType("resource");
  const is = (e, kind, init) => (init ? e.initiatorType === init : true) && kind.test(e.name);
  let transferBytes = 0;
  let jsBytes = 0;
  let imageBytes = 0;
  let fontBytes = 0;
  let cssBytes = 0;
  for (const r of res) {
    const bytes = r.transferSize > 0 ? r.transferSize : r.encodedBodySize;
    transferBytes += bytes;
    if (is(r, /\\.(m?js)(\\?|$)/, "script")) jsBytes += bytes;
    else if (is(r, /\\.(png|jpe?g|webp|avif|gif|svg)(\\?|$)/)) imageBytes += bytes;
    else if (is(r, /\\.(woff2?|ttf|otf)(\\?|$)/)) fontBytes += bytes;
    else if (is(r, /\\.css(\\?|$)/, "css")) cssBytes += bytes;
  }
  const sized = res.filter((r) => r.transferSize > 0).sort((a, b) => b.transferSize - a.transferSize);
  return {
    lcp: perfz.lcp || undefined,
    cls: perfz.cls,
    inp: perfz.inp || undefined,
    ttfb,
    transferBytes,
    jsBytes,
    imageBytes,
    fontBytes,
    cssBytes,
    requests: res.length,
    biggest: sized.slice(0, 5).map((r) => Math.round(r.transferSize / 1024) + "KB " + r.name.slice(0, 120)),
  };
})()`;

function collectPerf(page: Page): Promise<PerfBundle> {
  return cdpEvaluate<PerfBundle>(page, COLLECT_PERF_EXPR);
}

export async function runPerf(reporter: Reporter): Promise<number> {
  const cfg = loadPlaywrightConfig();
  if (!cfg.baseUrl) {
    reporter.add({ suite: "playwright-perf", id: "perf-config", title: "Base URL required", test: "configuration", expected: "BASE_URL set", verdict: "BLOCKED", actual: "BASE_URL unset", timestamp: new Date().toISOString() });
    return 1;
  }
  const browser: Browser = await openBrowser({ headless: cfg.headless, slow: cfg.slowMotionMs });
  let failed = 0;
  const profiles: Array<"mobile" | "desktop"> = ["desktop", ...(cfg.concurrent ? ["mobile" as const] : [])];
  for (const profile of profiles) {
    for (const pageSpec of PAGES) {
      const p = PROFILES[profile];
      const ctx: BrowserContext = await newContext(browser, {
        viewport: p.viewport,
        userAgent: p.userAgent ?? undefined,
        deviceScaleFactor: p.deviceScaleFactor,
        hasTouch: p.hasTouch,
        isMobile: profile === "mobile",
      });
      await ctx.addInitScript(INIT);
      const page: Page = await ctx.newPage();
      const watch = newWatch();
      const off = watchPage(page, watch);
      const cdp = await ctx.newCDPSession(page);
      try {
        await cdp.send("Network.emulateNetworkConditions", {
          offline: false,
          latency: p.throttle?.latency ?? 0,
          downloadThroughput: p.throttle?.downloadThroughput ?? 0,
          uploadThroughput: p.throttle?.uploadThroughput ?? 0,
        });
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: p.cpuRate });
        const navStarted = Date.now();
        const res = await page.goto(`${cfg.baseUrl}${pageSpec.path}`, { waitUntil: "load" });
        await settlePage(page);
        const navMs = Date.now() - navStarted;
        const perf = await collectPerf(page);
        const budget = BUDGETS[pageSpec.id] ?? BUDGETS.home;
        const results: string[] = [];
        const failures: string[] = [];
        const reportMetric = (label: string, v: number | undefined, budgetVal: number, unit: string) => {
          const ok = typeof v === "number" && v <= budgetVal;
          results.push(`${label}=${typeof v === "number" ? v.toFixed(1) : "n/a"}${unit}${ok ? "" : " OVER"}`);
          if (!ok && typeof v === "number") failures.push(`${label} ${v.toFixed(0)} > budget ${budgetVal}${unit}`);
        };
        reportMetric("LCP", perf.lcp, budget.lcpMs, "ms");
        reportMetric("CLS", perf.cls, budget.cls, "");
        reportMetric("INP", perf.inp, budget.inpMs, "ms");
        reportMetric("TTFB", perf.ttfb, budget.ttfbMs, "ms");
        reportMetric("transfer", perf.transferBytes / (1024 * 1024), budget.transferMb, "MB");
        const fatal = watch.pageErrors.length > 0 || watch.hydrationErrors.length > 0;
        const verdict = res && res.status() < 400 && !fatal && failures.length === 0 ? "PASS" : "FAIL";
        reporter.add({
          suite: "playwright-perf",
          id: `perf-${pageSpec.id}-${profile}`,
          title: `Performance: ${pageSpec.title} (${profile})`,
          route: pageSpec.path,
          test: "LCP/INP/CLS/TTFB observers + resource payload breakdown under throttling",
          expected: `within budgets ${JSON.stringify(budget)}`,
          verdict,
          actual: `navMs=${navMs} ${results.join(" ")} reqs=${perf.requests} js=${bytes(perf.jsBytes)} img=${bytes(perf.imageBytes)} font=${bytes(perf.fontBytes)} css=${bytes(perf.cssBytes)} ${summarizeWatch(watch)}`,
          timestamp: new Date().toISOString(),
          evidence: [...failures, ...perf.biggest],
        });
        if (verdict === "FAIL") failed += 1;
      } catch (error) {
        reporter.add({
          suite: "playwright-perf",
          id: `perf-${pageSpec.id}-${profile}`,
          title: `Performance: ${pageSpec.title} (${profile})`,
          route: pageSpec.path,
          test: "perf measurement",
          expected: "measurement completes",
          verdict: "BLOCKED",
          actual: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
        failed += 1;
      } finally {
        off();
        void cdp.detach().catch(() => {});
        await ctx.close();
      }
    }
  }
  await browser.close();
  return failed;
}

function bytes(n: number): string {
  const mb = n / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(2)}MB` : `${Math.round(n / 1024)}KB`;
}