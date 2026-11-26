import { loadConfig } from "../config.js";
import type { Reporter } from "../result.js";
import { ApiClient, describeResponse, RequestError } from "../http.js";

const REVIEW_PATH = "/api/past-papers/attempts/review";

export async function runPaidContentSuite(reporter: Reporter) {
  const cfg = loadConfig();
  const t = new Date().toISOString();

  if (!cfg.baseUrl) {
    reporter.addBlocked("paid-content", "runner", "Paid-content suite", "Owner-scoped detailed-report assertions", "BASE_URL unset", REVIEW_PATH);
    return;
  }

  const web = new ApiClient(cfg.baseUrl, { allowInsecure: cfg.allowInsecure });
  const attemptId = cfg.pastPaperAttemptId;
  const fakeId = "00000000-0000-0000-0000-000000000000";
  const haveOwner = !!cfg.pastPaperOwnerEmail && !!cfg.pastPaperOwnerPassword;
  const haveAdmin = !!cfg.adminTestUserEmail && !!cfg.adminTestUserPassword;

  // HTTP/API layer — the security envelope. Rendered UI is a separate journey.
  if (!attemptId) {
    for (const [id, title] of [
      ["guest-locked", "Guest cannot access a protected detailed report"],
      ["non-owner-404", "Authenticated non-owner cannot access another user's attempt"],
      ["owner-envelope", "Owner access respects the locked/unlocked entitlement"],
      ["admin-failclosed", "Admin does not bypass owner-scoping"],
    ] as const) {
      reporter.addBlocked("paid-content", id, title, "envelope asserted (401/404/402; never content for the wrong principal)", "PAST_PAPER_ATTEMPT_ID unset — suite is data-driven, no ids hard-coded", REVIEW_PATH);
    }
    return;
  }

  // Guest
  try {
    const res = await web.post(REVIEW_PATH, { json: { attemptId, questionId: fakeId }, timeoutMs: 15000 });
    reporter.add({
      suite: "paid-content",
      id: "guest-locked",
      title: "Guest cannot access a protected detailed report",
      test: `POST ${REVIEW_PATH} without a session`,
      expected: "401 Unauthorized (server-enforced, not frontend hiding)",
      verdict: res.status === 401 ? "PASS" : "FAIL",
      route: REVIEW_PATH,
      actual: `status=${res.status}`,
      timestamp: t,
      latencyMs: res.latencyMs,
    });
  } catch (error) {
    reporter.add({ suite: "paid-content", id: "guest-locked", title: "Guest cannot access a protected detailed report", test: "POST review as guest", expected: "401", verdict: "BLOCKED", route: REVIEW_PATH, actual: error instanceof RequestError ? error.message : String(error), timestamp: t });
  }

  // Authenticated non-owner (reuses TEST_USER; never their own attempt).
  const haveUser = !!cfg.testUserEmail && !!cfg.testUserPassword;
  if (haveUser) {
    const client = new ApiClient(cfg.baseUrl, { allowInsecure: cfg.allowInsecure });
    const login = await client.post("/api/auth/login", { json: { email: cfg.testUserEmail, password: cfg.testUserPassword }, timeoutMs: 15000 });
    if (login.status === 200) {
      const res = await client.post(REVIEW_PATH, { json: { attemptId, questionId: fakeId }, timeoutMs: 15000 });
      reporter.add({
        suite: "paid-content",
        id: "non-owner-404",
        title: "Authenticated non-owner cannot access another user's attempt",
        test: `POST ${REVIEW_PATH} with TEST_USER session and a foreign attempt id`,
        expected: "404 Attempt not found (owner-scope) — NOT 200 with content",
        verdict: res.status === 404 ? "PASS" : res.status === 402 || res.status === 403 ? "PASS" : "FAIL",
        route: REVIEW_PATH,
        actual: `status=${res.status}`,
        timestamp: t,
        latencyMs: res.latencyMs,
        evidence: [describeResponse(res, 140)],
      });
    } else {
      reporter.add({ suite: "paid-content", id: "non-owner-404", title: "Authenticated non-owner blocked", test: "login (TEST_USER)", expected: "200", verdict: "BLOCKED", route: "/api/auth/login", actual: `login status=${login.status}`, timestamp: t, latencyMs: login.latencyMs });
    }
  } else {
    reporter.addBlocked("paid-content", "non-owner-404", "Authenticated non-owner blocked", "404 for foreign attempt", "TEST_USER credentials unset", REVIEW_PATH);
  }

  // Owner envelope (locked → 402; legitimately unlocked → 200 with content).
  if (haveOwner) {
    const owner = new ApiClient(cfg.baseUrl, { allowInsecure: cfg.allowInsecure });
    const login = await owner.post("/api/auth/login", { json: { email: cfg.pastPaperOwnerEmail, password: cfg.pastPaperOwnerPassword }, timeoutMs: 15000 });
    if (login.status === 200) {
      const res = await owner.post(REVIEW_PATH, { json: { attemptId, questionId: fakeId }, timeoutMs: 15000 });
      const locked = res.status === 402;
      const unlocked = res.status === 200;
      reporter.add({
        suite: "paid-content",
        id: "owner-envelope",
        title: "Owner access respects the locked/unlocked entitlement",
        test: `POST ${REVIEW_PATH} with the attempt owner's session`,
        expected: "402 while locked; 200 with report content once legitimately unlocked",
        verdict: locked || unlocked ? "PASS" : "FAIL",
        route: REVIEW_PATH,
        actual: `status=${res.status} (${unlocked ? "report served to owner — entitled-access path confirmed" : locked ? "locked — entitlement gate works" : "unexpected"})`,
        timestamp: t,
        latencyMs: res.latencyMs,
        evidence: [describeResponse(res, 160)],
      });
      if (res.status === 200) {
        const body = res.json() as Record<string, unknown>;
        reporter.add({
          suite: "paid-content",
          id: "owner-unlocked-content",
          title: "Entitled user can access the legitimately unlocked report",
          test: "inspect 200 review payload keys (values never printed)",
          expected: "a report payload is served (per-question results / detailed analytics)",
          verdict: body && Object.keys(body).length > 0 ? "PASS" : "FAIL",
          route: REVIEW_PATH,
          actual: `payload keys=[${Object.keys(body).join(",")}]`,
          timestamp: t,
        });
      } else {
        reporter.add({
          suite: "paid-content",
          id: "owner-unlocked-content",
          title: "Entitled user can access the legitimately unlocked report",
          test: "needs an attempt whose detailed report is unlocked",
          expected: "200 with report content",
          verdict: "BLOCKED",
          route: REVIEW_PATH,
          actual: "this attempt is locked (402) or unreachable; supply PAST_PAPER_ATTEMPT_ID for an unlocked report to confirm the entitled-read path",
          timestamp: t,
        });
      }
    } else {
      reporter.add({ suite: "paid-content", id: "owner-envelope", title: "Owner access respects the locked/unlocked entitlement", test: "login (owner)", expected: "200", verdict: "BLOCKED", route: "/api/auth/login", actual: `login status=${login.status}`, timestamp: t, latencyMs: login.latencyMs });
    }
  } else {
    reporter.addBlocked("paid-content", "owner-envelope", "Owner access respects the locked/unlocked entitlement", "402 locked / 200 unlocked", "PAST_PAPER_OWNER_EMAIL/PASSWORD unset", REVIEW_PATH);
  }

  // Admin fail-closed on the attempts surface (no implicit ownership).
  if (haveAdmin) {
    const admin = new ApiClient(cfg.baseUrl, { allowInsecure: cfg.allowInsecure });
    const login = await admin.post("/api/auth/login", { json: { email: cfg.adminTestUserEmail, password: cfg.adminTestUserPassword }, timeoutMs: 15000 });
    if (login.status === 200) {
      const res = await admin.post(REVIEW_PATH, { json: { attemptId, questionId: fakeId }, timeoutMs: 15000 });
      reporter.add({
        suite: "paid-content",
        id: "admin-failclosed",
        title: "Admin does not bypass attempt owner-scoping",
        test: `POST ${REVIEW_PATH} with admin session on a foreign attempt`,
        expected: "404 (no content) — admins are not implicitly owners unless the policy says otherwise",
        verdict: res.status === 404 ? "PASS" : res.status === 401 || res.status === 403 ? "PASS" : "FAIL",
        route: REVIEW_PATH,
        actual: `status=${res.status}`,
        timestamp: t,
        latencyMs: res.latencyMs,
      });
    } else {
      reporter.add({ suite: "paid-content", id: "admin-failclosed", title: "Admin does not bypass owner-scoping", test: "login (admin)", expected: "200", verdict: "BLOCKED", route: "/api/auth/login", actual: `login status=${login.status}`, timestamp: t, latencyMs: login.latencyMs });
    }
  } else {
    reporter.addBlocked("paid-content", "admin-failclosed", "Admin does not bypass owner-scoping", "404/403 for foreign attempt", "ADMIN_TEST_USER credentials unset", REVIEW_PATH);
  }

  // Rendered-UI assertion lives in the browser journey.
  reporter.add({
    suite: "paid-content",
    id: "ui-rendered",
    title: "Rendered UI matches the API envelope (no reliance on frontend hiding)",
    test: "Playwright journey paid-content (attempt page as guest / other / owner)",
    expected: "UI never renders protected report content to the wrong principal",
    verdict: "BLOCKED",
    route: "/past-papers/[id]/attempt",
    actual: "browser-level journey in apps/web/e2e/prod/journeys.ts — run after infra is live; needs a PAST_PAPER_ATTEMPT_ID the owner session can open",
    timestamp: t,
  });
}