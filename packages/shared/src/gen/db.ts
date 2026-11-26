import { Pool } from "pg";
import fs from "node:fs";
import path from "node:path";

let pool: Pool | null = null;

function loadEnvFromFile(envPath: string) {
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf-8");
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    if (!key || process.env[key]) continue;
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function ensureDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, ".env"),
    path.join(cwd, "..", ".env"),
    path.join(cwd, "..", "..", ".env"),
    path.join(cwd, "..", "..", "..", ".env"),
  ];
  for (const candidate of candidates) {
    loadEnvFromFile(candidate);
    if (process.env.DATABASE_URL) break;
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Add it to your environment or .env file.");
  }
  return process.env.DATABASE_URL;
}

export function getDbPool() {
  if (!pool) {
    const connectionString = ensureDatabaseUrl();
    pool = new Pool({ connectionString, max: 10 });
    pool.on("error", (error) => {
      console.error("Unexpected PostgreSQL error:", error);
    });
  }
  return pool;
}

export async function closeDbPool() {
  if (!pool) return;
  await pool.end();
  pool = null;
}
