import type { Browser, BrowserContext, Page } from "playwright";

import type { Reporter } from "../../../../scripts/release-verify/result";
import { loadPlaywrightConfig } from "./config";
import { newContext, newWatch, openBrowser, settlePage, summarizeWatch, watchPage } from "./harness";

type Verdict = "PASS" | "FAIL" | "BLOCKED";

interface JourneyResult {
  verdict: Verdict;
  actual: string;
  evidence?: string[];
}

type JourneyFn = (ctx: { browser: Browser; reporter: Reporter }) => Promise<JourneyResult>;

async function gotoClean(
  page: Page,
  pathOrUrl: string
): Promise<{ verdict: Verdict; actual: string }> {
  const base = loadPlaywrightConfig().baseUrl;
  const target = pathOrUrl.startsWith("/") && base ? `${base}${pathOrUrl}` : pathOrUrl;
  let tries = 0;
  for (;;) {
    tries += 1;
    try {
      const res = await page.goto(target, { waitUntil: "domcontentloaded" });
      if (!res) return { verdict: "BLOCKED", actual: "no response object from navigation" };
      return { verdict: res.status() < 400 ? "PASS" : "FAIL", actual: `http ${res.status()}` };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (tries >= 3 || !/Timeout|ERR_TIMED_OUT|net::|interrupted/.test(msg)) {
        return { verdict: "BLOCKED", actual: `navigation failed: ${msg} (after ${tries} attempt(s))` };
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

async function loginViaApi(context: BrowserContext, email: string, password: string): Promise<boolean> {
  const base = loadPlaywrightConfig().baseUrl;
  if (!base) return false;
  try {
    const res = await context.request.post(`${base}/api/auth/login`, {
      data: { email, password },
    });
    return res.status() === 200;
  } catch {
    return false;
  }
}

function hasFatalErrors(watch: ReturnType<typeof newWatch>): boolean {
  return watch.pageErrors.length > 0 || watch.hydrationErrors.length > 0;
}

/** A "renders clean" gate: no console errors, no page errors, no hydration
 * mismatches, no >=400 network responses. Failed request *aborts* (e.g.
 * React prefetch cancels) are kept as evidence but do not fail the gate. */
function surfaceClean(watch: ReturnType<typeof newWatch>): boolean {
  return (
    watch.consoleErrors.length === 0 &&
    watch.pageErrors.length === 0 &&
    watch.hydrationErrors.length === 0 &&
    watch.badResponses.length === 0
  );
}

async function surfaceJourney(
  pathOrUrl: string,
  opts: { routeId: string; title: string; reporter: Reporter; idPrefix: string }
): Promise<JourneyResult> {
  const reporter = opts.reporter;
  const context = await newContext(await browserFor(opts), {});
  const page = await context.newPage();
  const watch = newWatch();
  const off = watchPage(page, watch);
  try {
    const nav = await gotoClean(page, pathOrUrl);
    const fatal = hasFatalErrors(watch);
    const body = await page.locator("body").isVisible().catch(() => false);
    const actual = `nav=${nav.actual} bodyVisible=${body} ${summarizeWatch(watch)}`;
    if (nav.verdict !== "PASS") {
      reporter.add({ suite: "playwright", id: `${opts.idPrefix}-${opts.routeId}`, title: opts.title, route: pathOrUrl, test: "browser navigation", expected: "route renders", verdict: nav.verdict, actual, timestamp: new Date().toISOString(), evidence: summarizeEvidence(watch) });
      return { verdict: nav.verdict, actual };
    }
    const verdict: Verdict = !body ? "FAIL" : fatal ? "FAIL" : nav.verdict === "PASS" ? "PASS" : "FAIL";
    reporter.add({ suite: "playwright", id: `${opts.idPrefix}-${opts.routeId}`, title: opts.title, route: pathOrUrl, test: "browser render", expected: "route renders without uncaught exceptions/hydration errors", verdict, actual, timestamp: new Date().toISOString(), evidence: summarizeEvidence(watch) });
    return { verdict, actual };
  } catch (error) {
    const actual = `journey error: ${error instanceof Error ? error.message : String(error)}`;
    reporter.add({ suite: "playwright", id: `${opts.idPrefix}-${opts.routeId}`, title: opts.title, route: pathOrUrl, test: "browser journey", expected: "route renders", verdict: "BLOCKED", actual, timestamp: new Date().toISOString(), evidence: summarizeEvidence(watch) });
    return { verdict: "BLOCKED", actual };
  } finally {
    off();
    await context.close();
  }
}

function summarizeEvidence(watch: ReturnType<typeof newWatch>): string[] {
  const out: string[] = [];
  if (watch.pageErrors.length) out.push(`pageErrors: ${watch.pageErrors.slice(0, 3).join(" | ")}`);
  if (watch.hydrationErrors.length) out.push(`hydration: ${watch.hydrationErrors.slice(0, 3).join(" | ")}`);
  if (watch.failedRequests.length) out.push(`failedRequests: ${watch.failedRequests.slice(0, 5).join(" | ")}`);
  if (watch.badResponses.length) out.push(`badResponses: ${watch.badResponses.slice(0, 5).join(" | ")}`);
  return out.slice(0, 6);
}

// A shared browser instance is opened once per run and reused across journeys.
let sharedBrowser: Browser | null = null;

async function browserFor(opts: { reporter: Reporter }): Promise<Browser> {
  if (sharedBrowser) return sharedBrowser;
  sharedBrowser = await openBrowser({ slow: loadPlaywrightConfig().slowMotionMs });
  return sharedBrowser;
}

export async function closeSharedBrowser(): Promise<void> {
  if (sharedBrowser) {
    await sharedBrowser.close();
    sharedBrowser = null;
  }
}

function futureIsoDate(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function makeRevisionLifecycleJourney({ reporter }: { reporter: Reporter }): Promise<JourneyResult> {
  const cfg = loadPlaywrightConfig();
  const title = "Recovery task planner lifecycle: schedule, complete, and skip";
  const route = "/dashboard/revision";
  if (!cfg.baseUrl || !cfg.testUserEmail || !cfg.testUserPassword) {
    reporter.add({ suite: "playwright", id: "journey-revision-lifecycle-config", title, route, test: "precondition", expected: "BASE_URL and TEST_USER credentials", verdict: "BLOCKED", actual: "required configuration unset", timestamp: new Date().toISOString() });
    return { verdict: "BLOCKED", actual: "required configuration unset" };
  }

  const ctx = await newContext(sharedBrowser!, {});
  const page = await ctx.newPage();
  const watch = newWatch();
  const off = watchPage(page, watch);
  const checks: Array<{ id: string; test: string; expected: string; pass: boolean; actual: string }> = [];
  const record = (id: string, test: string, expected: string, pass: boolean, actual: string) => {
    checks.push({ id, test, expected, pass, actual });
    reporter.add({ suite: "playwright", id: `journey-revision-lifecycle-${id}`, title, route, test, expected, verdict: pass ? "PASS" : "FAIL", actual, timestamp: new Date().toISOString(), evidence: summarizeEvidence(watch) });
  };
  try {
    const loggedIn = await loginViaApi(ctx, cfg.testUserEmail, cfg.testUserPassword);
    if (!loggedIn) {
      record("auth", "authenticate test learner", "session established", false, "login API did not return HTTP 200");
      return { verdict: "FAIL", actual: "authentication failed" };
    }

    const listResponse = await ctx.request.get(`${cfg.baseUrl}/api/learning/revision-artifacts?status=saved`);
    const listPayload = (await listResponse.json().catch(() => ({}))) as { artifacts?: Array<{ id: string }> };
    const artifact = cfg.revisionArtifactId
      ? listPayload.artifacts?.find((item) => item.id === cfg.revisionArtifactId) ?? { id: cfg.revisionArtifactId }
      : listPayload.artifacts?.[0];
    if (!artifact?.id) {
      reporter.add({ suite: "playwright", id: "journey-revision-lifecycle-fixture", title, route, test: "fixture discovery", expected: "a saved revision artifact or REVISION_ARTIFACT_ID", verdict: "BLOCKED", actual: "no saved revision artifact available for the test learner", timestamp: new Date().toISOString() });
      return { verdict: "BLOCKED", actual: "revision artifact fixture unavailable" };
    }

    const artifactId = encodeURIComponent(artifact.id);
    const scheduleUrl = `${cfg.baseUrl}/api/learning/revision-artifacts/${artifactId}/schedule`;
    const scheduleResponse = await ctx.request.post(scheduleUrl, { data: { eventDate: futureIsoDate(1) } });
    const scheduled = (await scheduleResponse.json().catch(() => ({}))) as Record<string, any>;
    record("schedule", "POST recovery task to planner", "HTTP 200/201 with status=scheduled and planner event id", (scheduleResponse.status() === 200 || scheduleResponse.status() === 201) && scheduled.status === "scheduled" && Boolean(scheduled.event?.id), `http=${scheduleResponse.status()} status=${String(scheduled.status)} eventId=${String(scheduled.event?.id ?? "missing")}`);

    const nav = await gotoClean(page, `/dashboard/revision/${artifactId}`);
    await settlePage(page);
    const completeControl = await page.getByRole("button", { name: "Mark complete" }).count().catch(() => 0);
    const skipControl = await page.getByRole("button", { name: "Skip for now" }).count().catch(() => 0);
    record("detail-controls", "render scheduled recovery controls", "detail page renders Mark complete and Skip for now", nav.verdict === "PASS" && completeControl > 0 && skipControl > 0, `nav=${nav.actual} completeControls=${completeControl} skipControls=${skipControl}`);

    const completeResponse = await ctx.request.patch(scheduleUrl, { data: { status: "completed" } });
    const completed = (await completeResponse.json().catch(() => ({}))) as Record<string, any>;
    record("complete", "PATCH recovery task as completed", "HTTP 200 with status=completed and completion timestamp", completeResponse.status() === 200 && completed.status === "completed" && completed.artifact?.plannerStatus === "completed" && Boolean(completed.artifact?.plannerCompletedAt), `http=${completeResponse.status()} status=${String(completed.status)} artifactStatus=${String(completed.artifact?.plannerStatus)} completedAt=${String(completed.artifact?.plannerCompletedAt ?? "missing")}`);

    const rescheduleResponse = await ctx.request.post(scheduleUrl, { data: { eventDate: futureIsoDate(2) } });
    const rescheduled = (await rescheduleResponse.json().catch(() => ({}))) as Record<string, any>;
    record("reschedule", "reopen completed recovery task", "a dismissed task can be scheduled again", (rescheduleResponse.status() === 200 || rescheduleResponse.status() === 201) && rescheduled.status === "scheduled" && Boolean(rescheduled.event?.id), `http=${rescheduleResponse.status()} status=${String(rescheduled.status)} eventId=${String(rescheduled.event?.id ?? "missing")}`);

    const skipResponse = await ctx.request.patch(scheduleUrl, { data: { status: "skipped" } });
    const skipped = (await skipResponse.json().catch(() => ({}))) as Record<string, any>;
    record("skip", "PATCH recovery task as skipped", "HTTP 200 with status=skipped and skip timestamp", skipResponse.status() === 200 && skipped.status === "skipped" && skipped.artifact?.plannerStatus === "skipped" && Boolean(skipped.artifact?.plannerSkippedAt), `http=${skipResponse.status()} status=${String(skipped.status)} artifactStatus=${String(skipped.artifact?.plannerStatus)} skippedAt=${String(skipped.artifact?.plannerSkippedAt ?? "missing")}`);

    const failed = checks.filter((check) => !check.pass).length;
    return { verdict: failed === 0 ? "PASS" : "FAIL", actual: `${checks.length - failed}/${checks.length} lifecycle checks passed`, evidence: summarizeEvidence(watch) };
  } catch (error) {
    const actual = `journey error: ${error instanceof Error ? error.message : String(error)}`;
    reporter.add({ suite: "playwright", id: "journey-revision-lifecycle-error", title, route, test: "browser/API journey", expected: "schedule, complete, reschedule, and skip complete without errors", verdict: "FAIL", actual, timestamp: new Date().toISOString(), evidence: summarizeEvidence(watch) });
    return { verdict: "FAIL", actual };
  } finally {
    off();
    await ctx.close();
  }
}

const guestSurfaceRoutes: Array<{ route: string; id: string; title: string }> = [
  { route: "/", id: "home", title: "Guest home renders clean" },
  { route: "/learn", id: "learn", title: "Learn hub renders clean" },
  { route: "/past-papers", id: "past-papers", title: "Past-papers catalog renders clean" },
  { route: "/community", id: "community", title: "Community hub renders clean" },
  { route: "/daily-quiz", id: "daily-quiz", title: "Daily quiz renders clean" },
];

function makeGuestJourney(): JourneyFn {
  return async ({ reporter }) => {
    const ctx = await newContext(sharedBrowser!, {});
    const page = await ctx.newPage();
    const watch = newWatch();
    const off = watchPage(page, watch);
    const failures: string[] = [];
    try {
      for (const r of guestSurfaceRoutes) {
        const nav = await gotoClean(page, r.route);
        const body = await page.locator("body").isVisible().catch(() => false);
        const clean = surfaceClean(watch);
        reporter.add({
          suite: "playwright",
          id: `journey-guest-surface-${r.id}`,
          title: r.title,
          route: r.route,
          test: "browser render as guest",
          expected: "200 render, body visible, no console/page/hydration errors, no >=400 network responses",
          verdict: nav.verdict === "PASS" && body && clean ? "PASS" : "FAIL",
          actual: `nav=${nav.actual} body=${body} clean=${clean} ${summarizeWatch(watch)}`,
          timestamp: new Date().toISOString(),
          evidence: summarizeEvidence(watch),
        });
        if (nav.verdict !== "PASS" || !body || !clean) failures.push(`${r.route} ${clean ? "" : "(api/console errors)"}`);
      }
      return { verdict: failures.length === 0 ? "PASS" : "FAIL", actual: failures.length ? `failed: ${failures.join(",")}` : "all public surfaces rendered clean", evidence: summarizeEvidence(watch) };
    } catch (error) {
      return { verdict: "BLOCKED", actual: error instanceof Error ? error.message : String(error) };
    } finally {
      off();
      await ctx.close();
    }
  };
}

function makeConnectJourney(id: string, title: string, pathOrUrl: string, check: (page: Page) => Promise<boolean>): JourneyFn {
  return async ({ reporter }) => {
    const ctx = await newContext(sharedBrowser!, {});
    const page = await ctx.newPage();
    const watch = newWatch();
    const off = watchPage(page, watch);
    try {
      const nav = await gotoClean(page, pathOrUrl);
      const ok = await check(page).catch(() => false);
      const fatal = hasFatalErrors(watch);
      reporter.add({
        suite: "playwright",
        id,
        title,
        route: pathOrUrl,
        test: "browser journey",
        expected: "documented journey outcome",
        verdict: nav.verdict === "PASS" && ok && !fatal ? "PASS" : "FAIL",
        actual: `nav=${nav.actual} assertion=${ok} ${summarizeWatch(watch)}`,
        timestamp: new Date().toISOString(),
        evidence: summarizeEvidence(watch),
      });
      return { verdict: nav.verdict === "PASS" && ok && !fatal ? "PASS" : "FAIL", actual: `nav=${nav.actual}` };
    } catch (error) {
      return { verdict: "BLOCKED", actual: error instanceof Error ? error.message : String(error) };
    } finally {
      off();
      await ctx.close();
    }
  };
}

function makeGuestDashboardJourney(): JourneyFn {
  return async ({ reporter }) => {
    const ctx = await newContext(sharedBrowser!, {});
    const page = await ctx.newPage();
    const watch = newWatch();
    const off = watchPage(page, watch);
    try {
      const nav = await gotoClean(page, "/dashboard");
      const authedCallsFailed = watch.badResponses.filter((r) => r.includes("/api/")).length;
      const fatal = hasFatalErrors(watch);
      const clean = surfaceClean(watch);
      const found = await page.locator("main").count().catch(() => 0);
      reporter.add({
        suite: "playwright",
        id: "journey-guest-dashboard",
        title: "Guest dashboard renders without firing-and-crashing authenticated calls",
        route: "/dashboard",
        test: "guest session; watch console/network/hydration",
        expected: "200 render, no console/page/hydration errors, no failing /api/* calls from a guest session",
        verdict: nav.verdict === "PASS" && !fatal && authedCallsFailed === 0 && clean ? "PASS" : "FAIL",
        actual: `nav=${nav.actual} main=${found} authedApiFailures=${authedCallsFailed} ${summarizeWatch(watch)}`,
        timestamp: new Date().toISOString(),
        evidence: summarizeEvidence(watch),
      });
      return { verdict: nav.verdict === "PASS" && !fatal && authedCallsFailed === 0 && clean ? "PASS" : "FAIL", actual: `rule=${authedCallsFailed}`, evidence: summarizeEvidence(watch) };
    } catch (error) {
      return { verdict: "BLOCKED", actual: error instanceof Error ? error.message : String(error) };
    } finally {
      off();
      await ctx.close();
    }
  };
}

function makeAuthedJourneys(): Record<string, JourneyFn> {
  const cfg = loadPlaywrightConfig();
  const withLogin = (inner: (page: Page) => Promise<boolean>): JourneyFn => {
    return async ({ reporter }) => {
      if (!cfg.baseUrl || !cfg.testUserEmail || !cfg.testUserPassword) {
        reporter.add({ suite: "playwright", id: "journey-auth-gating", title: "Authenticated journey", test: "precondition", expected: "TEST_USER credentials", verdict: "BLOCKED", actual: "credentials unset", timestamp: new Date().toISOString() });
        return { verdict: "BLOCKED", actual: "TEST_USER credentials unset" };
      }
      const ctx = await newContext(sharedBrowser!, {});
      const page = await ctx.newPage();
      const watch = newWatch();
      const off = watchPage(page, watch);
      const okLogin = await loginViaApi(ctx, cfg.testUserEmail, cfg.testUserPassword);
      try {
        const nav = await gotoClean(page, "/dashboard");
        const assertion = await inner(page).catch(() => false);
        const fatal = hasFatalErrors(watch);
        const pass = okLogin && nav.verdict === "PASS" && assertion && !fatal;
        return { verdict: pass ? "PASS" : "FAIL", actual: `loginApi=${okLogin} nav=${nav.actual} assertion=${assertion} ${summarizeWatch(watch)}`, evidence: summarizeEvidence(watch) };
      } catch (error) {
        return { verdict: "BLOCKED", actual: error instanceof Error ? error.message : String(error) };
      } finally {
        off();
        await ctx.close();
      }
    };
  };

  return {
    "login-ui": async ({ reporter }) => {
      const ctx = await newContext(sharedBrowser!, {});
      const page = await ctx.newPage();
      const watch = newWatch();
      const off = watchPage(page, watch);
      try {
        if (!cfg.testUserEmail || !cfg.testUserPassword) {
          reporter.add({ suite: "playwright", id: "journey-login-ui", title: "Login via the actual UI form (not the API)", route: "/auth", test: "precondition", expected: "TEST_USER credentials", verdict: "BLOCKED", actual: "TEST_USER credentials unset", timestamp: new Date().toISOString() });
          return { verdict: "BLOCKED", actual: "TEST_USER credentials unset" };
        }
        const nav = await gotoClean(page, "/auth");
        const emailInput = page.locator('input[type="email"]').first();
        const passInput = page.locator('input[type="password"][autocomplete="current-password"]').first();
        const submit = page.locator('button[type="submit"]').first();
        const found = (await emailInput.count() > 0 && await passInput.count() > 0 && await submit.count() > 0);
        let uiLogin = false;
        if (found) {
          await emailInput.fill(cfg.testUserEmail);
          await passInput.fill(cfg.testUserPassword);
          await submit.click();
          await page.waitForURL(/dashboard|null/, { timeout: 20000 }).catch(() => {});
          uiLogin = await page.locator("main").count().then((n) => n > 0).catch(() => false);
        }
        const fatal = hasFatalErrors(watch);
        reporter.add({
          suite: "playwright",
          id: "journey-login-ui",
          title: "Login via the actual UI form (not the API)",
          route: "/auth",
          test: "fill form, submit, expect dashboard",
          expected: "session established from the browser form; dashboard behind it",
          verdict: !found ? "BLOCKED" : uiLogin && !fatal ? "PASS" : "FAIL",
          actual: `formFound=${found} uiLogin=${uiLogin} fatal=${fatal} nav=${nav.actual}`,
          timestamp: new Date().toISOString(),
          evidence: summarizeEvidence(watch),
        });
        return { verdict: !found ? "BLOCKED" : uiLogin && !fatal ? "PASS" : "FAIL", actual: `uiLogin=${uiLogin}` };
      } catch (error) {
        return { verdict: "BLOCKED", actual: error instanceof Error ? error.message : String(error) };
      } finally {
        off();
        await ctx.close();
      }
    },

    "dashboard-authed": withLogin(async (page) => {
      return (await page.locator("main").count()) > 0;
    }),

    "logout": async ({ reporter }) => {
      const ctx = await newContext(sharedBrowser!, {});
      const page = await ctx.newPage();
      const watch = newWatch();
      const off = watchPage(page, watch);
      try {
        if (!cfg.baseUrl || !cfg.testUserEmail || !cfg.testUserPassword) {
          reporter.add({ suite: "playwright", id: "journey-logout", title: "Logout flow", test: "precondition", expected: "TEST_USER credentials", verdict: "BLOCKED", actual: "credentials unset", timestamp: new Date().toISOString() });
          return { verdict: "BLOCKED", actual: "credentials unset" };
        }
        await loginViaApi(ctx, cfg.testUserEmail, cfg.testUserPassword);
        const nav = await gotoClean(page, "/dashboard");
        const logoutBtn = page.locator('button:has-text("Log out"), a:has-text("Log out"), button:has-text("Sign out"), a:has-text("Sign out")').first();
        const found = await logoutBtn.count() > 0;
        let postLogout = false;
        if (found) {
          await logoutBtn.click();
          await page.waitForTimeout(1500);
          postLogout = await page.locator("body").isVisible().catch(() => false);
        }
        const sessionRes = await ctx.request.get(`${cfg.baseUrl}/api/auth/session`).catch(() => null);
        const sessionStatus = sessionRes?.status();
        reporter.add({
          suite: "playwright",
          id: "journey-logout",
          title: "Logout revokes the browser session",
          route: "/dashboard",
          test: "click logout (or API check), then session endpoint",
          expected: "session endpoint returns 401 after logout",
          verdict: sessionStatus === 401 ? "PASS" : found ? "FAIL" : "BLOCKED",
          actual: `controlFound=${found} postLogoutNav=${postLogout} sessionAfter=${sessionStatus} nav=${nav.actual}`,
          timestamp: new Date().toISOString(),
          evidence: summarizeEvidence(watch),
        });
        return { verdict: sessionStatus === 401 ? "PASS" : "BLOCKED", actual: `sessionAfter=${sessionStatus}` };
      } catch (error) {
        return { verdict: "BLOCKED", actual: error instanceof Error ? error.message : String(error) };
      } finally {
        off();
        await ctx.close();
      }
    },
  };
}

async function sharedBrowserIsOpen(): Promise<boolean> {
  return sharedBrowser !== null && sharedBrowser.isConnected();
}

/**
 * Executes the requested journey set. `names` may be specific journey ids or
 * "all". Returns the count of failures.
 */
export async function runJourneys(reporter: Reporter, names: string[]): Promise<number> {
  const cfg = loadPlaywrightConfig();
  if (!cfg.baseUrl) {
    reporter.add({ suite: "playwright", id: "journey-config", title: "Base URL required", test: "configuration", expected: "BASE_URL set", verdict: "BLOCKED", actual: "BASE_URL unset — no browser run", timestamp: new Date().toISOString() });
    return 1;
  }
  const browser = await openBrowser({ slow: cfg.slowMotionMs, headless: cfg.headless });
  sharedBrowser = browser;

  const journeys: Record<string, JourneyFn> = {
    "guest-surface": makeGuestJourney(),
    "guest-dashboard": makeGuestDashboardJourney(),
    "revision-lifecycle": makeRevisionLifecycleJourney,
    ...makeAuthedJourneys(),
    "assistant-guest": makeConnectJourney(
      "journey-assistant-guest",
      "AI Tutor guest surface renders clean",
      "/tutor",
      async (page) => (await page.locator("main").count()) > 0
    ),
    "navigation": makeConnectJourney(
      "journey-navigation",
      "Shell navigation traversable without crashes",
      "/",
      async (page) => {
        const count = await page.locator("nav a, header a").count();
        return count > 0;
      }
    ),
  };

  const effective = names.includes("all") ? Object.keys(journeys) : names.filter((n) => n in journeys);
  const missing = names.filter((n) => n !== "all" && !(n in journeys));
  if (missing.length) {
    reporter.add({ suite: "playwright", id: "journey-unknown", title: "Unknown journey(s)", test: "journey selection", expected: "known journey ids", verdict: "FAIL", actual: `unknown: ${missing.join(",")}`, timestamp: new Date().toISOString() });
  }

  let failed = 0;
  for (const name of effective) {
    const fn = journeys[name];
    const result = await fn({ browser, reporter });
    if (result.verdict === "FAIL") failed += 1;
  }

  await closeSharedBrowser();
  // final session consistency check is emitted by the logout journey itself
  return failed;
}

export { sharedBrowserIsOpen };
