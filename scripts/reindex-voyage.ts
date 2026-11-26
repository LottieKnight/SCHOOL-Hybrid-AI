/**
 * scripts/reindex-voyage.ts
 *
 * Phase 7 — re-embed the RAG `documents` table with Voyage (`voyage-3-lite` → 512 dims)
 * so the Supabase `documents.embedding` vector column matches `embedQuery()` in
 * `apps/web/lib/rag.ts` (which now calls Voyage when VOYAGE_API_KEY is set).
 *
 * ⚠️  This touches the Supabase `documents` table (NOT the local SCHOOL Postgres on :5432),
 *     because the RAG surface / `match_documents` RPC lives in the Supabase project.
 *     It is NOT exercised by CI or this sandbox (no Supabase credentials here).
 *     Run it as an operator with a Supabase Postgres connection string.
 *
 * Required env:
 *   SUPABASE_DATABASE_URL   Postgres connection string to the Supabase DB
 *                           (postgres://postgres.<ref>:<token>@db.<ref>.supabase.co:5432/postgres)
 *   VOYAGE_API_KEY          Voyage secret key (starts with `pa-`)
 *
 * Optional env:
 *   VOYAGE_EMBEDDING_MODEL  default `voyage-3-lite` (legacy, fixed 512-dim)
 *   RAG_TEXT_COLUMN         embeddable text column (default `content`)
 *   BATCH_SIZE              embeddings per Voyage call (default 50, max 200)
 *   EMBEDDING_DIM           target vector width (default 512)
 *
 * Usage:
 *   npx tsx scripts/reindex-voyage.ts
 *
 * After a clean run, swap the column (see §1 runbook in
 * docs/superpowers/specs/2026-05-31-architectural-upgrades.md):
 *   ALTER TABLE documents DROP COLUMN embedding;
 *   ALTER TABLE documents RENAME COLUMN embedding_512 TO embedding;
 */
import { Pool } from "pg";

const SUPABASE_DATABASE_URL = process.env.SUPABASE_DATABASE_URL ?? "";
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY ?? "";
const MODEL = process.env.VOYAGE_EMBEDDING_MODEL ?? "voyage-3-lite";
const TEXT_COL = process.env.RAG_TEXT_COLUMN ?? "content";
const BATCH_SIZE = Math.max(1, Math.min(200, Number(process.env.BATCH_SIZE ?? "50")));
const EMBEDDING_DIM = Number(process.env.EMBEDDING_DIM ?? "512");

function fail(msg: string): never {
  console.error("FATAL:", msg);
  process.exit(1);
}

if (!SUPABASE_DATABASE_URL) fail("Set SUPABASE_DATABASE_URL (Supabase Postgres connection string).");
if (!VOYAGE_API_KEY) fail("Set VOYAGE_API_KEY (your Voyage secret key).");
if (!/^[a-z_]+$/.test(TEXT_COL)) fail(`RAG_TEXT_COLUMN must be a bare identifier (letters/underscores), got "${TEXT_COL}".`);

const pool = new Pool({ connectionString: SUPABASE_DATABASE_URL });

interface DocumentRow {
  id: string;
  text: string;
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ input: texts, model: MODEL, input_type: "document" }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Voyage ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { data?: Array<{ embedding: number[] }> };
  const out = data.data?.map((d) => d.embedding) ?? [];
  if (out.length !== texts.length) {
    throw new Error(`Voyage returned ${out.length} embeddings for ${texts.length} inputs`);
  }
  for (const v of out) {
    if (v.length !== EMBEDDING_DIM) {
      throw new Error(`Expected ${EMBEDDING_DIM}-dim vectors from ${MODEL}, got ${v.length}`);
    }
  }
  return out;
}

async function main() {
  // 1. Add a fresh 512-dim column (keeps the old 1536-dim `embedding` for rollback).
  await pool.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS embedding_512 vector(${EMBEDDING_DIM})`);

  // 2. Confirm the text column exists.
  const cols = (await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'documents'"
  )).rows.map((r: { column_name: string }) => r.column_name);
  if (!cols.includes(TEXT_COL)) {
    fail(`Column "${TEXT_COL}" not found in documents. Known columns: ${cols.join(", ")}. Set RAG_TEXT_COLUMN.`);
  }

  // 3. Backfill embeddings in batches (keyset on id — resumable).
  let total = 0;
  let lastId: string | null = null;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const params: unknown[] = [BATCH_SIZE];
    let sql = `SELECT id, ${TEXT_COL} AS text FROM documents
                 WHERE ${TEXT_COL} IS NOT NULL AND embedding_512 IS NULL`;
    if (lastId !== null) {
      params.push(lastId);
      sql += ` AND id > $${params.length}`;
    }
    sql += ` ORDER BY id ASC LIMIT $1`;
    const rows = (await pool.query<DocumentRow>(sql, params)).rows;
    if (rows.length === 0) break;

    const texts = rows.map((r) => String(r.text));
    const vectors = await embedBatch(texts);
    for (let i = 0; i < rows.length; i++) {
      const vecStr = "[" + vectors[i].join(",") + "]";
      await pool.query(
        `UPDATE documents SET embedding_512 = $1::vector(${EMBEDDING_DIM}) WHERE id = $2`,
        [vecStr, rows[i].id]
      );
    }
    total += rows.length;
    lastId = rows[rows.length - 1].id;
    console.log(`Re-embedded ${total} documents (${rows.length} in this batch) → embedding_512`);
  }

  // 4. Report any docs that still lack embedding_512 (e.g. empty/NULL text).
  const remaining = (await pool.query(
    "SELECT COUNT(*)::int AS n FROM documents WHERE embedding_512 IS NULL AND " +
      `${TEXT_COL} IS NOT NULL`
  )).rows[0].n;
  console.log(`Done. ${total} vectors written to embedding_512. ${remaining} non-null-text docs still un-embedded.`);
  await pool.end();
}

main().catch((err) => {
  console.error("FAILED:", err);
  void pool.end();
  process.exit(1);
});
