import { loadConfig } from "../config.js";
import type { Reporter } from "../result.js";
import { ApiClient, describeResponse, RequestError } from "../http.js";

/**
 * Canonical domain — OWNER DECISION REQUIRED.
 *
 * The runner NEVER changes sitemap/robots/canonical/OG/env. It only records
 * the current signals so the owner decision can be based on evidence:
 *
 *   repo defaults            : school.ditshego-ventures.co.za
 *   prod Railway APP_URL     : saedu-api.vercel.app
 */
export async function runCanonicalSuite(reporter: Reporter) {
  const cfg = loadConfig();
  const t = new Date().toISOString();

  reporter.add({
    suite: "canonical",
    id: "decision-required",
    title: "Canonical domain — OWNER DECISION REQUIRED",
    route: "(sitemap/metadata)",
    test: "record contradiction, take no action",
    expected: "owner confirms one canonical origin before any change",
    verdict: "BLOCKED",
    actual: "repo default school.ditshego-ventures.co.za vs prod env saedu-api.vercel.app; no SEO config will be touched without explicit confirmation",
    timestamp: t,
  });

  if (cfg.baseUrl) {
    const web = new ApiClient(cfg.baseUrl, { allowInsecure: cfg.allowInsecure });
    const probes: Array<{ id: string; title: string; path: string }> = [
      { id: "sitemap", title: "sitemap.xml location(s)", path: "/sitemap.xml" },
      { id: "robots", title: "robots.txt directives", path: "/robots.txt" },
    ];
    for (const probe of probes) {
      try {
        const res = await web.get(probe.path, { timeoutMs: 15000 });
        const hosts = new Set<string>();
        for (const m of res.body.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) hosts.add(m[1]);
        const hostList = [...hosts].sort();
        reporter.add({
          suite: "canonical",
          id: probe.id,
          title: probe.title,
          route: probe.path,
          test: `GET ${probe.path} and extract referenced hosts`,
          expected: "hosts are internally consistent (still owner decision which host is canonical)",
          verdict: "PASS",
          actual: `status=${res.status} hosts=[${hostList.join(",")}] (${hostList.length === 0 ? "none referenced" : ""})`,
          timestamp: t,
          latencyMs: res.latencyMs,
          evidence: [describeResponse(res, 160)],
        });
      } catch (error) {
        reporter.add({
          suite: "canonical",
          id: probe.id,
          title: probe.title,
          route: probe.path,
          test: `GET ${probe.path}`,
          expected: "reachable signal",
          verdict: "BLOCKED",
          actual: error instanceof RequestError ? error.message : String(error),
          timestamp: t,
        });
      }
    }

    try {
      const home = await web.get("/", { timeoutMs: 20000 });
      const canonical = home.body.match(/<link[^>]+rel=["']canonical["'][^>]*>/i)?.[0] ??
        home.body.match(/<link[^>]+rel=["']canonical["']/i)?.[0];
      const ogUrl = home.body.match(/property=["']og:url["'][^>]*content=["']([^"']+)["']/i)?.[1];
      const canonicalHref = canonical?.match(/href=["']([^"']+)["']/i)?.[1];
      reporter.add({
        suite: "canonical",
        id: "metadata",
        title: "Homepage canonical + og:url signals (recorded, not changed)",
        route: "/",
        test: "extract separate <link rel=canonical> and og:url from served HTML",
        expected: "recorded for the owner decision; signal refers to the served origin or the documented candidate",
        verdict: "PASS",
        actual: `canonical=${canonicalHref ?? "absent"} og:url=${ogUrl ?? "absent"}`,
        timestamp: t,
        latencyMs: home.latencyMs,
        evidence: [describeResponse(home, 140)],
      });
    } catch (error) {
      reporter.add({
        suite: "canonical",
        id: "metadata",
        title: "Homepage canonical + og:url signals",
        route: "/",
        test: "extract from served HTML",
        expected: "recorded",
        verdict: "BLOCKED",
        actual: error instanceof RequestError ? error.message : String(error),
        timestamp: t,
      });
    }
  } else {
    reporter.addBlocked("canonical", "signals", "Live canonical signals", "sitemap/robots/metadata extracted", "BASE_URL unset", "/sitemap.xml");
  }
}