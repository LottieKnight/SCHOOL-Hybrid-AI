import { DatabaseSync } from "node:sqlite";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const DB_PATH = process.env.PAST_PAPERS_DATABASE_URL || path.join(process.cwd(), "prisma", "past-papers.db");
const OUT_DIR = path.join(process.cwd(), "prisma", "d1");
const OUT_FILE = path.join(OUT_DIR, "past-papers.sql");

const db = new DatabaseSync(DB_PATH, { readOnly: true });
mkdirSync(OUT_DIR, { recursive: true });

const lines = [];
lines.push("-- Generated from past-papers.db for Cloudflare D1 import");
lines.push("PRAGMA foreign_keys = OFF;");

const known = [
  "PastPaperSource",
  "PastPaper",
  "PastPaperQuestion",
  "PastPaperAttempt",
  "PastPaperAnswer",
  "PastPaperBookmark",
];
const tables = known.filter((name) =>
  db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?").get(name)
);

for (const table of tables) {
  const cols = db.prepare(`PRAGMA table_info(${JSON.stringify(table)})`).all();
  const columnNames = cols.map((c) => c.name);
  const ddl = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name = ?`).get(table).sql;
  lines.push(ddl + ";");

  const rows = db.prepare(`SELECT * FROM ${JSON.stringify(table)}`).all();
  for (const row of rows) {
    const values = columnNames.map(
      (col) => {
        const v = row[col];
        if (v === null || v === undefined) return "NULL";
        if (typeof v === "number") return String(v);
        return JSON.stringify(String(v));
      }
    );
    lines.push(
      `INSERT INTO ${JSON.stringify(table)} (${columnNames.map((c) => JSON.stringify(c)).join(", ")}) VALUES (${values.join(", ")});`
    );
  }
}

// Carry secondary indexes across to D1. Without these every WHERE/ORDER BY
// query full-scans PastPaper, which blew the D1 free-tier row-read allowance.
const indexRows = db
  .prepare("SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL")
  .all();
for (const { sql } of indexRows) {
  lines.push(
    sql.replace(
      /^CREATE\s+(UNIQUE\s+)?INDEX\s+/i,
      (_match, unique) => `CREATE ${unique ?? ""}INDEX IF NOT EXISTS `
    ) + ";"
  );
}

lines.push("-- Done.");
writeFileSync(OUT_FILE, lines.join("\n") + "\n");
console.log(`Wrote ${OUT_FILE} (${tables.join(", ")})`);

const counts = await Promise.all(
  tables.map((t) => ({ table: t, rows: db.prepare(`SELECT COUNT(*) n FROM ${JSON.stringify(t)}`).get().n }))
);
console.log(counts.map((c) => `${c.table}=${c.rows}`).join(" "));

db.close();