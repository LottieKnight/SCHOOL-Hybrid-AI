import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/pastPapers/db";
import { pastPapersOpsLog } from "@/lib/pastPapers/opsLogger";
import { validatePastPapersEnv } from "@/lib/pastPapers/envValidation";
import {
  computePastPapersCoverageSnapshot,
  evaluatePastPapersCoverageSlo,
  readPastPapersCoverageSloConfig,
} from "@/lib/pastPapers/coverage";

export const runtime = "nodejs";
export const maxDuration = 55;

const STATUS_PATH = path.join(process.cwd(), "data", "past-papers", "ingest-status.json");
const FILE_LOCK_PATH = path.join(process.cwd(), "data", "past-papers", "ingest.lock");
const DB_LOCK_NAME = "past-papers-ingest";
const DEFAULT_MAX_LINKS = 300;
const DEFAULT_REPAIR_LIMIT = 50;
const MAX_LINKS_CAP = 2000;
const DEFAULT_EXEC_TIMEOUT_MS = 50_000;

type IngestRequestBody = {
  fullRun?: boolean;
  maxLinks?: number;
  repairLimit?: number;
  timeoutMs?: number;
  province?: string;
};

type IngestExecResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
};

type LockContext = {
  ownerId: string;
  leaseExpiresAtMs: number;
};

function parseTokenFromRequest(request: NextRequest) {
  const headerToken = request.headers.get("x-admin-ingest-token");
  if (headerToken) return headerToken;
  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

function parseBody(input: unknown): IngestRequestBody {
  if (!input || typeof input !== "object") return {};
  const body = input as Record<string, unknown>;
  return {
    fullRun: body.fullRun === true,
    maxLinks: typeof body.maxLinks === "number" ? body.maxLinks : undefined,
    repairLimit: typeof body.repairLimit === "number" ? body.repairLimit : undefined,
    timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : undefined,
    province: typeof body.province === "string" ? body.province.trim().toLowerCase() : undefined,
  };
}

function toPositiveInt(value: number | undefined, fallback: number, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isFinite(value ?? NaN)) return fallback;
  const rounded = Math.floor(value as number);
  if (rounded <= 0) return fallback;
  return Math.min(rounded, max);
}

function toBoundedTimeout(value: number | undefined) {
  return toPositiveInt(value, DEFAULT_EXEC_TIMEOUT_MS, 55_000);
}

async function ensureLockTable() {
  await db.run(`
    CREATE TABLE IF NOT EXISTS past_paper_ingest_locks (
      lock_name TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      acquired_at BIGINT NOT NULL,
      expires_at BIGINT NOT NULL
    )
  `);
}

async function acquireDbLock(ownerId: string, leaseMs: number): Promise<boolean> {
  await ensureLockTable();
  const now = Date.now();
  const expiresAt = now + leaseMs;
  const changed = await db.run(
    `
      INSERT INTO past_paper_ingest_locks (lock_name, owner_id, acquired_at, expires_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(lock_name) DO UPDATE SET
        owner_id = excluded.owner_id,
        acquired_at = excluded.acquired_at,
        expires_at = excluded.expires_at
      WHERE past_paper_ingest_locks.expires_at <= excluded.acquired_at
    `,
    [DB_LOCK_NAME, ownerId, now, expiresAt]
  );
  return Number(changed) > 0;
}

async function releaseDbLock(ownerId: string) {
  await ensureLockTable();
  await db.run(
    `DELETE FROM past_paper_ingest_locks WHERE lock_name = ? AND owner_id = ?`,
    [DB_LOCK_NAME, ownerId]
  );
}

async function acquireFileLock(lockContext: LockContext) {
  await fs.mkdir(path.dirname(FILE_LOCK_PATH), { recursive: true });
  const now = Date.now();
  const staleThreshold = now - 10 * 60_000;
  try {
    const stat = await fs.stat(FILE_LOCK_PATH);
    if (stat.mtimeMs < staleThreshold) {
      await fs.unlink(FILE_LOCK_PATH).catch(() => {});
      pastPapersOpsLog("warn", "ingest.file_lock.stale_removed", {
        staleMtimeMs: stat.mtimeMs,
        staleThreshold,
      });
    }
  } catch {
    // no-op
  }

  const content = JSON.stringify({
    ownerId: lockContext.ownerId,
    leaseExpiresAtMs: lockContext.leaseExpiresAtMs,
    createdAtIso: new Date().toISOString(),
  });
  await fs.writeFile(FILE_LOCK_PATH, content, { flag: "wx" });
}

async function releaseFileLock(ownerId: string) {
  try {
    const raw = await fs.readFile(FILE_LOCK_PATH, "utf-8");
    const parsed = JSON.parse(raw) as { ownerId?: string };
    if (parsed.ownerId && parsed.ownerId !== ownerId) return;
  } catch {
    // ignore
  }
  await fs.unlink(FILE_LOCK_PATH).catch(() => {});
}

async function withDistributedLock<T>(ownerId: string, leaseMs: number, task: () => Promise<T>): Promise<T> {
  const acquiredDb = await acquireDbLock(ownerId, leaseMs);
  if (!acquiredDb) {
    throw new Error("LOCKED:db-lock-held");
  }

  const lockContext: LockContext = { ownerId, leaseExpiresAtMs: Date.now() + leaseMs };
  try {
    await acquireFileLock(lockContext);
  } catch {
    await releaseDbLock(ownerId).catch(() => {});
    throw new Error("LOCKED:file-lock-held");
  }

  try {
    return await task();
  } finally {
    await releaseFileLock(ownerId).catch(() => {});
    await releaseDbLock(ownerId).catch(() => {});
  }
}

function runIngestCommand(args: string[], timeoutMs: number): Promise<IngestExecResult> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
    const child = spawn(npmBin, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!settled) {
          child.kill("SIGKILL");
        }
      }, 1500);
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      settled = true;
      clearTimeout(timer);
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
        durationMs: Date.now() - startedAt,
        timedOut,
      });
    });
  });
}

async function readStatusFile() {
  try {
    const raw = await fs.readFile(STATUS_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const envCheck = validatePastPapersEnv({ requireAdminToken: true });
  const ownerId = randomUUID();
  const tokenHeaderPresent = Boolean(request.headers.get("x-admin-ingest-token") || request.headers.get("authorization"));
  pastPapersOpsLog("info", "ingest.admin.request", {
    ownerId,
    method: request.method,
    tokenHeaderPresent,
    envOk: envCheck.ok,
  });

  const expectedToken = process.env.ADMIN_INGEST_TOKEN;
  if (!expectedToken) {
    pastPapersOpsLog("error", "ingest.admin.misconfigured", { ownerId, missing: "ADMIN_INGEST_TOKEN" });
    return NextResponse.json(
      { ok: false, error: "ADMIN_INGEST_TOKEN is not configured.", envValidation: envCheck },
      { status: 500 }
    );
  }

  const providedToken = parseTokenFromRequest(request);
  if (!providedToken || providedToken !== expectedToken) {
    pastPapersOpsLog("warn", "ingest.admin.unauthorized", { ownerId });
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: IngestRequestBody = {};
  try {
    body = parseBody(await request.json().catch(() => ({})));
  } catch {
    body = {};
  }

  const fullRun = body.fullRun === true;
  const province = body.province && body.province.length > 0 ? body.province : null;
  const maxLinks = fullRun
    ? null
    : toPositiveInt(body.maxLinks, DEFAULT_MAX_LINKS, MAX_LINKS_CAP);
  const repairLimit = toPositiveInt(body.repairLimit, DEFAULT_REPAIR_LIMIT, 500);
  const timeoutMs = toBoundedTimeout(body.timeoutMs);
  const leaseMs = timeoutMs + 15_000;

  const args = ["run", "ingest:dbe", "--", "--source=DBE", "--repair-orphans", `--repair-limit=${repairLimit}`];
  if (province) {
    args.push(`--province=${province}`);
  }
  if (maxLinks !== null) {
    args.push(`--max-links=${maxLinks}`);
  }
  args.push("--no-fail-on-error");

  pastPapersOpsLog("info", "ingest.admin.start", {
    ownerId,
    fullRun,
    province,
    maxLinks,
    repairLimit,
    timeoutMs,
  });

  try {
    const result = await withDistributedLock(ownerId, leaseMs, async () => runIngestCommand(args, timeoutMs));
    const status = await readStatusFile();
    const coverageSnapshot = await computePastPapersCoverageSnapshot();
    const slo = evaluatePastPapersCoverageSlo(coverageSnapshot, readPastPapersCoverageSloConfig(process.env));
    const stdoutLines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
    const stderrLines = result.stderr.trim().split(/\r?\n/).filter(Boolean);
    const ok = result.exitCode === 0 && !result.timedOut && slo.ok;

    pastPapersOpsLog(ok ? "info" : "error", "ingest.admin.finish", {
      ownerId,
      ok,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      durationMs: result.durationMs,
      sloOk: slo.ok,
      sloViolationCount: slo.violationCount,
    });

    return NextResponse.json(
      {
        ok,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        durationMs: result.durationMs,
        runConfig: { fullRun, province, maxLinks, repairLimit, timeoutMs, source: "DBE" },
        slo,
        stdoutTail: stdoutLines.slice(-50),
        stderrTail: stderrLines.slice(-50),
        status,
      },
      { status: ok ? 200 : result.timedOut ? 504 : 500 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("LOCKED:")) {
      pastPapersOpsLog("warn", "ingest.admin.locked", { ownerId, reason: message });
      return NextResponse.json(
        { ok: false, error: "Another ingestion run is already in progress." },
        { status: 409 }
      );
    }
    pastPapersOpsLog("error", "ingest.admin.failed", { ownerId, error: message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
