import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

type Method = "GET" | "POST";
type AcceptMode = "html" | "json" | "text";

type LoadTestOptions = {
  baseUrl: string;
  users: number;
  concurrency: number;
  durationSeconds: number;
  timeoutMs: number;
  includeAi: boolean;
  aiSampleRate: number;
  maxErrorRate: number;
  maxP95Ms: number;
};

type Session = {
  id: string;
  email: string;
  token: string;
  csrfToken: string;
  cookies: Map<string, string>;
};

type RouteSpec = {
  name: string;
  method: Method;
  path: string | ((session: Session) => string);
  accept?: AcceptMode;
  auth?: boolean;
  csrf?: boolean;
  body?: (session: Session) => unknown;
  expected?: number[];
};

type Sample = {
  route: string;
  method: Method;
  status: number | null;
  ok: boolean;
  latencyMs: number;
  error?: string;
};

type RouteStats = {
  count: number;
  ok: number;
  fail: number;
  latencies: number[];
  statuses: Map<number, number>;
  errors: string[];
};

const DEFAULT_BASE_URL = process.env.LOAD_TEST_BASE_URL || "http://127.0.0.1:3000";
const DEFAULT_USERS = Number(process.env.LOAD_TEST_USERS || 10);
const DEFAULT_CONCURRENCY = Number(process.env.LOAD_TEST_CONCURRENCY || 20);
const DEFAULT_DURATION_SECONDS = Number(process.env.LOAD_TEST_DURATION_SECONDS || 60);
const DEFAULT_TIMEOUT_MS = Number(process.env.LOAD_TEST_TIMEOUT_MS || 15_000);
const DEFAULT_AI_SAMPLE_RATE = Number(process.env.LOAD_TEST_AI_SAMPLE_RATE || 0.03);
const DEFAULT_MAX_ERROR_RATE = Number(process.env.LOAD_TEST_MAX_ERROR_RATE || 0.02);
const DEFAULT_MAX_P95_MS = Number(process.env.LOAD_TEST_MAX_P95_MS || 2_000);

const SAFE_METHODS = new Set<Method>(["GET"]);

function parseArgs(argv: string[]): LoadTestOptions {
  const options: LoadTestOptions = {
    baseUrl: DEFAULT_BASE_URL,
    users: Math.max(1, DEFAULT_USERS),
    concurrency: Math.max(1, DEFAULT_CONCURRENCY),
    durationSeconds: Math.max(5, DEFAULT_DURATION_SECONDS),
    timeoutMs: Math.max(1_000, DEFAULT_TIMEOUT_MS),
    includeAi: false,
    aiSampleRate: Math.min(1, Math.max(0, DEFAULT_AI_SAMPLE_RATE)),
    maxErrorRate: Math.min(1, Math.max(0, DEFAULT_MAX_ERROR_RATE)),
    maxP95Ms: Math.max(1, DEFAULT_MAX_P95_MS),
  };

  for (const arg of argv) {
    if (arg === "--include-ai") {
      options.includeAi = true;
    } else if (arg.startsWith("--base-url=")) {
      options.baseUrl = arg.slice("--base-url=".length).replace(/\/+$/, "");
    } else if (arg.startsWith("--users=")) {
      options.users = Math.max(1, Number(arg.slice("--users=".length)));
    } else if (arg.startsWith("--concurrency=")) {
      options.concurrency = Math.max(1, Number(arg.slice("--concurrency=".length)));
    } else if (arg.startsWith("--duration-seconds=")) {
      options.durationSeconds = Math.max(5, Number(arg.slice("--duration-seconds=".length)));
    } else if (arg.startsWith("--timeout-ms=")) {
      options.timeoutMs = Math.max(1_000, Number(arg.slice("--timeout-ms=".length)));
    } else if (arg.startsWith("--ai-sample-rate=")) {
      options.aiSampleRate = Math.min(1, Math.max(0, Number(arg.slice("--ai-sample-rate=".length))));
    } else if (arg.startsWith("--max-error-rate=")) {
      options.maxErrorRate = Math.min(1, Math.max(0, Number(arg.slice("--max-error-rate=".length))));
    } else if (arg.startsWith("--max-p95-ms=")) {
      options.maxP95Ms = Math.max(1, Number(arg.slice("--max-p95-ms=".length)));
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log([
    "SCHOOL load-test harness",
    "",
    "Usage:",
    "  npm run load:test -- [options]",
    "",
    "Options:",
    "  --base-url=URL            Base web URL to test (default from LOAD_TEST_BASE_URL or http://127.0.0.1:3000)",
    "  --users=N                 Number of throwaway users to register (default 10)",
    "  --concurrency=N           Concurrent virtual users (default 20)",
    "  --duration-seconds=N      Test duration in seconds (default 60)",
    "  --timeout-ms=N            Per-request timeout in ms (default 15000)",
    "  --include-ai              Include AI routes in the scenario mix",
    "  --ai-sample-rate=N        AI scenario probability when enabled (default 0.03)",
    "  --max-error-rate=N        Exit non-zero when error rate exceeds this threshold (default 0.02)",
    "  --max-p95-ms=N            Exit non-zero when overall p95 exceeds this threshold (default 2000)",
    "",
    "Notes:",
    "  - The harness uses the web app origin and its /api proxy path, so auth/session cookies behave like the browser.",
    "  - It registers a small pool of test users and reuses them across many virtual users.",
  ].join("\n"));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterSeconds(value: string | null) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  const dateMs = Date.parse(value);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, Math.ceil((dateMs - Date.now()) / 1000));
  }
  return null;
}

function safeJsonParse(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getSetCookieHeaders(headers: Headers) {
  const getter = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  return typeof getter === "function" ? getter.call(headers) : [];
}

function syncCookies(session: Session, response: Response) {
  for (const header of getSetCookieHeaders(response.headers)) {
    const pair = header.split(";", 1)[0] || "";
    const index = pair.indexOf("=");
    if (index <= 0) continue;
    session.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  }
}

function cookieHeader(session: Session) {
  return Array.from(session.cookies.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

function csrfToken(session: Session) {
  return session.cookies.get("saedu_csrf") || session.csrfToken || "";
}

function buildUrl(baseUrl: string, path: string) {
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function headersForSession(session: Session | null, method: Method, accept: AcceptMode) {
  const headers = new Headers();
  headers.set(
    "Accept",
    accept === "html"
      ? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      : accept === "text"
        ? "text/plain,text/*;q=0.8,*/*;q=0.5"
        : "application/json"
  );
  headers.set("Accept-Encoding", "identity");
  headers.set("User-Agent", "SCHOOL-LoadTest/1.0");

  if (session) {
    const cookies = cookieHeader(session);
    if (cookies) headers.set("Cookie", cookies);
    if (session.token) headers.set("Authorization", `Bearer ${session.token}`);
    if (!SAFE_METHODS.has(method)) {
      const csrf = csrfToken(session);
      if (csrf) headers.set("x-csrf-token", csrf);
    }
  }

  return headers;
}

function makeScenarios(includeAi: boolean): RouteSpec[] {
  const scenarios: RouteSpec[] = [
    { name: "home", method: "GET", path: "/", accept: "html", auth: true, expected: [200] },
    { name: "learn-hub", method: "GET", path: "/learn", accept: "html", auth: true, expected: [200] },
    {
      name: "university-learning",
      method: "GET",
      path: "/university/learning",
      accept: "html",
      auth: true,
      expected: [200, 302],
    },
    {
      name: "ekrp211-study",
      method: "GET",
      path: "/learn/ekrp211",
      accept: "html",
      auth: true,
      expected: [200],
    },
    {
      name: "ekrp211-mcq-anchor",
      method: "GET",
      path: "/learn/ekrp211#mcq",
      accept: "html",
      auth: true,
      expected: [200],
    },
    {
      name: "messages-shell",
      method: "GET",
      path: "/messages",
      accept: "html",
      auth: true,
      expected: [200],
    },
    {
      name: "messages-snapshot",
      method: "GET",
      path: "/api/messages/weekly-snapshot?windowDays=7",
      accept: "json",
      auth: true,
      expected: [200],
    },
    {
      name: "messages-conversations",
      method: "GET",
      path: "/api/messages/conversations?limit=10",
      accept: "json",
      auth: true,
      expected: [200],
    },
    {
      name: "auth-session",
      method: "GET",
      path: "/api/auth/session",
      accept: "json",
      auth: true,
      expected: [200],
    },
    {
      name: "modules-catalog",
      method: "GET",
      path: "/api/modules",
      accept: "json",
      auth: true,
      expected: [200],
    },
    {
      name: "modules-ekrp211",
      method: "GET",
      path: "/api/modules/ekrp211",
      accept: "json",
      auth: true,
      expected: [200],
    },
    {
      name: "growth-summary",
      method: "GET",
      path: "/api/growth/summary",
      accept: "json",
      auth: false,
      expected: [200],
    },
    {
      name: "leaderboard-weekly",
      method: "GET",
      path: "/api/leaderboard/weekly",
      accept: "json",
      auth: true,
      expected: [200],
    },
  ];

  if (includeAi) {
    scenarios.push(
      {
        name: "assistant",
        method: "POST",
        path: "/api/assistant",
        accept: "json",
        auth: true,
        expected: [200],
        body: () => ({
          material:
            "EKRP211 revision: explain risk appetite vs risk tolerance, then give one exam-style question and a short model answer outline.",
          mode: "mixed",
          subject: "risk management",
          grade: 12,
          socratic: false,
          sessionId: randomUUID(),
        }),
      },
      {
        name: "study-assistant",
        method: "POST",
        path: "/api/study-assistant",
        accept: "json",
        auth: true,
        expected: [200],
        body: () => ({
          material:
            "Explain funding liquidity risk, market liquidity risk, and why they matter in a South African banking context.",
          mode: "explain",
          subject: "risk management",
          grade: 12,
          socratic: false,
        }),
      },
      {
        name: "flashcards",
        method: "POST",
        path: "/api/intelligence/flashcards",
        accept: "json",
        auth: true,
        expected: [200],
        body: () => ({
          text:
            "Risk culture is the set of shared values, beliefs, knowledge, attitudes, and understanding about risk that shape organisational decisions.",
        }),
      }
    );
  }

  return scenarios;
}

function createStats() {
  return new Map<string, RouteStats>();
}

function recordSample(stats: Map<string, RouteStats>, sample: Sample) {
  const entry = stats.get(sample.route) || {
    count: 0,
    ok: 0,
    fail: 0,
    latencies: [],
    statuses: new Map<number, number>(),
    errors: [],
  };

  entry.count += 1;
  entry.latencies.push(sample.latencyMs);
  if (sample.ok) {
    entry.ok += 1;
  } else {
    entry.fail += 1;
    if (sample.error) {
      entry.errors.push(sample.error);
      if (entry.errors.length > 5) {
        entry.errors.shift();
      }
    }
  }
  if (sample.status !== null) {
    entry.statuses.set(sample.status, (entry.statuses.get(sample.status) || 0) + 1);
  }
  stats.set(sample.route, entry);
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index] || 0;
}

function formatMs(value: number) {
  return `${Math.round(value)}ms`;
}

function weightedPick<T extends { weight: number }>(items: T[], random = Math.random) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let cursor = random() * total;
  for (const item of items) {
    cursor -= item.weight;
    if (cursor <= 0) return item;
  }
  return items[items.length - 1];
}

async function callRoute(
  baseUrl: string,
  session: Session,
  route: RouteSpec,
  timeoutMs: number
): Promise<Sample> {
  const path = typeof route.path === "function" ? route.path(session) : route.path;
  const url = buildUrl(baseUrl, path);
  const headers = headersForSession(route.auth === false ? null : session, route.method, route.accept ?? "json");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let body: BodyInit | undefined;

  try {
    if (route.body) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(route.body(session));
    }

    const started = performance.now();
    const response = await fetch(url, {
      method: route.method,
      headers,
      body,
      signal: controller.signal,
    });
    const text = await response.text();
    const latencyMs = performance.now() - started;
    syncCookies(session, response);
    const parsed = route.accept === "json" ? safeJsonParse(text) : null;
    const expected = route.expected ?? (route.method === "GET" ? [200] : [200, 201, 204]);
    const ok = expected.includes(response.status);

    return {
      route: route.name,
      method: route.method,
      status: response.status,
      ok,
      latencyMs,
      error: ok
        ? undefined
        : `Expected ${expected.join(",")} but got ${response.status}${parsed ? ` body=${JSON.stringify(parsed).slice(0, 200)}` : ""}`,
    };
  } catch (error) {
    return {
      route: route.name,
      method: route.method,
      status: null,
      ok: false,
      latencyMs: timeoutMs,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function registerUser(baseUrl: string, index: number, timeoutMs: number): Promise<Session> {
  const session: Session = {
    id: randomUUID(),
    email: "",
    token: "",
    csrfToken: "",
    cookies: new Map(),
  };
  const unique = `${Date.now()}-${index}-${randomUUID().slice(0, 8)}`;
  const email = `load.${unique}@example.com`;
  session.email = email;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const controller = new AbortController();
    const registrationTimeoutMs = Math.max(timeoutMs, 60_000);
    const timeout = setTimeout(() => controller.abort(), registrationTimeoutMs);
    try {
      const response = await fetch(buildUrl(baseUrl, "/api/auth/register"), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Accept-Encoding": "identity",
          "User-Agent": "SCHOOL-LoadTest/1.0",
        },
        body: JSON.stringify({
          email,
          password: "LoadTest!123",
          firstName: `Load${index}`,
          lastName: "Test",
          phone: "+27123456789",
          country: "South Africa",
          province: "Gauteng",
          city: "Johannesburg",
        }),
        signal: controller.signal,
      });

      const text = await response.text();
      syncCookies(session, response);
      const payload = safeJsonParse(text) as {
        token?: string;
        csrfToken?: string;
        access?: { hasAccess?: boolean; status?: string };
      } | null;

      if (!response.ok) {
        if ((response.status === 503 || response.status === 429) && attempt < 5) {
          const retryAfter = parseRetryAfterSeconds(response.headers.get("retry-after"));
          const waitMs =
            response.status === 429 && retryAfter !== null
              ? (retryAfter + 1) * 1000
              : 300 * attempt;
          await sleep(waitMs);
          continue;
        }
        throw new Error(
          `Failed to create load-test user ${email}: status=${response.status} body=${text.slice(0, 300)}`
        );
      }

      session.token = payload?.token || "";
      session.csrfToken = payload?.csrfToken || session.cookies.get("saedu_csrf") || "";
      return session;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("aborted") && attempt < 5) {
        await sleep(500 * attempt);
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`Failed to create load-test user ${email}: auth service kept returning 503`);
}

function summarize(stats: Map<string, RouteStats>) {
  const rows = Array.from(stats.entries()).map(([route, entry]) => {
    const errorRate = entry.count ? entry.fail / entry.count : 0;
    const p95 = percentile(entry.latencies, 95);
    const p99 = percentile(entry.latencies, 99);
    const average = entry.latencies.length
      ? entry.latencies.reduce((sum, value) => sum + value, 0) / entry.latencies.length
      : 0;

    return {
      route,
      count: entry.count,
      ok: entry.ok,
      fail: entry.fail,
      errorRate,
      average,
      p95,
      p99,
      statuses: Array.from(entry.statuses.entries()).sort((a, b) => a[0] - b[0]),
      errors: entry.errors,
    };
  });

  rows.sort((a, b) => b.count - a.count || a.route.localeCompare(b.route));
  return rows;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const scenarios = makeScenarios(options.includeAi);
  const aiScenarioNames = new Set(["assistant"]);
  const primaryWeighted = scenarios
    .filter((scenario) => !(options.includeAi && aiScenarioNames.has(scenario.name)))
    .map((scenario) => ({ ...scenario, weight: 1 }));
  const aiWeighted = scenarios
    .filter((scenario) => aiScenarioNames.has(scenario.name))
    .map((scenario) => ({ ...scenario, weight: 1 }));

  if (!primaryWeighted.length) {
    throw new Error("No load-test scenarios were configured.");
  }

  console.log(`[load] baseUrl=${options.baseUrl}`);
  console.log(
    `[load] users=${options.users} concurrency=${options.concurrency} duration=${options.durationSeconds}s timeout=${options.timeoutMs}ms ai=${options.includeAi ? "on" : "off"}`
  );

  const sessions: Session[] = [];
  for (let i = 0; i < options.users; i += 1) {
    sessions.push(await registerUser(options.baseUrl, i, options.timeoutMs));
  }
  console.log(`[load] registered ${sessions.length} test users`);

  const stats = createStats();
  const start = Date.now();
  const deadline = start + options.durationSeconds * 1000;
  let total = 0;

  async function worker(workerIndex: number) {
    while (Date.now() < deadline) {
      const session = sessions[workerIndex % sessions.length]!;
      const route =
        options.includeAi && aiWeighted.length > 0 && Math.random() < options.aiSampleRate
          ? weightedPick(aiWeighted)
          : weightedPick(primaryWeighted);
      const sample = await callRoute(options.baseUrl, session, route, options.timeoutMs);
      recordSample(stats, sample);
      total += 1;

      if (!sample.ok && sample.status === 429) {
        // Allow the harness to keep going so rate limits are observable in the summary.
        continue;
      }
    }
  }

  const workers = Array.from({ length: options.concurrency }, (_, index) => worker(index));
  await Promise.all(workers);

  const elapsedMs = Date.now() - start;
  const rows = summarize(stats);
  const allLatencies = rows.flatMap((row) => row.p95 > 0 ? stats.get(row.route)?.latencies ?? [] : []);
  const overallP95 = percentile(allLatencies, 95);
  const overallP99 = percentile(allLatencies, 99);
  const totalOk = rows.reduce((sum, row) => sum + row.ok, 0);
  const totalFail = rows.reduce((sum, row) => sum + row.fail, 0);
  const errorRate = total ? totalFail / total : 0;
  const rps = total / (elapsedMs / 1000);

  console.log("");
  console.log(`[load] total=${total} ok=${totalOk} fail=${totalFail} elapsed=${Math.round(elapsedMs)}ms rps=${rps.toFixed(2)}`);
  console.log(`[load] overall p95=${formatMs(overallP95)} p99=${formatMs(overallP99)} errorRate=${(errorRate * 100).toFixed(2)}%`);
  console.log("");
  console.log("route                         count   ok   fail   avg     p95     p99     status");
  console.log("--------------------------------------------------------------------------");
  for (const row of rows) {
    const statusText = row.statuses.map(([code, count]) => `${code}x${count}`).join(" ");
    console.log(
      `${row.route.padEnd(28)} ${String(row.count).padStart(6)} ${String(row.ok).padStart(5)} ${String(row.fail).padStart(6)} ${formatMs(row.average).padStart(7)} ${formatMs(row.p95).padStart(7)} ${formatMs(row.p99).padStart(7)}  ${statusText}`
    );
    if (row.errors.length) {
      for (const error of row.errors.slice(-3)) {
        console.log(`  - ${error}`);
      }
    }
  }

  const failedThresholds: string[] = [];
  if (errorRate > options.maxErrorRate) {
    failedThresholds.push(`error rate ${(errorRate * 100).toFixed(2)}% > ${(options.maxErrorRate * 100).toFixed(2)}%`);
  }
  if (overallP95 > options.maxP95Ms) {
    failedThresholds.push(`p95 ${Math.round(overallP95)}ms > ${options.maxP95Ms}ms`);
  }

  if (failedThresholds.length) {
    console.error("");
    console.error(`[load] FAILED: ${failedThresholds.join("; ")}`);
    process.exitCode = 1;
  } else {
    console.log("");
    console.log("[load] PASSED");
  }
}

main().catch((error) => {
  console.error("[load] fatal", error);
  process.exitCode = 1;
});
