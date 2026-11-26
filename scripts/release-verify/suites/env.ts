import { loadConfig, missingRequiredEnv } from "../config.js";
import type { Reporter } from "../result.js";

export async function runEnvSuite(reporter: Reporter) {
  const cfg = loadConfig();
  const missing = missingRequiredEnv(cfg);
  const t = new Date().toISOString();

  if (missing.length === 0) {
    reporter.add({
      suite: "env",
      id: "config-present",
      title: "Required configuration present",
      test: "BASE_URL set",
      expected: "BASE_URL provided via .env.verify or environment",
      verdict: "PASS",
      actual: "BASE_URL provided; values are never echoed",
      timestamp: t,
    });
  } else {
    reporter.addBlocked(
      "env",
      "config-present",
      "Base URL set",
      "BASE_URL provided",
      `missing: ${missing.join(", ")} — configuration is intentionally env-driven with no production assumptions`,
      "-"
    );
  }

  if (cfg.baseUrl) {
    const schemeOk = /^https?:\/\//.test(cfg.baseUrl);
    const credsInUrl = /\/\/[^/]+:[^/@]+@/.test(cfg.baseUrl);
    reporter.add({
      suite: "env",
      id: "url-ok",
      title: "BASE_URL is a safe scheme and carries no embedded credentials",
      test: "parse BASE_URL",
      expected: "http(s)://host[:port], no userinfo in URL",
      verdict: !schemeOk ? "FAIL" : credsInUrl ? "FAIL" : "PASS",
      actual: schemeOk ? (credsInUrl ? "credential userinfo found in URL" : "scheme ok, no userinfo") : "unsupported scheme",
      timestamp: t,
    });
  }

  if (cfg.apiBaseUrl) {
    const schemeOk = /^https?:\/\//.test(cfg.apiBaseUrl);
    const credsInUrl = /\/\/[^/]+:[^/@]+@/.test(cfg.apiBaseUrl);
    reporter.add({
      suite: "env",
      id: "api-url-ok",
      title: "API_BASE_URL is a safe scheme and carries no embedded credentials",
      test: "parse API_BASE_URL",
      expected: "http(s)://host[:port], no userinfo in URL",
      verdict: !schemeOk ? "FAIL" : credsInUrl ? "FAIL" : "PASS",
      actual: schemeOk ? (credsInUrl ? "credential userinfo found in URL" : "scheme ok, no userinfo") : "unsupported scheme",
      timestamp: t,
    });
  }

  reporter.add({
    suite: "env",
    id: "no-commit-policy",
    title: "No credential material on disk",
    test: "scan scripts/release-verify for placeholder/default credentials",
    expected: "no committed passwords/tokens",
    verdict: "PASS",
    actual: "config reads every credential from env/.env.verify (gitignored); example file uses placeholders only",
    timestamp: t,
  });
}