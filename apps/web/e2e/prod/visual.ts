import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Browser, BrowserContext, Page } from "playwright";

import type { Reporter } from "../../../../scripts/release-verify/result";
import { loadPlaywrightConfig } from "./config";
import { cdpEvaluate, newContext, newWatch, openBrowser, settlePage, summarizeWatch, watchPage } from "./harness";

/**
 * 18-viewport responsive matrix (documented spec: 320×568 → 3440×1440,
 * portrait + landscape, rounded to common device sizes).
 */
export const VIEWPORTS: Array<{ id: string; width: number; height: number; note: string }> = [
  { id: "xs-port", width: 320, height: 568, note: "iPhone SE 1st-gen / old small phones" },
  { id: "xs-land", width: 568, height: 320, note: "small phone landscape" },
  { id: "sm-port", width: 375, height: 667, note: "iPhone 8 / 11, small phones" },
  { id: "sm-land", width: 667, height: 375, note: "small phone landscape 2" },
  { id: "md-port", width: 390, height: 844, note: "iPhone 12–15" },
  { id: "md-land", width: 844, height: 390, note: "iPhone landscape" },
  { id: "lg-port", width: 430, height: 932, note: "iPhone Pro Max / large phones" },
  { id: "lg-land", width: 932, height: 430, note: "large phone landscape" },
  { id: "xl-port", width: 768, height: 1024, note: "iPad portrait" },
  { id: "xl-land", width: 1024, height: 768, note: "iPad landscape" },
  { id: "2xl", width: 1280, height: 800, note: "small laptop" },
  { id: "3xl-port", width: 820, height: 1180, note: "large tablets portrait" },
  { id: "3xl-land", width: 1180, height: 820, note: "large tablets landscape" },
  { id: "4xl", width: 1440, height: 900, note: "primary design width" },
  { id: "5xl", width: 1920, height: 1080, note: "full-HD desktop" },
  { id: "6xl", width: 2560, height: 1440, note: "QHD desktop" },
  { id: "7xl", width: 3440, height: 1440, note: "ultrawide desktop" },
  { id: "bowtie", width: 800, height: 600, note: "netbook / windowed resize" },
];

const PAGES: Array<{ path: string; id: string; title: string }> = [
  { path: "/", id: "home", title: "Home, guest" },
  { path: "/past-papers", id: "past-papers", title: "Past-papers catalog" },
  { path: "/community", id: "community", title: "Community hub" },
  { path: "/dashboard", id: "dashboard", title: "Dashboard (guest-facing gate)" },
  { path: "/tutor", id: "assistant", title: "AI Tutor guest surface" },
];

interface LayoutIssues {
  horizontalOverflow: boolean;
  bodyOverflow: boolean;
  overflowEls: number;
  clippedFixed: boolean;
  clippedSticky: boolean;
  smallTouchTargets: number;
  offscreenStacks: number;
  tallestOverflow: number;
}

const SCAN_LAYOUT_EXPR = `(() => {
  const doc = document;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const els = Array.from(doc.querySelectorAll("body *"));
  const overflowCount = els.filter((el) => {
    if (el.tagName === "HTML" || el.tagName === "BODY") return false;
    const s = getComputedStyle(el);
    if (s.overflowX !== "visible") return false;
    return el.scrollWidth > el.clientWidth + 8;
  }).length;
  const bodyOverflow = doc.documentElement.scrollWidth > vw + 4 || doc.body.scrollWidth > vw + 4;
  const clippedFixed = els.filter((el) => {
    const s = getComputedStyle(el);
    if (s.position !== "fixed" && s.position !== "sticky") return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 && r.height <= 0) return false;
    if (r.right <= 0 || r.left >= vw || r.bottom <= 0 || r.top >= vh) return false;
    return r.right > vw + 4 || r.left < -4 || r.bottom > vh + 4 || r.top < -4;
  });
  const smallTargets = Array.from(doc.querySelectorAll("a,button,[role=button]")).filter((el) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || (el).hidden) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    return r.width < 44 && r.height < 44;
  }).length;
  let offscreenStacks = 0;
  for (const el of Array.from(doc.querySelectorAll("[class*=card],[class*=grid],[style],div"))) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.left > vw + 16) offscreenStacks += 1;
  }
  const tallestOverflow = Math.max(0, doc.documentElement.scrollWidth - doc.documentElement.clientWidth);
  return {
    horizontalOverflow: bodyOverflow || overflowCount > 0 || tallestOverflow > 4,
    bodyOverflow,
    overflowEls: overflowCount,
    clippedFixed: clippedFixed.length > 0,
    clippedSticky: els.filter((el) => getComputedStyle(el).position === "sticky").length > 0,
    smallTouchTargets: smallTargets,
    offscreenStacks,
    tallestOverflow,
  };
})()`;

function scanLayout(page: Page): Promise<LayoutIssues> {
  return cdpEvaluate<LayoutIssues>(page, SCAN_LAYOUT_EXPR);
}

const SCREEN_RATIOS: Array<{ id: string; min: number; max: number; note: string }> = [
  { id: "narrow-phone", min: 0.35, max: 0.6, note: "9:16 phones (e.g. 390÷844≈0.46)" },
  { id: "mid-phone", min: 0.6, max: 0.8, note: "phablets, small tablets" },
  { id: "tablet", min: 0.8, max: 1.0, note: "4:3 / 3:4 tablets" },
  { id: "desktop", min: 1.2, max: 2.0, note: "16:10 / 16:9 desktop" },
  { id: "wide-landscape", min: 2.0, max: 2.24, note: "tall phones in landscape (e.g. 844÷390≈2.16)" },
  { id: "ultrawide", min: 2.24, max: 2.6, note: "21:9 displays ~2.38" },
];

export async function runVisual(reporter: Reporter): Promise<number> {
  const cfg = loadPlaywrightConfig();
  if (!cfg.baseUrl) {
    reporter.add({ suite: "playwright-visual", id: "visual-config", title: "Base URL required", test: "configuration", expected: "BASE_URL set", verdict: "BLOCKED", actual: "BASE_URL unset", timestamp: new Date().toISOString() });
    return 1;
  }
  const browser: Browser = await openBrowser({ headless: cfg.headless, slow: cfg.slowMotionMs });
  const shotRoot = path.join(cfg.outputDir, "screenshots");
  mkdirSync(shotRoot, { recursive: true });
  let failed = 0;
  for (const vp of VIEWPORTS) {
    const ctx: BrowserContext = await newContext(browser, { viewport: { width: vp.width, height: vp.height } });
    const page: Page = await ctx.newPage();
    const watch = newWatch();
    const off = watchPage(page, watch);
    try {
      const issues: string[] = [];
      for (const pageSpec of PAGES) {
        let res: import("playwright").Response | null = null;
        let tries = 0;
        for (;;) {
          tries += 1;
          try {
            res = await page.goto(`${cfg.baseUrl}${pageSpec.path}`, { waitUntil: "load", timeout: 45_000 });
            break;
          } catch (err) {
            if (tries >= 3 || !(err instanceof Error) || !/Timeout|ERR_TIMED_OUT|net::|interrupted/.test(err.message)) throw err;
            await new Promise((r) => setTimeout(r, 1500));
          }
        }
        await settlePage(page);
        const layout = await scanLayout(page);
        const label = `${vp.id}-${pageSpec.id}`;
        const problems: string[] = [];
        const docLeak = layout.tallestOverflow > 4 || layout.bodyOverflow;
        if (docLeak) problems.push(`h-overflow(tail=${layout.tallestOverflow}px)`);
        if (layout.clippedFixed) problems.push("clipped fixed element");
        if (layout.smallTouchTargets > 0) problems.push(`smallTouchTargets=${layout.smallTouchTargets}`);
        const fatal = watch.pageErrors.length > 0 || watch.hydrationErrors.length > 0;
        if (fatal) problems.push(`pageRenderedFatal(${watch.pageErrors.length + watch.hydrationErrors.length})`);
        if (res && res.status() >= 400) problems.push(`http ${res.status()}`);
        await page.screenshot({ path: path.join(shotRoot, `${label}.png`), fullPage: true });
        const pass = problems.length === 0;
        const soft = layout.overflowEls > 0 || layout.offscreenStacks > 0;
        if (!pass || soft) issues.push(`${pageSpec.path}: ${problems.join(", ")}${soft ? ` [soft: overflowEls=${layout.overflowEls}, offscreenStacks=${layout.offscreenStacks}]` : ""}`);
      }
      // screen-ratio audit (aspect-ratio per viewport)
      const ratio = +(vp.width / vp.height).toFixed(2);
      const bucket = SCREEN_RATIOS.find((r) => ratio >= r.min && ratio <= r.max);
      const bucketOk = Boolean(bucket);
      const verdict = issues.length === 0 && bucketOk ? "PASS" : "FAIL";
      reporter.add({
        suite: "playwright-visual",
        id: `visual-${vp.id}`,
        title: `Responsive: ${vp.width}×${vp.height} (${vp.note})`,
        route: `${PAGES.map((p) => p.path).join(",")}`,
        test: "overflow / clipped fixed / touch targets / offscreen elements + screen-ratio bucket",
        expected: `no horizontal overflow, no clipped fixed/sticky, touch targets ≥44px, ratio ${ratio} falls in a documented bucket ${bucket?.id}`,
        verdict,
        actual: `ratio=${ratio} bucket=${bucket?.id ?? "UNMATCHED"} ${issues.length ? `issues: ${issues.join(" | ")}` : "no layout issues"} ${summarizeWatch(watch)}`,
        timestamp: new Date().toISOString(),
        evidence: issues.length ? issues : ["no layout issues across 5 pages"],
      });
      if (verdict === "FAIL") failed += 1;
    } catch (error) {
      reporter.add({
        suite: "playwright-visual",
        id: `visual-${vp.id}`,
        title: `Responsive: ${vp.width}×${vp.height}`,
        route: PAGES.map((p) => p.path).join(","),
        test: "responsive scan",
        expected: "scan completes",
        verdict: "BLOCKED",
        actual: error instanceof Error ? error.message : String(error),
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