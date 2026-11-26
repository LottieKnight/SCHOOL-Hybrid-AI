import { promises as fs } from "node:fs";
import path from "node:path";
import { db } from "@/lib/pastPapers/db";
import { getStorageProvider } from "@/lib/storage";
import { buildPastPaperWhere } from "@/lib/pastPapers/query";
import {
  computePastPapersCoverageSnapshot,
  evaluatePastPapersCoverageSlo,
  readPastPapersCoverageSloConfig,
  type PastPapersCoverageSloReport,
  type PastPapersCoverageSnapshot,
} from "@/lib/pastPapers/coverage";
import { validatePastPapersEnv, type PastPapersEnvValidationResult } from "@/lib/pastPapers/envValidation";
import { pastPapersOpsLog } from "@/lib/pastPapers/opsLogger";

const INGEST_STATUS_PATH = path.join(process.cwd(), "data", "past-papers", "ingest-status.json");
const DBE_INDEX_URL =
  "https://www.education.gov.za/Curriculum/NationalSeniorCertificate%28NSC%29Examinations/NSCPastExaminationpapers.aspx";

export type PastPapersDiagnosticCounts = {
  totalPapers: number;
  uiReadyPapers: number;
  papersWithPaperStorageKey: number;
  papersWithMemoStorageKey: number;
  papersMissingPaperStorageKey: number;
  papersMissingMemoStorageKey: number;
  papersMissingOriginalPaperUrl: number;
  papersMissingOriginalMemoUrl: number;
  totalQuestions: number;
  totalAttempts: number;
};

export type PastPapersDiagnosticSample = {
  id: string;
  title: string;
  province: string;
  grade: number | null;
  subject: string;
  year: number | null;
  session: string;
  paperStorageKey: string | null;
  memoStorageKey: string | null;
  paperUrlOriginal: string | null;
  memoUrlOriginal: string | null;
  sourcePageUrl: string | null;
  openPaperUrl: string | null;
  openMemoUrl: string | null;
  paperFileExists: boolean | null;
  memoFileExists: boolean | null;
};

export type PastPapersIntegrityCheck = {
  name: string;
  ok: boolean;
  detail: string;
  data?: Record<string, unknown>;
};

export type PastPapersIntegrityReport = {
  ok: boolean;
  ranAtIso: string;
  checks: PastPapersIntegrityCheck[];
};

export type PastPapersIngestStatus = {
  ranAtIso: string | null;
  ok: boolean | null;
  sourceName: string | null;
  errorSummary: string | null;
  stats: PastPapersIngestStats | null;
  repairSummary: PastPapersRepairSummary | null;
  driftReport: PastPapersDriftReport | null;
};

export type PastPapersIngestStats = {
  pagesFetched: number;
  linksExtracted: number;
  linksSelected: number;
  linksSkippedByYear: number;
  linksSkippedByProvince: number;
  selectionGroupsTotal: number;
  selectionGroupsWithBoth: number;
  selectionGroupsSingleOnly: number;
  selectionLinksFromPairedGroups: number;
  skippedMeta: number;
  skippedUnchanged: number;
  inserted: number;
  updated: number;
  errors: number;
  uiReadyCount: number;
  paperOnlyCount: number;
  memoOnlyCount: number;
  bothCount: number;
  repairAttemptedCount: number;
  repairSucceededCount: number;
};

export type PastPapersRepairSummary = {
  attemptedCount: number;
  succeededCount: number;
  repairedIds: string[];
};

export type PastPapersDriftReport = {
  generatedAtIso: string;
  paperOnlyCount: number;
  memoOnlyCount: number;
  candidateMatches: number;
};

export type PastPapersSourceConnectivity = {
  status: "ok" | "blocked" | "error";
  httpStatus: number | null;
  reason: string;
  pdfLinkCount: number;
  checkedAtIso: string;
};

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}

function normalizeIngestStats(input: Record<string, unknown> | null | undefined): PastPapersIngestStats | null {
  if (!input) return null;
  return {
    pagesFetched: toNumber(input.pagesFetched),
    linksExtracted: toNumber(input.linksExtracted),
    linksSelected: toNumber(input.linksSelected),
    linksSkippedByYear: toNumber(input.linksSkippedByYear),
    linksSkippedByProvince: toNumber(input.linksSkippedByProvince),
    selectionGroupsTotal: toNumber(input.selectionGroupsTotal),
    selectionGroupsWithBoth: toNumber(input.selectionGroupsWithBoth),
    selectionGroupsSingleOnly: toNumber(input.selectionGroupsSingleOnly),
    selectionLinksFromPairedGroups: toNumber(input.selectionLinksFromPairedGroups),
    skippedMeta: toNumber(input.skippedMeta),
    skippedUnchanged: toNumber(input.skippedUnchanged),
    inserted: toNumber(input.inserted),
    updated: toNumber(input.updated),
    errors: toNumber(input.errors),
    uiReadyCount: toNumber(input.uiReadyCount),
    paperOnlyCount: toNumber(input.paperOnlyCount),
    memoOnlyCount: toNumber(input.memoOnlyCount),
    bothCount: toNumber(input.bothCount),
    repairAttemptedCount: toNumber(input.repairAttemptedCount),
    repairSucceededCount: toNumber(input.repairSucceededCount),
  };
}

function normalizeRepairSummary(input: unknown): PastPapersRepairSummary | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  const repairedIds = Array.isArray(value.repairedIds)
    ? value.repairedIds.map((item) => String(item)).slice(0, 20)
    : [];
  return {
    attemptedCount: toNumber(value.attemptedCount),
    succeededCount: toNumber(value.succeededCount),
    repairedIds,
  };
}

function normalizeDriftReport(input: unknown): PastPapersDriftReport | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  return {
    generatedAtIso: typeof value.generatedAtIso === "string" ? value.generatedAtIso : "",
    paperOnlyCount: toNumber(value.paperOnlyCount),
    memoOnlyCount: toNumber(value.memoOnlyCount),
    candidateMatches: toNumber(value.candidateMatches),
  };
}

async function safeExists(key: string | null) {
  if (!key) return null;
  const provider = getStorageProvider();
  try {
    return await provider.exists(key);
  } catch (error) {
    pastPapersOpsLog("error", "storage.exists.failed", {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function safeSignedUrl(key: string | null) {
  if (!key) return null;
  const provider = getStorageProvider();
  try {
    return await provider.getSignedUrl(key);
  } catch (error) {
    pastPapersOpsLog("error", "storage.signed_url.failed", {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function extractPdfCount(html: string) {
  return Array.from(html.matchAll(/href=["']([^"']+\.pdf[^"']*)["']/gi)).length;
}

export async function readPastPapersIngestStatus(): Promise<PastPapersIngestStatus> {
  try {
    const raw = await fs.readFile(INGEST_STATUS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as {
      ranAtIso?: string;
      ok?: boolean;
      sourceName?: string;
      errorSummary?: string | null;
      stats?: Record<string, unknown>;
      repairSummary?: unknown;
      driftReport?: unknown;
    };
    return {
      ranAtIso: parsed.ranAtIso || null,
      ok: typeof parsed.ok === "boolean" ? parsed.ok : null,
      sourceName: parsed.sourceName || null,
      errorSummary: parsed.errorSummary || null,
      stats: normalizeIngestStats(parsed.stats),
      repairSummary: normalizeRepairSummary(parsed.repairSummary),
      driftReport: normalizeDriftReport(parsed.driftReport),
    };
  } catch {
    return {
      ranAtIso: null,
      ok: null,
      sourceName: null,
      errorSummary: null,
      stats: null,
      repairSummary: null,
      driftReport: null,
    };
  }
}

export async function runPastPapersSourceConnectivityCheck(): Promise<PastPapersSourceConnectivity> {
  const checkedAtIso = new Date().toISOString();
  try {
    const response = await fetch(DBE_INDEX_URL, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-ZA,en;q=0.9",
        Referer: "https://www.education.gov.za/",
      },
    });
    const html = await response.text();
    const pdfLinkCount = response.ok ? extractPdfCount(html) : 0;
    if (!response.ok) {
      return {
        status: "blocked",
        httpStatus: response.status,
        reason: `DBE index returned HTTP ${response.status}`,
        pdfLinkCount,
        checkedAtIso,
      };
    }
    return {
      status: "ok",
      httpStatus: response.status,
      reason: `Reachable with ${pdfLinkCount} direct PDF links detected`,
      pdfLinkCount,
      checkedAtIso,
    };
  } catch (error) {
    return {
      status: "error",
      httpStatus: null,
      reason: error instanceof Error ? error.message : String(error),
      pdfLinkCount: 0,
      checkedAtIso,
    };
  }
}

export async function getPastPapersDiagnosticData(sampleSize = 5): Promise<{
  counts: PastPapersDiagnosticCounts;
  samples: PastPapersDiagnosticSample[];
  ingestStatus: PastPapersIngestStatus;
  sourceConnectivity: PastPapersSourceConnectivity;
  coverageSnapshot: PastPapersCoverageSnapshot;
  coverageSlo: PastPapersCoverageSloReport;
  envValidation: PastPapersEnvValidationResult;
}> {
  const coverageSnapshotPromise = computePastPapersCoverageSnapshot();
  const [
    totalPapers,
    uiReadyPapers,
    papersWithPaperStorageKey,
    papersWithMemoStorageKey,
    papersMissingPaperStorageKey,
    papersMissingMemoStorageKey,
    papersMissingOriginalPaperUrl,
    papersMissingOriginalMemoUrl,
    totalQuestions,
    totalAttempts,
    sampleRows,
    ingestStatus,
    sourceConnectivity,
    coverageSnapshot,
  ] = await Promise.all([
    db.count("PastPaper"),
    db.count("PastPaper", buildPastPaperWhere(false)),
    db.count("PastPaper", { paperStorageKey: { not: null } }),
    db.count("PastPaper", { memoStorageKey: { not: null } }),
    db.count("PastPaper", { paperStorageKey: null }),
    db.count("PastPaper", { memoStorageKey: null }),
    db.count("PastPaper", { paperUrlOriginal: null }),
    db.count("PastPaper", { memoUrlOriginal: null }),
    db.count("PastPaperQuestion"),
    db.count("PastPaperAttempt"),
    (await db.findMany("PastPaper", {
      where: buildPastPaperWhere(false),
      orderBy: [{ updatedAt: "desc" }],
      take: sampleSize,
      select: [
        "id",
        "title",
        "province",
        "grade",
        "subject",
        "year",
        "session",
        "paperStorageKey",
        "memoStorageKey",
        "paperUrlOriginal",
        "memoUrlOriginal",
        "sourcePageUrl",
      ],
    })) as Array<{
      id: string;
      title: string;
      province: string;
      grade: number | null;
      subject: string;
      year: number | null;
      session: string;
      paperStorageKey: string | null;
      memoStorageKey: string | null;
      paperUrlOriginal: string | null;
      memoUrlOriginal: string | null;
      sourcePageUrl: string | null;
    }>,
    readPastPapersIngestStatus(),
    runPastPapersSourceConnectivityCheck(),
    coverageSnapshotPromise,
  ]);
  const coverageSlo = evaluatePastPapersCoverageSlo(coverageSnapshot, readPastPapersCoverageSloConfig(process.env));

  const samples: PastPapersDiagnosticSample[] = [];
  for (const row of sampleRows) {
    const [openPaperUrl, openMemoUrl, paperFileExists, memoFileExists] = await Promise.all([
      safeSignedUrl(row.paperStorageKey),
      safeSignedUrl(row.memoStorageKey),
      safeExists(row.paperStorageKey),
      safeExists(row.memoStorageKey),
    ]);

    samples.push({
      id: row.id,
      title: row.title,
      province: row.province,
      grade: row.grade,
      subject: row.subject,
      year: row.year,
      session: row.session,
      paperStorageKey: row.paperStorageKey,
      memoStorageKey: row.memoStorageKey,
      paperUrlOriginal: row.paperUrlOriginal,
      memoUrlOriginal: row.memoUrlOriginal,
      sourcePageUrl: row.sourcePageUrl,
      openPaperUrl,
      openMemoUrl,
      paperFileExists,
      memoFileExists,
    });
  }

  const envValidation = validatePastPapersEnv();
  return {
    counts: {
      totalPapers,
      uiReadyPapers,
      papersWithPaperStorageKey,
      papersWithMemoStorageKey,
      papersMissingPaperStorageKey,
      papersMissingMemoStorageKey,
      papersMissingOriginalPaperUrl,
      papersMissingOriginalMemoUrl,
      totalQuestions,
      totalAttempts,
    },
    samples,
    ingestStatus,
    sourceConnectivity,
    coverageSnapshot,
    coverageSlo,
    envValidation,
  };
}

export async function runPastPapersIntegrityChecks(minPapers = 1): Promise<PastPapersIntegrityReport> {
  const checks: PastPapersIntegrityCheck[] = [];

  try {
    await db.raw("SELECT 1 AS ok");
    checks.push({
      name: "Database connectivity",
      ok: true,
      detail: "Connected successfully.",
    });
  } catch (error) {
    checks.push({
      name: "Database connectivity",
      ok: false,
      detail: "Connection failed.",
      data: { error: error instanceof Error ? error.message : String(error) },
    });
  }

  const modelChecks: Array<{ name: string; run: () => Promise<number> }> = [
    { name: "PastPaperSource table", run: () => db.count("PastPaperSource") },
    { name: "PastPaper table", run: () => db.count("PastPaper") },
    { name: "PastPaperQuestion table", run: () => db.count("PastPaperQuestion") },
    { name: "PastPaperAttempt table", run: () => db.count("PastPaperAttempt") },
    { name: "PastPaperAnswer table", run: () => db.count("PastPaperAnswer") },
  ];

  for (const check of modelChecks) {
    try {
      const count = await check.run();
      checks.push({
        name: check.name,
        ok: true,
        detail: "Table query succeeded.",
        data: { rowCount: count },
      });
    } catch (error) {
      checks.push({
        name: check.name,
        ok: false,
        detail: "Table query failed.",
        data: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  try {
    const count = await db.count("PastPaper", buildPastPaperWhere(false));
    const ok = count >= minPapers;
    checks.push({
      name: "Minimum UI-ready papers available",
      ok,
      detail: ok
        ? `Found ${count} UI-ready paper records (minimum ${minPapers}).`
        : `Found ${count} UI-ready paper records; expected at least ${minPapers}.`,
      data: { uiReadyPapers: count, minPapers },
    });
  } catch (error) {
    checks.push({
      name: "Minimum UI-ready papers available",
      ok: false,
      detail: "Failed to count UI-ready papers.",
      data: { error: error instanceof Error ? error.message : String(error) },
    });
  }

  try {
    const snapshot = await computePastPapersCoverageSnapshot();
    const slo = evaluatePastPapersCoverageSlo(snapshot, readPastPapersCoverageSloConfig(process.env));
    checks.push({
      name: "Coverage matrix",
      ok: snapshot.pairCount > 0,
      detail:
        snapshot.pairCount > 0
          ? `Coverage rows: ${snapshot.pairCount}, provinces: ${snapshot.provinceCount}.`
          : "No coverage rows found.",
      data: {
        generatedAtIso: snapshot.generatedAtIso,
        pairCount: snapshot.pairCount,
        provinceCount: snapshot.provinceCount,
        totalWithPaper: snapshot.totalWithPaper,
        totalUiReady: snapshot.totalUiReady,
        sampleRows: snapshot.rows.slice(0, 20),
      },
    });
    checks.push({
      name: "Coverage SLO",
      ok: slo.ok,
      detail: slo.ok
        ? "Coverage SLO satisfied."
        : `Coverage SLO failed with ${slo.violationCount} violation(s).`,
      data: {
        config: slo.config,
        violationCount: slo.violationCount,
        violations: slo.violations.slice(0, 30),
      },
    });
  } catch (error) {
    checks.push({
      name: "Coverage matrix",
      ok: false,
      detail: "Failed to compute coverage matrix.",
      data: { error: error instanceof Error ? error.message : String(error) },
    });
  }

  try {
    const sample = (await db.findFirst("PastPaper", {
      where: buildPastPaperWhere(false),
      orderBy: { updatedAt: "desc" },
      select: ["id", "paperStorageKey"],
    })) as { id: string; paperStorageKey: string | null } | null;

    if (!sample || !sample.paperStorageKey) {
      checks.push({
        name: "Sample paper storage key",
        ok: false,
        detail: "No UI-ready paper record with paperStorageKey was found.",
      });
    } else {
      const exists = await safeExists(sample.paperStorageKey);
      checks.push({
        name: "Sample paper storage key",
        ok: true,
        detail: "Sample paper key is present.",
        data: { sampleId: sample.id, paperStorageKey: sample.paperStorageKey },
      });
      checks.push({
        name: "Sample paper file exists",
        ok: exists === true,
        detail: exists ? "Sample paper file exists in configured storage." : "Sample paper file is missing.",
        data: { sampleId: sample.id, paperStorageKey: sample.paperStorageKey, exists },
      });
    }
  } catch (error) {
    checks.push({
      name: "Sample paper integrity",
      ok: false,
      detail: "Failed to verify sample paper integrity.",
      data: { error: error instanceof Error ? error.message : String(error) },
    });
  }

  return {
    ok: checks.every((check) => check.ok),
    ranAtIso: new Date().toISOString(),
    checks,
  };
}
