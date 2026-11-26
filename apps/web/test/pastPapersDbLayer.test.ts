import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { db } from "@/lib/pastPapers/db";

vi.mock("server-only", () => ({}));

const REPO_DB = path.join(__dirname, "..", "prisma", "past-papers.db");
const TMP_DB = path.join(tmpdir(), `past-papers-layer-test-${process.pid}.db`);

let truth: DatabaseSync;

beforeAll(() => {
  copyFileSync(REPO_DB, TMP_DB);
  process.env.PAST_PAPERS_DATABASE_URL = TMP_DB;
  truth = new DatabaseSync(TMP_DB, { readOnly: true });
});

afterAll(() => {
  try {
    rmSync(TMP_DB, { force: true });
  } catch {
    // Best effort cleanup.
  }
});

function truthAll(sql: string, ...params: (string | number | null | boolean)[]) {
  return truth.prepare(sql).all(...params) as Array<Record<string, unknown>>;
}

describe("past-papers D1 access layer (node:sqlite driver)", () => {
  it("counts match raw SQLite", async () => {
    const total = truthAll("SELECT COUNT(*) AS n FROM PastPaper")[0].n as number;
    expect(await db.count("PastPaper")).toBe(total);
    expect(total).toBeGreaterThan(1000);
  });

  it("ui-ready count matches buildPastPaperWhere(false)", async () => {
    const expected = truthAll(
      `SELECT COUNT(*) AS n FROM PastPaper
       WHERE paperStorageKey IS NOT NULL
         AND grade IS NOT NULL
         AND year IS NOT NULL
         AND subject != 'Unknown'`
    )[0].n as number;
    const got = await db.count("PastPaper", {
      paperStorageKey: { not: null },
      grade: { not: null },
      year: { not: null },
      subject: { not: "Unknown" },
    });
    expect(got).toBe(expected);
  });

  it("distinct province buckets match and are sorted", async () => {
    const expected = (truthAll(
      "SELECT DISTINCT province FROM PastPaper WHERE paperStorageKey IS NOT NULL ORDER BY province ASC"
    ) as Array<{ province: string }>).map((r) => r.province);
    const got = (await db.findMany("PastPaper", {
      where: { paperStorageKey: { not: null } },
      distinct: ["province"],
      select: ["province"],
      orderBy: { province: "asc" },
    })) as Array<{ province: string }>;
    expect(got.map((r) => r.province)).toEqual(expected);
    expect(got.length).toBeGreaterThan(1);
  });

  it("filtered search matches raw LIKE + pagination", async () => {
    const term = "Mathematical";
    const expected = (truthAll(
      `SELECT COUNT(*) AS n FROM PastPaper
       WHERE paperStorageKey IS NOT NULL AND subject LIKE ?`,
      `%${term}%`
    )[0].n as number);
    const total = await db.count("PastPaper", {
      paperStorageKey: { not: null },
      subject: { contains: term },
    });
    expect(total).toBe(expected);

    const items = (await db.findMany("PastPaper", {
      where: { paperStorageKey: { not: null }, subject: { contains: term } },
      orderBy: [{ year: "desc" }],
      take: 5,
      skip: 0,
      select: ["id", "year", "subject"],
    })) as Array<{ id: string; year: number | null; subject: string }>;
    expect(items.length).toBe(5);
    expect(
      (items[0] as { year: number | null }).year! >= (items[4] as { year: number | null }).year!
    ).toBe(true);
  });

  it("single relation include joins source", async () => {
    const id = truthAll("SELECT id FROM PastPaper WHERE sourceId IS NOT NULL LIMIT 1")[0].id as string;
    const row = await db.findFirst("PastPaper", {
      where: { id },
      include: [
        { as: "source", table: "PastPaperSource", localKey: "sourceId", foreignKey: "id", kind: "one" },
      ],
    });
    expect(row).not.toBeNull();
    const expectedName = truthAll(
      "SELECT s.name FROM PastPaper p JOIN PastPaperSource s ON s.id = p.sourceId WHERE p.id = ?",
      id
    )[0].name;
    expect((row as { source: { name: string } }).source.name).toBe(expectedName);
  });

  it("hydrates DateTime columns to Date instances", async () => {
    const id = truthAll(
      "SELECT id FROM PastPaper WHERE createdAt IS NOT NULL LIMIT 1"
    )[0].id as string;
    const row = await db.findFirst("PastPaper", { where: { id } });
    expect(row).not.toBeNull();
    expect((row as { createdAt: Date }).createdAt).toBeInstanceOf(Date);
    expect(Number.isNaN((row as { createdAt: Date }).createdAt.getTime())).toBe(false);
  });

  it("attempt lifecycle round-trips through create/update/findMany", async () => {
    const paperId = truthAll("SELECT id FROM PastPaper LIMIT 1")[0].id as string;
    const question = await db.create("PastPaperQuestion", {
      pastPaperId: paperId,
      qNumber: "Q1",
      label: "Unit test question",
      maxMarks: 5,
      orderIndex: 1,
    });
    const questionId = question.id as string;

    const created = await db.create("PastPaperAttempt", {
      userId: "test-user",
      pastPaperId: paperId,
    });
    expect(created.status).toBe("in_progress");
    expect(created.createdAt).toBeInstanceOf(Date);

    await db.create("PastPaperAnswer", {
      attemptId: created.id as string,
      questionId,
      answerText: "hello",
      maxMarks: 5,
    });
    await db.update("PastPaperAttempt", { id: created.id as string }, { status: "marked" });

    const after = (await db.findFirst("PastPaperAttempt", {
      where: { id: created.id as string },
    })) as { status: string; updatedAt: unknown; answers: unknown };
    expect(after.status).toBe("marked");
    expect(after.updatedAt).toBeInstanceOf(Date);

    const withAnswers = (await db.findFirst("PastPaperAttempt", {
      where: { id: created.id as string },
      include: [
        { as: "answers", table: "PastPaperAnswer", localKey: "id", foreignKey: "attemptId", kind: "many" },
      ],
    })) as { answers: Array<{ answerText: string }> };
    expect(withAnswers.answers).toHaveLength(1);
    expect(withAnswers.answers[0].answerText).toBe("hello");

    await db.update("PastPaperAnswer", { questionId }, { reviewerScore: 4 });
    const upserted = await db.findFirst("PastPaperAnswer", {
      where: { attemptId: (created.id as string), questionId },
    });
    expect((upserted as { reviewerScore: number }).reviewerScore).toBe(4);
  });

  it("bookmark create/find/delete round-trip", async () => {
    const paperId = truthAll("SELECT id FROM PastPaper LIMIT 1")[0].id as string;
    const where = { userId: "bookmark-test", pastPaperId: paperId };
    expect(await db.findFirst("PastPaperBookmark", { where })).toBeNull();
    await db.create("PastPaperBookmark", where);
    expect(await db.findFirst("PastPaperBookmark", { where, select: ["id"] })).not.toBeNull();
    await db.delete("PastPaperBookmark", where);
    expect(await db.findFirst("PastPaperBookmark", { where })).toBeNull();
  });

  it("raw SQL execute reports changed rows", async () => {
    await db.run(
      `CREATE TABLE IF NOT EXISTS past_paper_ingest_locks (
        lock_name TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        acquired_at BIGINT NOT NULL,
        expires_at BIGINT NOT NULL
      )`
    );
    const changed = await db.run(
      `INSERT INTO past_paper_ingest_locks (lock_name, owner_id, acquired_at, expires_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(lock_name) DO UPDATE SET expires_at = excluded.expires_at`,
      ["unit-test-lock", "unit", Date.now(), Date.now() + 5000]
    );
    expect(changed).toBe(1);
  });
});