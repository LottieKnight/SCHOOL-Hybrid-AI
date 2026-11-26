import fs from "fs";
import path from "path";

const cwd = process.cwd();
const candidates = [
  path.join(cwd, ".env.local"),
  path.join(cwd, ".env"),
  path.join(cwd, "apps", "web", ".env.local"),
  path.join(cwd, "apps", "web", ".env"),
];

function loadEnvFromFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf-8");
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    if (!key || process.env[key]) continue;
    const value = line.slice(idx + 1).trim();
    if (!value) continue;
    process.env[key] = value;
  }
}

for (const candidate of candidates) {
  loadEnvFromFile(candidate);
}

const required = [
  { name: "PAST_PAPERS_DATABASE_URL", label: "Past Papers database URL" },
];

const missing = required.filter((item) => !process.env[item.name]);

if (missing.length > 0) {
  console.error("Missing required environment variables:");
  for (const item of missing) {
    console.error(`- ${item.name} (${item.label})`);
  }
  console.error("\nAdd them to .env or apps/web/.env.local (see .env.example).\n");
  process.exit(1);
}

console.log("Environment OK.");
