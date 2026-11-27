/**
 * Past-paper catalogue indexing.
 *
 * The ingested rows keep DBE labels ("Nsc/sc Exam Timetable", language `en`,
 * session `Nov`, titles copied from the memo link). Browse, search, and the
 * API all go through these helpers so the catalogue stays a study index:
 * real papers only, normalised names, newest year first, core subjects first,
 * and a question paper paired with its memo when both files exist.
 */

export const FET_GRADES = [10, 11, 12] as const;

export const CORE_SUBJECTS = [
  "mathematics",
  "mathematical literacy",
  "physical sciences",
  "life sciences",
  "accounting",
  "english hl",
  "english fal",
  "afrikaans hl",
  "afrikaans fal",
  "business studies",
  "economics",
  "geography",
  "history",
] as const;

const CANONICAL_SUBJECTS: Record<string, string> = {
  "engineering graphic and design": "Engineering Graphics and Design",
  "engineering graphics and design": "Engineering Graphics and Design",
  "south african sign language (final)": "South African Sign Language",
  "south african sign language": "South African Sign Language",
};

const NON_PAPER =
  /\b(timetables?|time\s*tables?|circulars?|errata|r[eé]sum[eé]|related\s+documents?|examination\s+guidelines?|report\s+550)\b/i;

const PROVINCE_IN_TITLE = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "KwaZulu Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
];

export type MemoStatus = "available" | "missing" | "unlinked";

export type CatalogGradeScope =
  | { kind: "all" }
  | { kind: "one"; grade: number }
  | { kind: "fet" };

export type CatalogSearchInput = {
  grade?: number;
  allGrades?: boolean;
  userGrade?: number | null;
  subject?: string;
  year?: number;
  session?: string;
  language?: string;
  hasMemo?: boolean;
  q?: string;
  institutionType?: string;
  limit?: number;
  offset?: number;
};

export type CatalogSearchPlan = {
  whereSql: string;
  whereParams: Array<string | number>;
  listSql: string;
  countSql: string;
  listParams: Array<string | number>;
  countParams: Array<string | number>;
  cacheKey: string;
};

type SqlChunk = { sql: string; params: Array<string | number> };

export function isNonPaperRecord(input: { subject?: string | null; title?: string | null }): boolean {
  return NON_PAPER.test(`${input.subject ?? ""} ${input.title ?? ""}`);
}

export function isCatalogPaper(input: {
  subject: string | null;
  title?: string | null;
  grade: number | null;
  year: number | null;
  paperStorageKey: string | null;
}): boolean {
  if (!input.paperStorageKey || input.grade === null || input.year === null) return false;
  const subject = input.subject?.trim() ?? "";
  if (!subject || subject.toLowerCase() === "unknown") return false;
  return !isNonPaperRecord({ subject, title: input.title });
}

export function normalizeSubjectName(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  const canonical = CANONICAL_SUBJECTS[cleaned.toLowerCase()];
  if (canonical) return canonical;
  return cleaned
    .replace(/\bIsizulu\b/g, "IsiZulu")
    .replace(/\bIsixhosa\b/g, "IsiXhosa")
    .replace(/\bIsindebele\b/g, "IsiNdebele");
}

export function subjectMatchValues(input: string): string[] {
  const trimmed = input.trim().replace(/\s+/g, " ");
  const display = normalizeSubjectName(trimmed);
  const values = new Set<string>([trimmed, display]);
  const stored = trimmed
    .replace(/\bIsiZulu\b/g, "Isizulu")
    .replace(/\bIsiXhosa\b/g, "Isixhosa")
    .replace(/\bIsiNdebele\b/g, "Isindebele")
    .replace(/\bEngineering Graphics and Design\b/g, "Engineering Graphic And Design")
    .replace(/\bSouth African Sign Language\b/g, "South African Sign Language (final)");
  values.add(stored);
  if (display === "Engineering Graphics and Design") {
    values.add("Engineering Graphic And Design");
  }
  if (display === "South African Sign Language") {
    values.add("South African Sign Language (final)");
  }
  return [...values].filter((value) => value.length > 0);
}

export function subjectSortRank(subject: string): number {
  const key = normalizeSubjectName(subject).toLowerCase();
  const index = CORE_SUBJECTS.indexOf(key as (typeof CORE_SUBJECTS)[number]);
  return index === -1 ? CORE_SUBJECTS.length + 50 : index;
}

export function coreSubjectRankSql(): string {
  const arms = CORE_SUBJECTS.map((name, index) => `WHEN '${name}' THEN ${index}`).join(" ");
  return `CASE lower(subject) ${arms} ELSE ${CORE_SUBJECTS.length + 50} END`;
}

export function languageLabel(language: string | null | undefined): string {
  const value = (language ?? "").trim().toLowerCase();
  if (value === "en" || value === "english" || value === "eng") return "English";
  if (value === "af" || value === "afrikaans" || value === "afr") return "Afrikaans";
  if (!value || value === "other") return "Other";
  return (language ?? "").trim();
}

export function languageCodesForFilter(input: string | undefined): string[] | null {
  if (!input?.trim()) return null;
  const value = input.trim().toLowerCase();
  if (value === "en" || value === "english" || value === "eng") return ["en", "english"];
  if (value === "af" || value === "afrikaans" || value === "afr") return ["af", "afrikaans"];
  if (value === "other") return ["other"];
  return [input.trim().toLowerCase()];
}

export function sessionLabel(session: string | null | undefined): string {
  const value = (session ?? "").trim().toLowerCase();
  if (value === "nov" || value === "november") return "November";
  if (value === "may/june" || value === "june" || value === "may") return "May/June";
  if (value === "march") return "March";
  if (value === "september" || value === "trial" || value === "prelim") return "September";
  if (!value || value === "other" || value === "supplementary" || value === "supp") return "Other";
  return (session ?? "").trim();
}

const SESSION_FILTER_VALUES: Record<string, string[]> = {
  November: ["Nov", "November", "nov", "november"],
  "May/June": ["May/June", "June", "May", "may/june", "june", "may"],
  March: ["March", "march"],
  September: ["September", "Trial", "Prelim", "september", "trial", "prelim"],
  Other: ["Other", "Supplementary", "Supp", "other", "supplementary", "supp"],
};

export function sessionCodesForFilter(input: string | undefined): string[] | null {
  if (!input?.trim()) return null;
  const label = sessionLabel(input);
  const known = SESSION_FILTER_VALUES[label];
  if (!known) return [input.trim()];
  return [...new Set([...known, input.trim()])];
}

/** Memo file is present and its path year matches the paper year when one is embedded. */
export function linkedMemoSql(): string {
  return [
    "memoStorageKey IS NOT NULL",
    "lower(memoStorageKey) NOT LIKE '%year-unknown%'",
    "lower(memoStorageKey) NOT LIKE '%year_unknown%'",
    "(lower(memoStorageKey) NOT GLOB '*/20[0-9][0-9]/*' OR CAST(substr(lower(memoStorageKey), instr(lower(memoStorageKey), '/20') + 1, 4) AS INTEGER) = year)",
  ].join(" AND ");
}

export function formatGradeLabel(grade: number | null): string {
  if (grade === null) return "Grade";
  if (grade === 0) return "Grade R";
  return `Grade ${grade}`;
}

export function parseGradeQuery(raw: string | undefined): { grade?: number; allGrades?: boolean } {
  if (!raw) return {};
  if (raw.trim().toLowerCase() === "all") return { allGrades: true };
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return {};
  return { grade: parsed };
}

export function resolveCatalogGradeScope(input: {
  grade?: number;
  allGrades?: boolean;
  userGrade?: number | null;
}): CatalogGradeScope {
  if (input.allGrades) return { kind: "all" };
  if (typeof input.grade === "number" && Number.isInteger(input.grade)) {
    return { kind: "one", grade: input.grade };
  }
  if (typeof input.userGrade === "number" && input.userGrade >= 10 && input.userGrade <= 12) {
    return { kind: "one", grade: input.userGrade };
  }
  return { kind: "fet" };
}

export function memoStatus(
  memoStorageKey: string | null | undefined,
  year: number | null | undefined
): MemoStatus {
  if (!memoStorageKey || !memoStorageKey.trim()) return "missing";
  const key = memoStorageKey.toLowerCase();
  if (key.includes("year-unknown") || key.includes("year_unknown")) return "unlinked";
  const yearInKey = key.match(/\/(20\d{2})\//);
  if (typeof year === "number" && yearInKey && Number(yearInKey[1]) !== year) return "unlinked";
  return "available";
}

export function memoStatusLabel(status: MemoStatus): string {
  if (status === "available") return "Memo ready";
  if (status === "unlinked") return "Memo unlinked";
  return "No memo";
}

function titleCaseProvince(province: string): string {
  return province
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatPaperTitle(input: {
  subject: string;
  paperNumber: string;
  title?: string | null;
  province?: string | null;
}): string {
  const subject = normalizeSubjectName(input.subject);
  const parts = [subject, `Paper ${input.paperNumber}`];
  const rawTitle = input.title ?? "";
  const level = rawTitle.match(/\b(HL|FAL|SAL)\b/i)?.[1]?.toUpperCase();
  if (level && !subject.toUpperCase().includes(level)) parts.push(level);
  const namedProvince = PROVINCE_IN_TITLE.find((name) => rawTitle.toLowerCase().includes(name.toLowerCase()));
  if (namedProvince) {
    parts.push(namedProvince === "KwaZulu Natal" ? "KwaZulu-Natal" : namedProvince);
  } else if (input.province && input.province.toLowerCase() !== "national") {
    parts.push(titleCaseProvince(input.province));
  }
  return parts.join(" · ");
}

export function practiceHref(input: {
  id: string;
  subject: string;
  grade: number | null;
  year: number | null;
  session: string;
}): string {
  const subject = normalizeSubjectName(input.subject);
  const grade = input.grade === null ? "" : String(input.grade);
  const params = new URLSearchParams({
    mode: "hints",
    pastPaperId: input.id,
    subject,
    grade,
    q: `${subject} ${formatGradeLabel(input.grade)} ${input.year ?? ""} ${input.session}`.replace(/\s+/g, " ").trim(),
  });
  return `/tutor?${params.toString()}`;
}

function catalogExclusionSql(): SqlChunk {
  return {
    sql: [
      "paperStorageKey IS NOT NULL",
      "grade IS NOT NULL",
      "year IS NOT NULL",
      "subject != 'Unknown'",
      "lower(subject) NOT LIKE '%timetable%'",
      "lower(title) NOT LIKE '%timetable%'",
      "lower(subject) NOT LIKE '%time table%'",
      "lower(title) NOT LIKE '%time table%'",
      "lower(subject) NOT LIKE '%circular%'",
      "lower(title) NOT LIKE '%circular%'",
      "lower(subject) NOT LIKE '%errata%'",
      "lower(title) NOT LIKE '%errata%'",
      "lower(subject) NOT LIKE '%related document%'",
      "lower(title) NOT LIKE '%related document%'",
      "lower(title) NOT LIKE '%resume%'",
      "lower(title) NOT LIKE '%résumé%'",
      "lower(title) NOT LIKE '%report 550%'",
      "lower(subject) NOT LIKE '%examination guideline%'",
      "lower(title) NOT LIKE '%examination guideline%'",
    ].join(" AND "),
    params: [],
  };
}

function inList(column: string, values: Array<string | number>): SqlChunk {
  return {
    sql: `${column} IN (${values.map(() => "?").join(", ")})`,
    params: values,
  };
}

function gradeSql(scope: CatalogGradeScope): SqlChunk {
  if (scope.kind === "all") return { sql: "", params: [] };
  if (scope.kind === "one") return { sql: "grade = ?", params: [scope.grade] };
  return inList("grade", [...FET_GRADES]);
}

function textSearchSql(q: string | undefined): SqlChunk {
  const term = q?.trim() ?? "";
  if (!term) return { sql: "", params: [] };
  const chunks: SqlChunk[] = [];
  const year = term.match(/\b(20\d{2})\b/);
  if (year) chunks.push({ sql: "year = ?", params: [Number(year[1])] });
  const paper = term.match(/\b(?:paper|p)\s*0*([1-9])\b/i);
  if (paper) chunks.push({ sql: "paperNumber = ?", params: [paper[1]] });

  const languageWord = term.match(/\b(en|af|english|afrikaans)\b/i)?.[1];
  if (languageWord && /^(en|af|english|afrikaans)$/i.test(languageWord)) {
    const codes = languageCodesForFilter(languageWord) ?? [];
    chunks.push({ sql: `lower(language) IN (${codes.map(() => "?").join(", ")})`, params: codes });
  }

  const residual = term
    .replace(/\b20\d{2}\b/g, " ")
    .replace(/\b(?:paper|p)\s*0*[1-9]\b/gi, " ")
    .replace(/\b(en|af|english|afrikaans)\b/gi, " ")
    .trim();
  const words = residual.split(/\s+/).filter((word) => word.length > 1);
  for (const word of words) {
    const like = `%${word.replace(/[%_]/g, "")}%`;
    chunks.push({
      sql: "(subject LIKE ? OR title LIKE ? OR session LIKE ?)",
      params: [like, like, like],
    });
  }

  if (chunks.length === 0) {
    const like = `%${term.replace(/[%_]/g, "")}%`;
    chunks.push({
      sql: "(subject LIKE ? OR title LIKE ? OR CAST(year AS TEXT) LIKE ? OR paperNumber LIKE ?)",
      params: [like, like, like, like],
    });
  }
  return andChunks(chunks);
}

function andChunks(chunks: SqlChunk[]): SqlChunk {
  const live = chunks.filter((chunk) => chunk.sql.length > 0);
  return {
    sql: live.map((chunk) => chunk.sql).join(" AND "),
    params: live.flatMap((chunk) => chunk.params),
  };
}

export function buildCatalogSearch(input: CatalogSearchInput): CatalogSearchPlan {
  const limit = Math.min(Math.max(input.limit ?? 24, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);
  const scope = resolveCatalogGradeScope(input);
  const languages = languageCodesForFilter(input.language);
  const sessions = sessionCodesForFilter(input.session);
  const subjects = input.subject?.trim() ? subjectMatchValues(input.subject) : null;

  const where = andChunks([
    catalogExclusionSql(),
    gradeSql(scope),
    subjects ? inList("subject", subjects) : { sql: "", params: [] },
    typeof input.year === "number" ? { sql: "year = ?", params: [input.year] } : { sql: "", params: [] },
    sessions ? inList("session", sessions) : { sql: "", params: [] },
    languages ? inList("lower(language)", languages) : { sql: "", params: [] },
    input.hasMemo ? { sql: linkedMemoSql(), params: [] } : { sql: "", params: [] },
    input.institutionType ? { sql: "institutionType = ?", params: [input.institutionType] } : { sql: "", params: [] },
    textSearchSql(input.q),
  ]);

  const order = `ORDER BY year DESC, ${coreSubjectRankSql()}, subject ASC, CAST(paperNumber AS INTEGER) ASC, language ASC`;
  const listSql = `SELECT id, title, subject, grade, year, session, paperNumber, language, memoStorageKey, institutionType, moduleCode, province FROM PastPaper WHERE ${where.sql} ${order} LIMIT ? OFFSET ?`;
  const countSql = `SELECT COUNT(*) AS n FROM PastPaper WHERE ${where.sql}`;
  return {
    whereSql: where.sql,
    whereParams: where.params,
    listSql,
    countSql,
    listParams: [...where.params, limit, offset],
    countParams: where.params,
    cacheKey: JSON.stringify({ where: where.sql, params: where.params, limit, offset }),
  };
}

export const CATALOG_INDEX_SQL = [
  `CREATE INDEX IF NOT EXISTS "PastPaper_catalog_ready_idx" ON "PastPaper" ("year" DESC, "subject", "paperNumber") WHERE "paperStorageKey" IS NOT NULL AND "grade" IS NOT NULL AND "year" IS NOT NULL AND "subject" != 'Unknown'`,
  `CREATE INDEX IF NOT EXISTS "PastPaper_catalog_grade_year_idx" ON "PastPaper" ("grade", "year" DESC, "subject") WHERE "paperStorageKey" IS NOT NULL AND "year" IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS "PastPaper_catalog_subject_idx" ON "PastPaper" ("subject")`,
  `CREATE INDEX IF NOT EXISTS "PastPaper_catalog_language_idx" ON "PastPaper" ("language")`,
  `CREATE INDEX IF NOT EXISTS "PastPaper_catalog_session_idx" ON "PastPaper" ("session")`,
  `CREATE INDEX IF NOT EXISTS "PastPaper_catalog_memo_idx" ON "PastPaper" ("memoStorageKey")`,
] as const;

export const CATALOG_INDEX_NAMES = [
  "PastPaper_catalog_ready_idx",
  "PastPaper_catalog_grade_year_idx",
  "PastPaper_catalog_subject_idx",
  "PastPaper_catalog_language_idx",
  "PastPaper_catalog_session_idx",
  "PastPaper_catalog_memo_idx",
] as const;
