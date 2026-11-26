import fs from "node:fs";
import path from "node:path";
import { pastPapersOpsLog } from "./pastPapers/opsLogger";

const isProd = process.env.NODE_ENV === "production";

type RequireEnvOptions = {
  devDefault?: string;
  label?: string;
};

function loadEnvFromFile(envPath: string): void {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const raw = fs.readFileSync(envPath, "utf-8");
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    if (!key || process.env[key]) continue;
    const value = line.slice(idx + 1).trim();
    if (value.length === 0) continue;
    process.env[key] = value;
  }
}

function loadEnvIfMissing(name: string): void {
  if (process.env[name]) return;

  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, ".env.local"),
    path.join(cwd, ".env"),
    path.join(cwd, "..", ".env.local"),
    path.join(cwd, "..", ".env"),
    path.join(cwd, "..", "..", ".env.local"),
    path.join(cwd, "..", "..", ".env"),
  ];

  for (const candidate of candidates) {
    loadEnvFromFile(candidate);
    if (process.env[name]) return;
  }
}

function requireEnv(name: string, options: RequireEnvOptions = {}): string | null {
  loadEnvIfMissing(name);

  const value = process.env[name];
  if (value && value.length > 0) {
    return value;
  }

  if (!isProd && options.devDefault) {
    process.env[name] = options.devDefault;
    return options.devDefault;
  }

  const label = options.label || name;
  pastPapersOpsLog("error", "env.required.missing", {
    key: name,
    message: `${label} is required${isProd ? " in production" : ""}.`,
  });
  return null;
}

export function initPastPapersEnv(): void {
  const primaryDb = requireEnv("PAST_PAPERS_DATABASE_URL", {
    devDefault: "file:./past-papers.db",
  });

  if (!primaryDb && process.env.DATABASE_URL) {
    process.env.PAST_PAPERS_DATABASE_URL = process.env.DATABASE_URL;
    pastPapersOpsLog("warn", "env.database.fallback", {
      message: "PAST_PAPERS_DATABASE_URL missing, falling back to DATABASE_URL.",
    });
  }
}
