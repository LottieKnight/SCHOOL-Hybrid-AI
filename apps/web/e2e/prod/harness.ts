import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type BrowserContextOptions, type ConsoleMessage, type Page, type Request, type Response } from "playwright";

import { redactText } from "../../../../scripts/release-verify/result";
import { loadPlaywrightConfig } from "./config";

export interface PageWatch {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  badResponses: string[];
  hydrationErrors: string[];
}

export function newWatch(): PageWatch {
  return { consoleErrors: [], pageErrors: [], failedRequests: [], badResponses: [], hydrationErrors: [] };
}

export function watchPage(page: Page, watch: PageWatch): () => void {
  const onConsole = (msg: ConsoleMessage) => {
    const text = msg.text();
    if (msg.type() === "error") watch.consoleErrors.push(redactText(text).slice(0, 500));
    if (/hydrat/i.test(text)) watch.hydrationErrors.push(redactText(text).slice(0, 500));
  };
  const onPageError = (err: Error) => {
    watch.pageErrors.push(redactText(err.message).slice(0, 800));
  };
  const onRequestFailed = (req: Request) => {
    watch.failedRequests.push(`${req.failure()?.errorText ?? "failed"} :: ${req.url()}`);
  };
  const onResponse = (res: Response) => {
    const s = res.status();
    if (s >= 400) watch.badResponses.push(`${s} :: ${res.url()}`);
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("requestfailed", onRequestFailed);
  page.on("response", onResponse);
  return () => {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    page.off("requestfailed", onRequestFailed);
    page.off("response", onResponse);
  };
}

export function summarizeWatch(watch: PageWatch): string {
  const parts: string[] = [];
  parts.push(`consoleErrors=${watch.consoleErrors.length}`);
  parts.push(`pageErrors=${watch.pageErrors.length}`);
  parts.push(`failedRequests=${watch.failedRequests.length}`);
  parts.push(`badResponses=${watch.badResponses.length}`);
  parts.push(`hydration=${watch.hydrationErrors.length}`);
  return parts.join(" ");
}

/** Wait for the page to stop loading dependencies, then a short settle, so that
 * measurement/scanning doesn't race Next.js RSC chunk evaluation (which can
 * transiently break page.evaluate on the live origin). */
export async function settlePage(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(300);
}

/** Run a page-side scan with one retry for transient evaluate failures caused
 * by in-flight chunk evaluation on the live origin. */
export async function withRetry<T>(thunk: () => Promise<T>): Promise<T> {
  try {
    return await thunk();
  } catch (error) {
    if (error instanceof Error && /is not defined/.test(error.message)) {
      await new Promise((r) => setTimeout(r, 1200));
      return thunk();
    }
    throw error;
  }
}

/**
 * Evaluate a self-contained expression string in the page MAIN world via CDP,
 * bypassing Playwright's toString()+eval wrapper. That wrapper is safe for
 * simple callbacks but can break when esbuild name-decorates (`__name(...)`)
 * named functions inside serialized arrows on the live origin. Expression
 * strings are under our control so they never carry esbuild helpers.
 */
export async function cdpEvaluate<T>(page: Page, expression: string): Promise<T> {
  const client = await page.context().newCDPSession(page);
  try {
    const result = await client.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      const details = result.exceptionDetails;
      const description =
        details.exception?.description ?? details.exception?.value ?? details.text ?? "evaluation failed";
      throw new Error(String(description));
    }
    return result.result.value as T;
  } finally {
    await client.detach().catch(() => {});
  }
}

export async function openBrowser(opts: { slow?: number; headless?: boolean } = {}): Promise<Browser> {
  const headless = opts.headless !== false;
  const slowMo = opts.slow ?? 0;
  try {
    return await chromium.launch({ headless, slowMo });
  } catch (error) {
    const pinned = chromium.executablePath();
    if (pinned && !existsSync(pinned)) {
      const alt = findInstalledChromium();
      if (alt) {
        return chromium.launch({ headless, slowMo, executablePath: alt });
      }
    }
    throw error;
  }
}

/**
 * Locates an already-downloaded Chromium revision in the Playwright cache when
 * the revision pinned by this dependency set is missing (no network install
 * required). Heads-up: the found build may be newer than the pinned one.
 */
function findInstalledChromium(): string | undefined {
  const cache = path.join(os.homedir(), ".cache", "ms-playwright");
  if (!existsSync(cache)) return undefined;
  const candidates: string[] = [];
  for (const entry of readdirSync(cache).sort()) {
    if (entry.startsWith("chromium-")) {
      candidates.push(path.join(cache, entry, "chrome-linux64", "chrome"));
      candidates.push(path.join(cache, entry, "chrome-linux", "chrome"));
    }
    if (entry.startsWith("chromium_headless_shell-")) {
      candidates.push(path.join(cache, entry, "chrome-headless-shell-linux64", "chrome-headless-shell"));
    }
  }
  return candidates.find((c) => existsSync(c));
}

export function newContext(
  browser: Browser,
  opts: Partial<BrowserContextOptions> & { locale?: string } = {}
): Promise<BrowserContext> {
  const config = loadPlaywrightConfig();
  const ctxOpts: BrowserContextOptions = {
    ...opts,
    locale: opts.locale ?? "en-ZA",
    viewport: opts.viewport ?? { width: 1440, height: 900 },
    serviceWorkers: "block",
  };
  return (async () => {
    const ctx = await browser.newContext(ctxOpts);
    ctx.setDefaultTimeout(config.timeoutMs);
    ctx.setDefaultNavigationTimeout(config.timeoutMs);
    return ctx;
  })();
}

export function axesPath(): string {
  return path.resolve(process.cwd(), "node_modules/axe-core/axe.min.js");
}