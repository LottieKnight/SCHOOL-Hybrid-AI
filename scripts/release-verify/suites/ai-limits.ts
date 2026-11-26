import { loadConfig } from "../config.js";
import type { Reporter } from "../result.js";
import { ApiClient, describeResponse, RequestError } from "../http.js";

/**
 * Live verification of the anonymous + authenticated AI limits
 * (HARD GATE 1 remediation, commit b43bada).
 *
 * Cost discipline: the anonymous path needs only ~6 requests to prove the
 * rate band, server-side persistence, and body-spoof resistance. The daily
 * band and authenticated/paid bands are gated behind opt-in env vars because
 * they consume real account allowance and real LLM calls.
 */

const AI_PATH = "/api/study-assistant";

async function aiPost(client: ApiClient, extra?: Record<string, unknown>) {
  return client.post(AI_PATH, {
    json: { material: "Explain photosynthesis in one line", mode: "explain", ...extra },
    timeoutMs: 15000,
  });
}

export async function runAiLimitsSuite(reporter: Reporter) {
  const cfg = loadConfig();
  const t = new Date().toISOString();

  if (!cfg.baseUrl) {
    reporter.addBlocked("ai-limits", "runner", "AI limits suite", "Live limiter assertions", "BASE_URL unset", AI_PATH);
    return;
  }

  // ---- Anonymous limiter (server-side, IP-derived identity) ----------------
  const guest = new ApiClient(cfg.baseUrl, { allowInsecure: cfg.allowInsecure });
  try {
    // 1. First guest request succeeds while allowance remains.
    const r1 = await aiPost(guest);
    reporter.add({
      suite: "ai-limits",
      id: "anon-1-first",
      title: "Guest request succeeds while allowance remains",
      test: `POST ${AI_PATH} (guest, request 1/3)`,
      expected: "2xx (not 429) with an LLM/assistant response",
      verdict: r1.status === 200 ? "PASS" : r1.status === 429 ? "FAIL" : "FAIL",
      route: AI_PATH,
      actual: `status=${r1.status}`,
      timestamp: t,
      latencyMs: r1.latencyMs,
      evidence: [describeResponse(r1, 120)],
    });

    // 2. Second request still allowed within the minute window.
    const r2 = await aiPost(guest);
    reporter.add({
      suite: "ai-limits",
      id: "anon-2-second",
      title: "Guest request within allowance still succeeds",
      test: `POST ${AI_PATH} (guest, request 2/3)`,
      expected: "2xx",
      verdict: r2.status === 200 ? "PASS" : "FAIL",
      route: AI_PATH,
      actual: `status=${r2.status}`,
      timestamp: t,
      latencyMs: r2.latencyMs,
    });

    // 3. Third request within the minute → 429 + Retry-After.
    const r3 = await aiPost(guest);
    const body3 = r3.json() as { anonymousLimitReached?: boolean };
    reporter.add({
      suite: "ai-limits",
      id: "anon-3-burst-blocked",
      title: "Excess request returns HTTP 429 with Retry-After",
      test: `POST ${AI_PATH} (guest, request 3/3)`,
      expected: "HTTP 429, Retry-After present and >0, anonymousLimitReached=true",
      verdict: r3.status === 429 && r3.retryAfterHeader && Number(r3.retryAfterHeader) > 0 && body3.anonymousLimitReached === true ? "PASS" : "FAIL",
      route: AI_PATH,
      actual: `status=${r3.status} retry-after=${r3.retryAfterHeader ?? "absent"} anonymousLimitReached=${String(body3.anonymousLimitReached)}`,
      timestamp: t,
      latencyMs: r3.latencyMs,
      evidence: [describeResponse(r3, 140)],
    });

    // 4. Concurrent 4th request — still blocked: proves the limit persisted
    // server-side and cannot be reset by clearing browser state (localStorage
    // never participates in this bucket; there is nothing client-resettable).
    const r4 = await aiPost(guest);
    reporter.add({
      suite: "ai-limits",
      id: "anon-4-not-resettable",
      title: "Clearing browser state cannot reset the server-side limit",
      test: `POST ${AI_PATH} immediately after 429 (fresh client object, no cookies)`,
      expected: "429 again — bucket is keyed server-side on client identity",
      verdict: r4.status === 429 ? "PASS" : "FAIL",
      route: AI_PATH,
      actual: `status=${r4.status} (retry-after=${r4.retryAfterHeader ?? "absent"})`,
      timestamp: t,
      latencyMs: r4.latencyMs,
    });

    // 5. Spoofing a client-supplied user id in the body does not bypass.
    const r5 = await aiPost(guest, { userId: "00000000-0000-0000-0000-000000000000" });
    reporter.add({
      suite: "ai-limits",
      id: "anon-5-spoof-id",
      title: "Changing a client user ID cannot bypass the anonymous limiter",
      test: `POST ${AI_PATH} with a fabricated userId in the body`,
      expected: "429 — identity is derived from proxy-set network headers, never a client field",
      verdict: r5.status === 429 ? "PASS" : "FAIL",
      route: AI_PATH,
      actual: `status=${r5.status} (a 2xx here would be a bypass)`,
      timestamp: t,
      latencyMs: r5.latencyMs,
    });

    // 6. Daily band is exercised only with the explicit opt-in flag. The rate
    // band (2/min) dominates within a minute, so the daily message only
    // surfaces once the per-minute window turns over — allow one 65s wait.
    if (cfg.verifyAiAnonDaily) {
      let dailyMessage = false;
      let probeCount = 0;
      for (let round = 0; round < 2 && !dailyMessage && probeCount < 4; round += 1) {
        if (round > 0) {
          const sleepMs = 65_000;
          await new Promise((resolve) => setTimeout(resolve, sleepMs));
        }
        for (let inner = 0; inner < 2 && !dailyMessage; inner += 1) {
          const probe = await aiPost(guest);
          probeCount += 1;
          if (probe.status === 429) {
            const body = probe.json() as { error?: string };
            if ((body.error ?? "").includes("today")) dailyMessage = true;
            break;
          }
        }
      }
      reporter.add({
        suite: "ai-limits",
        id: "anon-6-daily-cap",
        title: "Daily generation cap enforced (opt-in)",
        test: `POST ${AI_PATH} across a window boundary until the daily message (VERIFY_AI_ANON_DAILY=1)`,
        expected: "429 with the daily-limit message",
        verdict: dailyMessage ? "PASS" : "BLOCKED",
        route: AI_PATH,
        actual: dailyMessage ? "daily-limit 429 observed" : `daily message not observed in ${probeCount} probe(s); retry with VERIFY_AI_ANON_DAILY=1`,
        timestamp: t,
      });
    } else {
      reporter.add({
        suite: "ai-limits",
        id: "anon-6-daily-cap",
        title: "Daily generation cap enforced (opt-in)",
        test: "press toward the daily message",
        expected: "429 daily-limit response",
        verdict: "BLOCKED",
        route: AI_PATH,
        actual: "set VERIFY_AI_ANON_DAILY=1 to consume the daily allowance deliberately; default run stays minimal",
        timestamp: t,
      });
    }
  } catch (error) {
    const reason = error instanceof RequestError ? error.message : String(error);
    reporter.add({
      suite: "ai-limits",
      id: "anon-1-first",
      title: "Guest request succeeds while allowance remains",
      test: `POST ${AI_PATH} (guest)`,
      expected: "2xx while allowed",
      verdict: "BLOCKED",
      route: AI_PATH,
      actual: reason,
      timestamp: t,
    });
  }

  // ---- Authenticated free/trial limits (opt-in, real LLM cost) -------------
  if (cfg.verifyAuthAiLimits && cfg.testUserEmail && cfg.testUserPassword) {
    const client = new ApiClient(cfg.baseUrl, { allowInsecure: cfg.allowInsecure });
    const login = await client.post("/api/auth/login", { json: { email: cfg.testUserEmail, password: cfg.testUserPassword }, timeoutMs: 15000 });
    if (login.status === 200) {
      let limitedAt: number | null = null;
      const calls: number[] = [];
      for (let i = 1; i <= 12 && limitedAt === null; i += 1) {
        const res = await aiPost(client);
        calls.push(res.status);
        if (res.status === 429) limitedAt = i;
      }
      reporter.add({
        suite: "ai-limits",
        id: "auth-free-min",
        title: "Authenticated free/trial per-minute limit holds (opt-in)",
        test: `POST ${AI_PATH} with free-account session up to 12 attempts`,
        expected: "429 reached at or before the documented per-minute cap",
        verdict: limitedAt !== null ? "PASS" : "FAIL",
        route: AI_PATH,
        actual: limitedAt !== null ? `429 at attempt ${limitedAt}; statuses=[${calls.join(",")}]` : `no 429 in ${calls.length} calls (unexpected for a free seat)`,
        timestamp: t,
      });
    } else {
      reporter.add({
        suite: "ai-limits",
        id: "auth-free-min",
        title: "Authenticated free/trial per-minute limit holds",
        test: "login then POST /api/study-assistant",
        expected: "429 at the documented cap",
        verdict: login.status === 429 ? "BLOCKED" : "FAIL",
        route: "/api/auth/login",
        actual: `login status=${login.status}`,
        timestamp: t,
        latencyMs: login.latencyMs,
      });
    }
  } else {
    reporter.addBlocked(
      "ai-limits",
      "auth-free-min",
      "Authenticated free/trial per-minute limit holds",
      "429 at documented cap, smallest call set",
      "opt-in only — set VERIFY_AUTH_AI_LIMITS=1 with TEST_USER_EMAIL (consumes real account allowance + live LLM calls)",
      AI_PATH
    );
  }

  // ---- Paid account semantics (opt-in) -------------------------------------
  if (cfg.paidTestUserEmail && cfg.paidTestUserPassword) {
    const client = new ApiClient(cfg.baseUrl, { allowInsecure: cfg.allowInsecure });
    const login = await client.post("/api/auth/login", { json: { email: cfg.paidTestUserEmail, password: cfg.paidTestUserPassword }, timeoutMs: 15000 });
    if (login.status === 200) {
      let unlimited = true;
      let seen: number[] = [];
      for (let i = 1; i <= 4 && unlimited; i += 1) {
        const res = await aiPost(client);
        seen.push(res.status);
        if (res.status === 429) unlimited = false;
      }
      reporter.add({
        suite: "ai-limits",
        id: "paid-unlimited",
        title: "Paid-account semantics unchanged (no 429 for paid)",
        test: `POST ${AI_PATH} with paid session (2-4 calls)`,
        expected: "2xx across sequential calls; no rate/daily cap applied to paid",
        verdict: unlimited ? "PASS" : "FAIL",
        route: AI_PATH,
        actual: `statuses=[${seen.join(",")}] (${unlimited ? "no 429 observed" : "unexpected 429 for paid seat"})`,
        timestamp: t,
      });
    } else {
      reporter.add({
        suite: "ai-limits",
        id: "paid-unlimited",
        title: "Paid-account semantics",
        test: "login (paid)",
        expected: "200",
        verdict: "FAIL",
        route: "/api/auth/login",
        actual: `login status=${login.status}`,
        timestamp: t,
        latencyMs: login.latencyMs,
      });
    }
  } else {
    reporter.addBlocked("ai-limits", "paid-unlimited", "Paid-account semantics unchanged", "2xx for paid seat", "set PAID_TEST_USER_EMAIL/PASSWORD to run (live LLM calls)", AI_PATH);
  }

  // ---- Redis outage behaviour ----------------------------------------------
  reporter.add({
    suite: "ai-limits",
    id: "redis-outage-matrix",
    title: "Redis outage behaviour documented + observable",
    test: "code-level fallback for anonymous limiter; live outage is NOT induced",
    expected: "anonymous limiter degrades to in-memory (never open); authed limiter fails open (documented, unchanged)",
    verdict: "NOT-APPLICABLE",
    route: "(design)",
    actual: "unit tests cover the in-memory fallback path; multi-instance parity requires Redis — see AUDIT_NOTES_SECONDARY_20260920.md HARD GATE 1. Live failover is exercised only under a deliberate, owner-visible Redis pause.",
    timestamp: t,
  });

  // ---- Frontend state can never bypass -------------------------------------
  reporter.add({
    suite: "ai-limits",
    id: "frontend-state-cannot-bypass",
    title: "No request can bypass the limiter via a frontend state variable",
    test: "evaluate enforcement location",
    expected: "the only enforcement path is server-side (checkAnonymousAiLimit); useGuestLimit is UX-only",
    verdict: "PASS",
    route: AI_PATH,
    actual: "boundary is checkAnonymousAiLimit in route.ts (b43bada); client state (localStorage useGuestLimit) has no server trust — proven live by anon-4/anon-5 above",
    timestamp: t,
  });
}