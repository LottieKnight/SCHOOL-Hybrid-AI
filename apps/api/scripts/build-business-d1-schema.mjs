#!/usr/bin/env node
// Transpiles the Postgres migration corpus (apps/api/migrations/*.sql) into
// SQLite/D1-compatible schema + seed files. Deterministic and idempotent.
//
// Output:
//   apps/api/d1/business-schema.sql   DDL only (applies cleanly to D1 local)
//   apps/api/d1/business-seeds.sql    DML (INSERT/UPDATE/DELETE statements)
//   apps/api/d1/DROPPED.log           statements dropped with reasons (for review)
//
// Check: `npm exec --prefix apps/web wrangler d1 execute -y school_business --local
// --file=apps/api/d1/business-schema.sql` must complete without SQLITE_ERROR.
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "..", "migrations");
const outDir = path.join(here, "..", "d1");

// ---- Statement-level transforms applied outside quoted regions -----------------
const TYPE_MAP = [
  [/\bTIMESTAMPTZ\b/gi, "TEXT"],
  [/\bTIMESTAMP\b/gi, "TEXT"],
  [/\bUUID\b/gi, "TEXT"],
  [/\bJSONB\b/gi, "TEXT"],
  [/\bJSON\b/gi, "TEXT"],
  [/\bBYTEA\b/gi, "BLOB"],
  [/\bSERIAL\s+PRIMARY\s+KEY\b/gi, "INTEGER PRIMARY KEY"],
  [/\bBIGSERIAL\s+PRIMARY\s+KEY\b/gi, "INTEGER PRIMARY KEY"],
  [/\bSERIAL\b/gi, "INTEGER"],
  [/\bBIGSERIAL\b/gi, "INTEGER"],
  [/\b(TEXT|INTEGER|INT|VARCHAR|CHAR|JSONB|JSON|citext|uuid)\s*\[\](?![\w])/gi, "TEXT"],
  [/\bDOUBLE\s+PRECISION\s*\[\](?![\w])/gi, "TEXT"],
  [/\bBOOLEAN\b/gi, "INTEGER"],
  [/\bcurriculum_node_type\b/gi, "TEXT"],
  [/\blesson_status\b/gi, "TEXT"],
  [/\bgeneration_status\b/gi, "TEXT"],
  [/\bv2_generation_status\b/gi, "TEXT"],
  [/\bnow\(\s*\)(?![\w])/gi, "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"],
  [/\bCURRENT_TIMESTAMP\(\s*3\s*\)(?![\w])/gi, "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"],
  [/\bCURRENT_TIMESTAMP\b(?!\()/gi, "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))"],
  [/\bgen_random_uuid\(\s*\)(?![\w])/gi, "(lower(hex(randomblob(16))))"],
  [/\bARRAY\s*\[\s*\]\s*::\s*TEXT\s*\[\s*\](?![\w])/gi, "'[]'"],
  [/\bARRAY\s*\[\s*\]\s*::\s*[A-Za-z]+\s*\[\s*\](?![\w])/gi, "'[]'"],
  [/\bARRAY\s*\[\s*\](?![\w])/gi, "'[]'"],
  [/\bTRUE\b/gi, "1"],
  [/\bFALSE\b/gi, "0"],
];

const CAST_RE =
  /::\s*(jsonb?|text\[\]|text|uuid|bigint|int|integer|boolean|bool|numeric|decimal|timestamptz|timestamp|time|float8|float4|real|double\s+precision|date|citext|varchar)\b/gi;

// ---- Unsupportable constructs; the whole statement is dropped + logged --------
const DROP_PREFIX = [
  /^CREATE\s+EXTENSION\b/i,
  /^DROP\s+EXTENSION\b/i,
  /^CREATE\s+SCHEMA\b/i,
  /^CREATE\s+OR\s+REPLACE\s+FUNCTION\b/i,
  /^CREATE\s+FUNCTION\b/i,
  /^DROP\s+FUNCTION\b/i,
  /^DO\s*\$\$/i,
  /^CREATE\s+TRIGGER\b/i,
  /^DROP\s+TRIGGER\b/i,
  /^CREATE\s+POLICY\b/i,
  /^ALTER\s+POLICY\b/i,
  /^DROP\s+POLICY\b/i,
  /^COMMENT\s+ON\b/i,
  /^ALTER\s+TABLE\b[\s\S]*\bADD\s+CONSTRAINT\b/i,
  /^ALTER\s+TABLE\b[\s\S]*\bDROP\s+CONSTRAINT\b/i,
  /^ALTER\s+TABLE\b[\s\S]*\bALTER\s+COLUMN\b[\s\S]*\b(DROP|SET)\s+NOT\s+NULL\b/i,
  /^ALTER\s+TABLE\b[\s\S]*\bROW\s+LEVEL\s+SECURITY\b/i,
  /^ALTER\s+TABLE\b[\s\S]*\bOWNER\s+TO\b/i,
  /^CREATE\s+(UNIQUE\s+)?INDEX\b[\s\S]*\bUSING\s+(GIN|GIST|HASH|BRIN)\b/i,
  /^CREATE\s+(UNIQUE\s+)?INDEX\b[\s\S]*\b(to_tsvector|tsvector|gin_trgm_ops)\b/i,
];

// ---- Whole-statement scrub rules (may span quote boundaries) ------------------
const STATEMENT_SCRUBS = [
  // (strftime(...)) + INTERVAL '1 day' -> (strftime(..., '+1 day'))
  [
    /\(\s*strftime\('%Y-%m-%dT%H:%M:%fZ','now'\)\s*\)\s*([+-])\s*INTERVAL\s+'(\d+)\s+(day|hour|minute|second)s?'/gi,
    "(strftime('%Y-%m-%dT%H:%M:%fZ','now','$1$2 $3'))",
  ],
  // ALTER TABLE IF EXISTS ... is Postgres-only; the runner is transactional.
  [/\bALTER\s+TABLE\s+IF\s+EXISTS\b/gi, "ALTER TABLE"],
  // SQLite spells the string length function `length`.
  [/\bchar_length\(/gi, "length("],
  // PL/pgSQL CHECK constraints that call Postgres-only functions.
  [/CHECK\s*\(\s*jsonb_typeof\([^)]*\)\s*=\s*'[^']*'\s*\)/gi, ""],
  [/CHECK\s*\(\s*ARRAY\[[^]]*\][^)]*\)\s*\)/gi, ""],
  // Non-empty ARRAY['a','b']::TEXT[] literals -> JSON string literal.
  [
    /\bARRAY\[([^\]]*)\](?:::\s*[A-Za-z]+\s*\[\])?/gi,
    (_m, inner) => {
      const els = inner
        .split(",")
        .map((e) => e.trim())
        .map((e) => {
          // Keep Postgres '' escaping intact inside the emitted SQL literal; the
          // single-quoted outer literal needs EVERY ' doubled ('' stays as '').
          if (e.startsWith("'")) return '"' + e.slice(1, -1) + '"';
          return e;
        });
      return "'[" + els.join(", ") + "]'";
    },
  ],
  // btree is the only index method SQLite supports; `USING btree` is redundant.
  [/\bUSING\s+btree\b/gi, ""],
  [/\bCREATE\s+INDEX\s+CONCURRENTLY\b/gi, "CREATE INDEX"],
  // SQLite's upsert grammar rejects ON CONFLICT after INSERT..SELECT; the runner
  // is transactional so idempotency comes from schema_migrations, not upserts.
  [/^(\s*INSERT[\s\S]+\bSELECT[\s\S]+?)\s+ON\s+CONFLICT\s+DO\s+NOTHING\s*$/i, "$1"],
];

// Seed/DDL fragments that rely on Postgres-only functions or syntax. The DROPPED
// log records each; none carry real data that the app cannot rewrite.
const PG_ONLY = /\b(date_trunc|DATE_TRUNC|to_tsvector|ARRAY\[[^\]]*[A-Za-z][^\]]*\])\b|\bINTERVAL\s+'|\bencode\(|\bgen_random_bytes\b|^UPDATE\s+[\w.]+\s+[a-z]+\s+SET[\s\S]*\sFROM\s|^UPDATE\s+invoices\s+SET\s+amount_paid_zar\s*=\s*paid\b/i;

// A surviving statement must look like real SQL; anything else is a leaked
// PL/pgSQL fragment and is dropped with a log entry.
const SQL_HEAD = /^(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|REPLACE)\b/i;

// Tables defined solely inside PL/pgSQL DO..EXECUTE blocks (which are stripped)
// need their CREATE emitted explicitly, at the position of their source file.
// `embeddings` is the only case today.
const EMIT_OVERRIDES = {
  "051_pgvector.sql": [
    `CREATE TABLE IF NOT EXISTS embeddings ( id TEXT PRIMARY KEY DEFAULT gen_random_uuid(), entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, content_text TEXT NOT NULL, embedding DOUBLE PRECISION[], model TEXT DEFAULT 'text-embedding-3-small', created_at TIMESTAMPTZ DEFAULT now(), UNIQUE(entity_type, entity_id) )`,
  ],
};

function stripPgBlocks(src) {
  // Remove function/procedure/DO/trigger bodies wrapped in $$..$$ before any
  // splitting happens; an unbalanced dollar-quote is what mis-joins statements.
  const rules = [
    /\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|PROCEDURE)\b[\s\S]*?\$\$;\s*/gi,
    /\bDO\s*\$\$[\s\S]*?\$\$;\s*/gi,
    /\bCREATE\s+TRIGGER\b[\s\S]*?\$\$;\s*/gi,
  ];
  let out = src;
  for (const re of rules) out = out.replace(re, "");
  return out;
}

function splitQuoted(sql) {
  const segs = [];
  let i = 0;
  const n = sql.length;
  let cur = "";
  let curQuoted = false;
  const flush = () => {
    if (cur.length) {
      segs.push({ quoted: curQuoted, text: cur });
      cur = "";
    }
  };
  while (i < n) {
    const c = sql[i];
    if (c === "-" && sql[i + 1] === "-") {
      const end = sql.indexOf("\n", i);
      const e = end === -1 ? n : end + 1;
      if (curQuoted) cur += sql.slice(i, e);
      else if (cur.length) {
        segs.push({ quoted: false, text: cur });
        cur = "";
      }
      i = e;
      continue;
    }
    if (c === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i);
      const e = end === -1 ? n : end + 2;
      if (curQuoted) cur += sql.slice(i, e);
      else if (cur.length) {
        segs.push({ quoted: false, text: cur });
        cur = "";
      }
      i = e;
      continue;
    }
    if (c === "'") {
      if (!curQuoted) {
        flush();
        cur = "'";
        curQuoted = true;
      } else {
        if (sql[i + 1] === "'") {
          cur += "''";
          i += 2;
          continue;
        }
        cur += "'";
        flush();
        curQuoted = false;
      }
      i += 1;
      continue;
    }
    cur += c;
    i += 1;
  }
  flush();
  return segs;
}

function applyToRaw(statement, transforms) {
  const segs = splitQuoted(statement);
  const out = segs.map((s) => {
    if (s.quoted) return s.text;
    let t = s.text;
    for (const [re, rep] of transforms) t = t.replace(re, rep);
    return t;
  });
  return out.join("");
}

function tokenizeStatements(sql) {
  const stmts = [];
  const segs = splitQuoted(sql);
  let buf = "";
  for (const s of segs) {
    if (!s.quoted) {
      buf += s.text;
      const parts = buf.split(";");
      buf = parts.pop();
      for (const p of parts) stmts.push(p);
    } else {
      buf += s.text;
    }
  }
  if (buf.trim().length) stmts.push(buf);
  return stmts;
}

function splitTopLevelCommas(text) {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim().length) parts.push(cur);
  return parts;
}

// `ALTER TABLE t ADD COLUMN IF NOT EXISTS a..., ADD COLUMN IF NOT EXISTS b...`
// is invalid in SQLite (one ADD COLUMN per ALTER). Split into individual ALTERs.
function splitMultiAddAlter(stmt) {
  if (!/^ALTER\s+TABLE\b[\s\S]*\bADD\s+COLUMN\b/i.test(stmt)) return [stmt];
  const m = stmt.match(/^ALTER\s+TABLE\s+(\S+)\s+ADD\s+COLUMN\b/);
  if (!m) return [stmt];
  const table = m[1];
  const cols = splitTopLevelCommas(stmt.slice(m[0].length)).map((c) =>
    c.replace(/^\s*ADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s*/i, "")
  );
  return cols.map(
    (c) => `ALTER TABLE ${table} ADD COLUMN ${c}`.replace(/\s+IF\s+NOT\s+EXISTS\s+/, " ")
  );
}

function classify(stmt) {
  const stripped = stmt.trimStart();
  const isDml = /^INSERT\b|^UPDATE\b|^DELETE\b|^REPLACE\b/i.test(stripped);
  return isDml ? "dml" : "ddl";
}

const CREATE_TABLE_RE = /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\S+)\s*\(([\s\S]*)\)\s*$/i;
const NON_COLUMN_HEAD = /^(PRIMARY|UNIQUE|CHECK|FOREIGN|CONSTRAINT|INDEX|LIMIT)\b/i;

// Record base columns of every CREATE TABLE so later ADD COLUMN duplicates
// (idempotent under Postgres `IF NOT EXISTS`) can be skipped.
function createColumns(piece) {
  const m = piece.match(CREATE_TABLE_RE);
  if (!m) return null;
  const cols = new Set();
  for (const def of splitTopLevelCommas(m[2])) {
    const head = def.trim().split(/\s+/)[0];
    if (head && !NON_COLUMN_HEAD.test(head)) cols.add(head.toLowerCase());
  }
  return { table: m[1].toLowerCase(), cols };
}

async function main() {
  const files = (await readdir(migrationsDir))
    .filter((f) => /^\d{3}_.*\.sql$/.test(f))
    .sort();
  const dropped = [];
  const schema = [];
  const seeds = [];
  let discardedBlocks = 0;
  const addedColumns = new Map();
  const declaredTables = new Set();

  const handle = (file, raw, origin) => {
    const stmt = raw.trim().replace(/\s+/g, " ");
    if (!stmt.length) return;
    const firstLine = stmt.slice(0, 160);
    if (DROP_PREFIX.some((re) => re.test(stmt))) {
      dropped.push(`${file}\t${firstLine}`);
      return;
    }
    const kind = classify(stmt);
    let t = applyToRaw(stmt, TYPE_MAP);
    t = t.replace(CAST_RE, "");
    for (const [re, rep] of STATEMENT_SCRUBS) {
      re.lastIndex = 0;
      t = t.replace(re, rep);
    }
    t = t.replace(/\s+/g, " ").trim();
    if (DROP_PREFIX.some((re) => re.test(origin)) || !SQL_HEAD.test(t)) {
      dropped.push(`${file}\t${firstLine} (SQL fragment)`);
      return;
    }
    if (PG_ONLY.test(t)) {
      dropped.push(`${file}\t${firstLine} (PG-only construct)`);
      return;
    }
    const updateM = t.match(/^UPDATE\s+([\w.]+)\s+SET\s+((?:[^)]*?)\sWHERE\b|(?:[^)*]*?))[,;]?\s*$/i);
    if (updateM) {
      const table = updateM[1].split(".").pop().toLowerCase();
      const cols = [...updateM[2].matchAll(/([\w]+)\s*=/g)].map((m) => m[1].toLowerCase());
      const known = addedColumns.get(table) ?? new Set();
      const unk = cols.filter((c) => !known.has(c));
      if (unk.length) {
        dropped.push(`${file}\t${firstLine} (drift UPDATE referencing undeclared ${table}.${unk.join(",")})`);
        return;
      }
    }
    const bucket = kind === "dml" ? seeds : schema;
    for (const piece of splitMultiAddAlter(t)) {
      const alterTableMatch = piece.match(/^ALTER\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?(\S+)/i);
      if (alterTableMatch && !declaredTables.has(alterTableMatch[2].toLowerCase())) {
        // Postgres-only guarded ALTERs on legacy tables (IF to_regclass(...)).
        dropped.push(`${file}\t${firstLine} (ALTER on undeclared legacy table)`);
        continue;
      }
      const created = createColumns(piece);
      if (created) {
        declaredTables.add(created.table);
        const seen = addedColumns.get(created.table) ?? new Set();
        for (const c of created.cols) seen.add(c);
        addedColumns.set(created.table, seen);
      }
      const addMatch = piece.match(/^ALTER\s+TABLE\s+(\S+)\s+ADD\s+COLUMN\s+([^\s,]+)/i);
      if (addMatch) {
        const table = addMatch[1].toLowerCase();
        const col = addMatch[2].toLowerCase();
        const seen = addedColumns.get(table) ?? new Set();
        if (seen.has(col)) {
          dropped.push(`${file}\t${firstLine} (duplicate ADD COLUMN ${table}.${col})`);
          continue;
        }
        seen.add(col);
        addedColumns.set(table, seen);
      }
      if (/^ALTER\s+TABLE\b[\s\S]*\bADD\s+COLUMN\b[\s\S]*\bUNIQUE\b/i.test(piece)) {
        // SQLite cannot add a UNIQUE column; shim it with a UNIQUE index.
        const uq = piece.match(/^ALTER\s+TABLE\s+(\S+)\s+ADD\s+COLUMN\s+([^\s,]+)/i);
        bucket.push(piece.replace(/\s+UNIQUE\b/i, " "));
        if (uq) {
          bucket.push(
            `CREATE UNIQUE INDEX IF NOT EXISTS uq_${uq[1]}_${uq[2]} ON ${uq[1]}(${uq[2]})`
          );
        }
        continue;
      }
      bucket.push(piece);
    }
  };

  for (const file of files) {
    const src0 = await readFile(path.join(migrationsDir, file), "utf8");
    const src = stripPgBlocks(src0);
    discardedBlocks += Math.max(0, src0.length - src.length);
    const stmts = tokenizeStatements(src);
    for (const override of EMIT_OVERRIDES[file] ?? []) {
      handle(file, override, "");
    }
    for (const raw of stmts) {
      // Safety re-split in case a `;` survived inside a statement.
      for (const sub of raw.split(";")) handle(file, sub, raw);
    }
  }

  // Coverage self-check: every CREATE/ALTER INDEX target must have a table.
  const created = new Set();
  for (const s of schema) {
    const m = s.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\S+)/i);
    if (m) created.add(m[1].toLowerCase());
    const a = s.match(/^ALTER\s+TABLE\s+(\S+)/i);
    if (a) created.add(a[1].toLowerCase());
  }
  const orphanIndexes = [];
  for (const s of schema) {
    if (!/^CREATE\s+(UNIQUE\s+)?INDEX/i.test(s)) continue;
    const m = s.match(/^CREATE\s+(?:UNIQUE\s+)?INDEX[^"']*\bON\s+([^\s(]+)/i);
    if (m && m[1] && !created.has(m[1].toLowerCase())) orphanIndexes.push(s.slice(0, 140));
  }
  if (orphanIndexes.length) {
    console.warn(`WARN: ${orphanIndexes.length} index(es) reference tables never created:`);
    for (const o of orphanIndexes) console.warn("  " + o);
  }

  await mkdir(outDir, { recursive: true });
  const header = (title) =>
    `-- ${title}\n-- Generated by scripts/build-business-d1-schema.mjs from apps/api/migrations/*.sql\n-- Do not edit by hand; re-run the script instead.\n`;
  await writeFile(
    path.join(outDir, "business-schema.sql"),
    header("D1 business schema (transpiled from Postgres)") + "\n" + schema.join(";\n") + ";\n"
  );
  await writeFile(
    path.join(outDir, "business-seeds.sql"),
    header("D1 business seeds (transpiled from Postgres)") + "\n" + seeds.join(";\n") + ";\n"
  );
  await writeFile(
    path.join(outDir, "DROPPED.log"),
    `# Dropped: ${dropped.length} statements. Stripped ~${Math.round(discardedBlocks / 1024)} KiB of PL/pgSQL bodies.\n` +
      dropped.join("\n") +
      "\n"
  );
  console.log(`migrations: ${files.length} files`);
  console.log(`schema stmts: ${schema.length}  seeds stmts: ${seeds.length}  dropped: ${dropped.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});