import { readFile } from "node:fs/promises";
import path from "node:path";

const configPath = path.join(process.cwd(), "apps", "web", "next.config.mjs");
const middlewarePath = path.join(process.cwd(), "apps", "web", "middleware.ts");
const content = await readFile(configPath, "utf-8");
const middleware = await readFile(middlewarePath, "utf-8");

const required = [
  "Referrer-Policy",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Permissions-Policy",
];

const missing = required.filter((header) => !content.includes(header));
if (!middleware.includes("Content-Security-Policy") || !middleware.includes("nonce-") || !middleware.includes("strict-dynamic")) {
  missing.push("Content-Security-Policy (middleware nonce + strict-dynamic)");
}
if (!middleware.includes("style-src-attr 'unsafe-inline'")) {
  missing.push("style-src-attr 'unsafe-inline'");
}

if (missing.length) {
  console.error("Missing security headers in the web security configuration:");
  for (const header of missing) {
    console.error(`- ${header}`);
  }
  process.exitCode = 1;
} else {
  console.log("Security headers present in next.config.mjs and middleware.ts.");
}
