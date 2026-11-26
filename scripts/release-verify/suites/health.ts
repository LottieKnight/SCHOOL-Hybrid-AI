import { loadConfig } from "../config.js";
import type { Reporter } from "../result.js";
import { ApiClient, describeResponse, RequestError } from "../http.js";

interface HealthShape {
  status: string;
  db?: string;
  uptime?: number;
  pool?: { total?: number; idle?: number; waiting?: number };
}

export async function runHealthSuite(reporter: Reporter) {
  const cfg = loadConfig();
  const t = new Date().toISOString();
  const api = cfg.apiBaseUrl ? new ApiClient(cfg.apiBaseUrl, { allowInsecure: cfg.allowInsecure }) : null;
  const web = cfg.baseUrl ? new ApiClient(cfg.baseUrl, { allowInsecure: cfg.allowInsecure }) : null;

  if (!api) {
    reporter.addBlocked("health", "api-health", "Backend /health", "GET 200 {status:ok}", "API_BASE_URL unset", "/health");
    reporter.addBlocked("health", "web-health", "Web proxied /api/health", "GET 200 reflecting backend health", "API_BASE_URL unset for classification", "/api/health");
    return;
  }

  try {
    const res = await api.get("/health");
    const body = res.json() as HealthShape;
    const apiReachable = res.status === 200 && body?.status === "ok";
    const dbReachable = body?.db === "ok";
    const evidence: string[] = [describeResponse(res)];
    if (typeof body?.uptime === "number") evidence.push(`uptime=${body.uptime.toFixed(0)}s`);
    if (body?.pool) evidence.push(`pool total=${body.pool.total} idle=${body.pool.idle} waiting=${body.pool.waiting}`);

    reporter.add({
      suite: "health",
      id: "api-reachable",
      title: "API reachable (distinct from DB/Redis)",
      test: "GET /health returns 200 with status:ok",
      expected: "HTTP 200 and status field 'ok'",
      verdict: apiReachable ? "PASS" : "FAIL",
      route: "/health",
      actual: `status=${res.status} body=${JSON.stringify(body)}`,
      timestamp: t,
      latencyMs: res.latencyMs,
      evidence,
    });

    reporter.add({
      suite: "health",
      id: "db-reachable",
      title: "DATABASE reachable (distinct from API/Redis)",
      test: "inspect /health db field (backend performs SELECT 1)",
      expected: "db === 'ok'",
      verdict: body?.db === undefined ? "FAIL" : dbReachable ? "PASS" : "FAIL",
      route: "/health",
      actual: `db=${body?.db ?? "field absent"}`,
      timestamp: t,
      latencyMs: res.latencyMs,
    });
  } catch (error) {
    const reason = error instanceof RequestError ? error.message : String(error);
    reporter.add({
      suite: "health",
      id: "api-reachable",
      title: "API reachable (distinct from DB/Redis)",
      test: "GET /health",
      expected: "HTTP 200 and status 'ok'",
      verdict: "BLOCKED",
      route: "/health",
      actual: reason,
      timestamp: t,
    });
    reporter.addBlocked("health", "db-reachable", "DATABASE reachable", "db==='ok'", "cannot classify while /health is unreachable", "/health");
    return;
  }

  // REDIS reachable — not exposed by /health; best-effort, never prints the URL.
  if (cfg.redisVerifyUrl) {
    try {
      const url = new URL(cfg.redisVerifyUrl);
      const port = url.port || "6379";
      const host = url.hostname;
      const { connect } = await import("node:net");
      const probeMs = 4000;
      const reached = await new Promise<boolean>((resolve) => {
        const sock = connect({ host, port: Number(port), timeout: probeMs });
        sock.once("connect", () => {
          sock.destroy();
          resolve(true);
        });
        sock.once("error", () => {
          sock.destroy();
          resolve(false);
        });
        sock.once("timeout", () => {
          sock.destroy();
          resolve(false);
        });
      });
      reporter.add({
        suite: "health",
        id: "redis-reachable",
        title: "REDIS reachable (distinct from API/DB)",
        test: "TCP connect to REDIS_VERIFY_URL host:port",
        expected: "connection established",
        verdict: reached ? "PASS" : "BLOCKED",
        route: "redirect: tcp",
        actual: reached ? `connected (${Number(port) > 0 ? `${host}:${port}` : host})` : "connection refused/timeout",
        timestamp: t,
      });
    } catch (error) {
      reporter.addBlocked("health", "redis-reachable", "REDIS reachable", "connection established", `invalid REDIS_VERIFY_URL: ${error instanceof Error ? error.message : "parse error"}`, "-");
    }
  } else {
    reporter.add({
      suite: "health",
      id: "redis-reachable",
      title: "REDIS reachable",
      test: "TCP probe REDIS_VERIFY_URL host:port",
      expected: "connection established (or documented offline)",
      verdict: "BLOCKED",
      route: "tcp",
      actual: "REDIS_VERIFY_URL unset — /health does not expose Redis; add optional REDIS_VERIFY_URL to probe",
      timestamp: t,
    });
  }

  // Web-proxied endpoint: BASE_URL/api/health (web app reflects backend /health).
  if (!web) return;
  try {
    const res = await web.get("/api/health");
    const body = res.json() as HealthShape;
    const ok = res.status === 200 && body?.status === "ok";
    const dbOk = body?.db === "ok";
    reporter.add({
      suite: "health",
      id: "web-health",
      title: "Web app proxied API health endpoint",
      test: "GET {BASE_URL}/api/health",
      expected: "200 with status:ok and db field reflecting backend",
      verdict: ok ? "PASS" : "FAIL",
      route: "/api/health",
      actual: `status=${res.status} db=${body?.db ?? "?"} latency=${res.latencyMs.toFixed(0)}ms`,
      timestamp: t,
      latencyMs: res.latencyMs,
      evidence: [describeResponse(res, 160)],
    });
    reporter.add({
      suite: "health",
      id: "web-health-db",
      title: "Proxied health reports database class",
      test: "inspect db field via web proxy",
      expected: "db class surfaced through the web app",
      verdict: dbOk ? "PASS" : body?.db === undefined ? "FAIL" : "FAIL",
      route: "/api/health",
      actual: `db=${body?.db ?? "not surfaced"}`,
      timestamp: t,
    });
  } catch (error) {
    const reason = error instanceof RequestError ? error.message : String(error);
    reporter.add({
      suite: "health",
      id: "web-health",
      title: "Web app proxied API health endpoint",
      test: "GET {BASE_URL}/api/health",
      expected: "200 reflecting backend health",
      verdict: "BLOCKED",
      route: "/api/health",
      actual: reason,
      timestamp: t,
    });
  }
}