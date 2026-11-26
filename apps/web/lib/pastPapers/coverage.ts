import { db } from "./db";
import { UNKNOWN_SUBJECT } from "./query";

export type PastPapersCoverageRow = {
  province: string;
  grade: number;
  totalWithPaper: number;
  uiReadyCount: number;
  subjectCount: number;
  yearCount: number;
  sessionCount: number;
  sampleSubjects: string[];
};

export type PastPapersCoverageSnapshot = {
  generatedAtIso: string;
  rows: PastPapersCoverageRow[];
  provinceCount: number;
  pairCount: number;
  totalWithPaper: number;
  totalUiReady: number;
};

export type PastPapersCoverageSloConfig = {
  minUiReadyPerObservedPair: number;
  minUiReadyPerRequiredPair: number;
  requiredProvinces: string[];
  requiredGrades: number[];
};

export type PastPapersCoverageSloViolation = {
  type: "observed_pair" | "required_pair";
  province: string;
  grade: number;
  uiReadyCount: number;
  minRequired: number;
  detail: string;
};

export type PastPapersCoverageSloReport = {
  ok: boolean;
  config: PastPapersCoverageSloConfig;
  violationCount: number;
  violations: PastPapersCoverageSloViolation[];
};

function toPositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const int = Math.floor(parsed);
  return int > 0 ? int : fallback;
}

function parseCsvList(value: string | undefined) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function parseGradeList(value: string | undefined) {
  if (!value) return [12];
  const parsed = value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((num) => Number.isFinite(num))
    .map((num) => Math.floor(num))
    .filter((num) => num >= 0 && num <= 12);
  if (!parsed.length) return [12];
  return Array.from(new Set(parsed)).sort((a, b) => a - b);
}

export function readPastPapersCoverageSloConfig(env: NodeJS.ProcessEnv = process.env): PastPapersCoverageSloConfig {
  return {
    minUiReadyPerObservedPair: toPositiveInt(env.PAST_PAPERS_SLO_MIN_UI_READY_PER_OBSERVED_PAIR, 1),
    minUiReadyPerRequiredPair: toPositiveInt(env.PAST_PAPERS_SLO_MIN_UI_READY_PER_REQUIRED_PAIR, 1),
    requiredProvinces: parseCsvList(env.PAST_PAPERS_SLO_REQUIRED_PROVINCES),
    requiredGrades: parseGradeList(env.PAST_PAPERS_SLO_REQUIRED_GRADES),
  };
}

export async function computePastPapersCoverageSnapshot(): Promise<PastPapersCoverageSnapshot> {
  const rows = (await db.findMany("PastPaper", {
    where: {
      paperStorageKey: { not: null },
      grade: { not: null },
    },
    select: ["province", "grade", "subject", "year", "session"],
  })) as Array<{
    province: string;
    grade: number | null;
    subject: string;
    year: number | null;
    session: string;
  }>;

  const pairMap = new Map<
    string,
    {
      province: string;
      grade: number;
      totalWithPaper: number;
      uiReadyCount: number;
      subjects: Set<string>;
      years: Set<number>;
      sessions: Set<string>;
    }
  >();

  for (const row of rows) {
    if (row.grade === null) continue;
    const key = `${row.province}|${row.grade}`;
    const entry = pairMap.get(key) || {
      province: row.province,
      grade: row.grade,
      totalWithPaper: 0,
      uiReadyCount: 0,
      subjects: new Set<string>(),
      years: new Set<number>(),
      sessions: new Set<string>(),
    };
    entry.totalWithPaper += 1;

    const isUiReady = row.year !== null && row.subject !== UNKNOWN_SUBJECT;
    if (isUiReady) {
      entry.uiReadyCount += 1;
      entry.subjects.add(row.subject);
      entry.years.add(row.year as number);
      entry.sessions.add(row.session);
    }
    pairMap.set(key, entry);
  }

  const matrixRows: PastPapersCoverageRow[] = Array.from(pairMap.values())
    .map((entry) => ({
      province: entry.province,
      grade: entry.grade,
      totalWithPaper: entry.totalWithPaper,
      uiReadyCount: entry.uiReadyCount,
      subjectCount: entry.subjects.size,
      yearCount: entry.years.size,
      sessionCount: entry.sessions.size,
      sampleSubjects: Array.from(entry.subjects).sort().slice(0, 5),
    }))
    .sort((a, b) => {
      const provinceOrder = a.province.localeCompare(b.province, "en", { sensitivity: "base" });
      if (provinceOrder !== 0) return provinceOrder;
      return a.grade - b.grade;
    });

  return {
    generatedAtIso: new Date().toISOString(),
    rows: matrixRows,
    provinceCount: new Set(matrixRows.map((row) => row.province)).size,
    pairCount: matrixRows.length,
    totalWithPaper: matrixRows.reduce((sum, row) => sum + row.totalWithPaper, 0),
    totalUiReady: matrixRows.reduce((sum, row) => sum + row.uiReadyCount, 0),
  };
}

export function evaluatePastPapersCoverageSlo(
  snapshot: PastPapersCoverageSnapshot,
  config: PastPapersCoverageSloConfig
): PastPapersCoverageSloReport {
  const violations: PastPapersCoverageSloViolation[] = [];
  const rowByPair = new Map(snapshot.rows.map((row) => [`${row.province}|${row.grade}`, row]));

  for (const row of snapshot.rows) {
    if (row.totalWithPaper <= 0) continue;
    if (row.uiReadyCount >= config.minUiReadyPerObservedPair) continue;
    violations.push({
      type: "observed_pair",
      province: row.province,
      grade: row.grade,
      uiReadyCount: row.uiReadyCount,
      minRequired: config.minUiReadyPerObservedPair,
      detail:
        `Observed province-grade pair has ${row.totalWithPaper} paper rows but only ` +
        `${row.uiReadyCount} UI-ready rows.`,
    });
  }

  for (const province of config.requiredProvinces) {
    for (const grade of config.requiredGrades) {
      const key = `${province}|${grade}`;
      const row = rowByPair.get(key);
      const uiReadyCount = row?.uiReadyCount ?? 0;
      if (uiReadyCount >= config.minUiReadyPerRequiredPair) continue;
      violations.push({
        type: "required_pair",
        province,
        grade,
        uiReadyCount,
        minRequired: config.minUiReadyPerRequiredPair,
        detail: row
          ? "Required province-grade pair is below minimum UI-ready threshold."
          : "Required province-grade pair has no paper rows.",
      });
    }
  }

  return {
    ok: violations.length === 0,
    config,
    violationCount: violations.length,
    violations,
  };
}
