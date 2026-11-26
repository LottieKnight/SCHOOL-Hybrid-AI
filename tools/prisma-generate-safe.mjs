import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const args = ["prisma", "generate", "--schema", "apps/web/prisma/schema.prisma"];
const maxAttempts = 5;
const generatedClientPath = path.join(repoRoot, "node_modules", "@prisma", "client", "index.js");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runOnce() {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: process.env,
    });

    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

let lastCode = 1;
for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const code = await runOnce();
  lastCode = code;
  if (code === 0) {
    process.exit(0);
  }

  if (process.platform === "win32") {
    try {
      const stat = await import("node:fs/promises").then(({ stat: s }) => s(generatedClientPath));
      if (stat.isFile()) {
        console.warn(
          `[prisma-generate-safe] Continuing with existing Prisma Client because Windows file lock prevented regeneration.`
        );
        process.exit(0);
      }
    } catch {
      // Continue to retries.
    }
  }

  if (process.platform !== "win32" || attempt === maxAttempts) {
    break;
  }

  const backoffMs = attempt * 1200;
  console.warn(
    `[prisma-generate-safe] prisma generate failed (attempt ${attempt}/${maxAttempts}), retrying in ${backoffMs}ms...`
  );
  await wait(backoffMs);
}

process.exit(lastCode || 1);
