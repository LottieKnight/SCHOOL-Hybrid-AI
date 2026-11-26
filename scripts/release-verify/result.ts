import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export type Verdict = "PASS" | "FAIL" | "BLOCKED" | "NOT-APPLICABLE";

export interface CheckRecord {
  suite: string;
  id: string;
  title: string;
  route?: string;
  test: string;
  expected: string;
  verdict: Verdict;
  actual?: string;
  latencyMs?: number;
  evidence?: string[];
  timestamp: string;
}

const REDACT_PATTERNS: Array<{ re: RegExp; replace: string }> = [
  { re: /("(?:token|csrfToken|csrf|jwt|accessToken|refreshToken|sessionToken|authToken)"\s*:\s*")([^"]+)/gi, replace: '$1"<redacted>"' },
  { re: /("password"\s*:\s*")[^"]*/gi, replace: '$1<redacted>"' },
  { re: /(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, replace: "$1<redacted>" },
  { re: /(x-(?:api-|metrics-|csrf|auth-)?token\b)\s*[:=]\s*[^\s",;]+/gi, replace: "$1=<redacted>" },
  { re: /(set-cookie:\s*[A-Za-z0-9_%-]+=)[^;,\s]+/gi, replace: "$1<redacted>" },
  { re: /(cookie:\s*[A-Za-z0-9_%-]+=)[^;]+/gi, replace: "$1<redacted>" },
];

export function redactText(text: string): string {
  let out = text;
  for (const { re, replace } of REDACT_PATTERNS) {
    out = out.replace(re, replace);
  }
  return out;
}

export function safeJsonStringify(value: unknown, maxBytes = 2000): string {
  let json: string;
  try {
    json = JSON.stringify(value);
  } catch {
    json = String(value);
  }
  if (!json) json = String(value ?? "");
  const redacted = redactText(json);
  return redacted.length > maxBytes ? `${redacted.slice(0, maxBytes)}…` : redacted;
}

export class Reporter {
  readonly results: CheckRecord[] = [];

  add(record: Omit<CheckRecord, "timestamp"> & { timestamp?: string }): CheckRecord {
    const full: CheckRecord = { ...record, timestamp: record.timestamp ?? new Date().toISOString() };
    this.results.push(full);
    return full;
  }

  addBlocked(suite: string, id: string, title: string, expected: string, reason: string, route?: string): CheckRecord {
    return this.add({ suite, id, title, route, test: "prerequisite not satisfiable", expected, verdict: "BLOCKED", actual: reason });
  }

  summary(): { count: number; passed: number; failed: number; blocked: number; na: number } {
    const tally = { count: this.results.length, passed: 0, failed: 0, blocked: 0, na: 0 };
    for (const r of this.results) {
      if (r.verdict === "PASS") tally.passed += 1;
      else if (r.verdict === "FAIL") tally.failed += 1;
      else if (r.verdict === "BLOCKED") tally.blocked += 1;
      else tally.na += 1;
    }
    return tally;
  }

  renderTable(): string {
    const rows = this.results.map((r) => `${r.verdict.padEnd(14)} ${r.suite}/${r.id} ${r.title}${r.route ? ` @ ${r.route}` : ""}`);
    return rows.join("\n");
  }

  writeJson(file: string): string {
    mkdirSync(path.dirname(file), { recursive: true });
    const payload = {
      generatedAt: new Date().toISOString(),
      summary: this.summary(),
      results: this.results.map((r) => ({ ...r, evidence: r.evidence?.map(redactText) })),
    };
    writeFileSync(file, JSON.stringify(payload, null, 2));
    return file;
  }

  writeMarkdown(file: string): string {
    mkdirSync(path.dirname(file), { recursive: true });
    const s = this.summary();
    const lines: string[] = [
      "# Release Verification Report",
      "",
      `Generated: ${new Date().toISOString()}`,
      "",
      `**PASS:** ${s.passed} · **FAIL:** ${s.failed} · **BLOCKED:** ${s.blocked} · **N/A:** ${s.na} · **Total:** ${s.count}`,
      "",
      "| Verdict | Suite | ID | Title | Route | Test | Expected | Actual | Timestamp |",
      "|---|---|---|---|---|---|---|---|---|",
    ];
    for (const r of this.results) {
      lines.push(
        `| ${r.verdict} | ${r.suite} | ${r.id} | ${r.title} | ${r.route ?? ""} | ${r.test} | ${r.expected} | ${(r.actual ?? "").slice(0, 120)} | ${r.timestamp} |`
      );
    }
    lines.push("", "## Evidence");
    for (const r of this.results) {
      if (r.evidence && r.evidence.length > 0) {
        lines.push(`### ${r.suite}/${r.id} — ${r.title}`);
        for (const e of r.evidence) lines.push(`- ${redactText(e)}`);
      }
    }
    const out = lines.join("\n");
    writeFileSync(file, out);
    return file;
  }
}