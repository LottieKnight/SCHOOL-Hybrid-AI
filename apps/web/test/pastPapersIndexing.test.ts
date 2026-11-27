import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import { copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  CATALOG_INDEX_NAMES,
  buildCatalogSearch,
  linkedMemoSql,
  formatPaperTitle,
  isCatalogPaper,
  isNonPaperRecord,
  languageCodesForFilter,
  languageLabel,
  memoStatus,
  normalizeSubjectName,
  parseGradeQuery,
  practiceHref,
  resolveCatalogGradeScope,
  sessionCodesForFilter,
  sessionLabel,
  subjectMatchValues,
  subjectSortRank,
} from "../lib/pastPapers/indexing";

vi.mock("server-only", () => ({}));

const REPO_DB = path.join(__dirname, "..", "prisma", "past-papers.db");
const TMP_DB = path.join(tmpdir(), `past-papers-index-${process.pid}.db`);

describe("past paper catalogue indexing", () => {
  it("drops timetables, circulars, and related documents", () => {
    expect(isNonPaperRecord({ subject: "Nsc/sc Exam Timetable", title: "2025 November NSC/SC Exam Timetable" })).toBe(true);
    expect(isNonPaperRecord({ subject: "Related Documents", title: "2023 June SC/NSC Exams Timetable" })).toBe(true);
    expect(isNonPaperRecord({ subject: "Related Documents", title: "Circular E32 of 2017" })).toBe(true);
    expect(isNonPaperRecord({ subject: "Mathematics", title: "Mathematics P1" })).toBe(false);
    expect(
      isCatalogPaper({
        subject: "Nsc/sc Exam Timetable",
        title: "2025 November NSC/SC Exam Timetable",
        grade: 12,
        year: 2025,
        paperStorageKey: "dbe/timetable.pdf",
      })
    ).toBe(false);
  });

  it("normalises subject names and matches stored spellings", () => {
    expect(normalizeSubjectName("Engineering Graphic And Design")).toBe("Engineering Graphics and Design");
    expect(normalizeSubjectName("Isizulu HL")).toBe("IsiZulu HL");
    expect(normalizeSubjectName("Isixhosa")).toBe("IsiXhosa");
    expect(normalizeSubjectName("Isindebele FAL")).toBe("IsiNdebele FAL");
    expect(normalizeSubjectName("South African Sign Language (final)")).toBe("South African Sign Language");
    expect(subjectMatchValues("Engineering Graphics and Design")).toContain("Engineering Graphic And Design");
    expect(subjectMatchValues("IsiZulu HL")).toContain("Isizulu HL");
  });

  it("labels language codes and accepts either code or name", () => {
    expect(languageLabel("en")).toBe("English");
    expect(languageLabel("af")).toBe("Afrikaans");
    expect(languageCodesForFilter("English")).toEqual(["en", "english"]);
    expect(languageCodesForFilter("af")).toEqual(["af", "afrikaans"]);
  });

  it("labels sessions and maps the old pill names", () => {
    expect(sessionLabel("Nov")).toBe("November");
    expect(sessionLabel("May/June")).toBe("May/June");
    expect(sessionLabel("Prelim")).toBe("September");
    expect(sessionLabel("supp")).toBe("Other");
    expect(sessionCodesForFilter("November")).toEqual(expect.arrayContaining(["Nov", "November"]));
    expect(sessionCodesForFilter("June")).toContain("May/June");
    expect(sessionCodesForFilter("September")).toEqual(expect.arrayContaining(["Trial", "Prelim", "prelim"]));
    expect(sessionCodesForFilter("Other")).toEqual(expect.arrayContaining(["Supplementary", "supp"]));
  });

  it("defaults to Grades 10–12, then the learner grade, then an explicit grade", () => {
    expect(resolveCatalogGradeScope({})).toEqual({ kind: "fet" });
    expect(resolveCatalogGradeScope({ userGrade: 11 })).toEqual({ kind: "one", grade: 11 });
    expect(resolveCatalogGradeScope({ grade: 12, userGrade: 11 })).toEqual({ kind: "one", grade: 12 });
    expect(resolveCatalogGradeScope({ allGrades: true, userGrade: 11 })).toEqual({ kind: "all" });
    expect(resolveCatalogGradeScope({ userGrade: 7 })).toEqual({ kind: "fet" });
    expect(parseGradeQuery("all")).toEqual({ allGrades: true });
    expect(parseGradeQuery("10")).toEqual({ grade: 10 });
  });

  it("sorts core subjects ahead of the long tail", () => {
    expect(subjectSortRank("Mathematics")).toBeLessThan(subjectSortRank("Tourism"));
    expect(subjectSortRank("Mathematical Literacy")).toBeLessThan(subjectSortRank("Dance Studies"));
    expect(subjectSortRank("IsiZulu")).toBeGreaterThan(subjectSortRank("History"));
  });

  it("builds a paper title and pairs a memo only when the file matches", () => {
    expect(
      formatPaperTitle({
        subject: "Mathematics",
        paperNumber: "1",
        title: "Memo 1 (English)",
        province: "national",
      })
    ).toBe("Mathematics · Paper 1");
    expect(
      formatPaperTitle({
        subject: "Afrikaans",
        paperNumber: "2",
        title: "Afrikaans SAL P2 memo (Gauteng)",
        province: "gauteng",
      })
    ).toBe("Afrikaans · Paper 2 · SAL · Gauteng");
    expect(memoStatus(null, 2024)).toBe("missing");
    expect(memoStatus("dbe/national/grade-12/math/2024/nov/memo-1.pdf", 2024)).toBe("available");
    expect(memoStatus("dbe/national/grade-12/math/year-unknown/nov/memo-1.pdf", 2024)).toBe("unlinked");
    expect(memoStatus("dbe/national/grade-12/math/2020/nov/memo-1.pdf", 2024)).toBe("unlinked");
  });

  it("points practice at the tutor with the paper context", () => {
    const href = practiceHref({
      id: "paper-1",
      subject: "Isizulu",
      grade: 12,
      year: 2024,
      session: "November",
    });
    expect(href.startsWith("/tutor?")).toBe(true);
    expect(href).toContain("pastPaperId=paper-1");
    expect(href).toContain("mode=hints");
    expect(decodeURIComponent(href)).toContain("IsiZulu");
  });

  it("builds a catalogue query that excludes non-papers and sorts by year", () => {
    const plan = buildCatalogSearch({ q: "paper 2 2023", language: "English" });
    expect(plan.whereSql).toContain("NOT LIKE '%timetable%'");
    expect(plan.whereSql).toContain("grade IN (?, ?, ?)");
    expect(plan.whereParams.slice(0, 3)).toEqual([10, 11, 12]);
    expect(plan.listSql).toContain("ORDER BY year DESC");
    expect(plan.listParams).toContain("2");
    expect(plan.listParams).toContain(2023);
    expect(plan.listParams).toContain("en");
    const scoped = buildCatalogSearch({ userGrade: 11, subject: "Engineering Graphics and Design", hasMemo: true });
    expect(scoped.whereSql).toContain("grade = ?");
    expect(scoped.whereParams).toContain(11);
    expect(scoped.whereParams).toContain("Engineering Graphic And Design");
    expect(scoped.whereSql).toContain(linkedMemoSql());
    expect(linkedMemoSql()).toContain("= year");
  });
});

describe("past paper catalogue against the database", () => {
  beforeAll(() => {
    copyFileSync(REPO_DB, TMP_DB);
    process.env.PAST_PAPERS_DATABASE_URL = TMP_DB;
  });

  afterAll(() => {
    try {
      rmSync(TMP_DB, { force: true });
    } catch {
      // Best effort cleanup.
    }
  });

  it("hides timetables, normalises the first page, and finds renamed subjects", async () => {
    const { searchPastPapers } = await import("../lib/pastPapers/catalog");
    const { ensurePastPaperIndexes } = await import("../lib/pastPapers/db");
    await ensurePastPaperIndexes();

    const truth = new DatabaseSync(TMP_DB, { readOnly: true });
    const names = truth
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'PastPaper_catalog_%'`)
      .all() as Array<{ name: string }>;
    expect(names.map((row) => row.name).sort()).toEqual([...CATALOG_INDEX_NAMES].sort());

    const page = await searchPastPapers({ limit: 8, offset: 0 });
    expect(page.total).toBeGreaterThan(100);
    expect(page.items.some((item) => /timetable/i.test(item.rawTitle) || /timetable/i.test(item.subject))).toBe(false);
    expect(page.items[0]?.year).toBe(2024);
    expect(page.items[0]?.subject).toBe("Mathematics");
    expect(page.items[0]?.title.startsWith("Mathematics · Paper")).toBe(true);
    expect(page.items[0]?.language === "English" || page.items[0]?.language === "Afrikaans").toBe(true);
    expect(page.items.every((item) => item.grade !== null && item.grade >= 10 && item.grade <= 12)).toBe(true);

    const english = await searchPastPapers({ language: "English", limit: 5 });
    expect(english.total).toBeGreaterThan(0);
    expect(english.items.every((item) => item.language === "English")).toBe(true);

    const graphics = await searchPastPapers({ subject: "Engineering Graphics and Design", allGrades: true, limit: 5 });
    expect(graphics.total).toBeGreaterThan(0);
    expect(graphics.items.every((item) => item.subject === "Engineering Graphics and Design")).toBe(true);

    const searched = await searchPastPapers({ q: "accounting paper 2", grade: 12, limit: 5 });
    expect(searched.items.length).toBeGreaterThan(0);
    expect(searched.items.every((item) => item.subject === "Accounting" && item.paperNumber === "2")).toBe(true);

    const grade11 = await searchPastPapers({ grade: 11, limit: 5 });
    expect(grade11.items.every((item) => item.grade === 11)).toBe(true);
  });
});
