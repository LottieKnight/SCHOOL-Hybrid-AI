import { randomUUID } from "node:crypto";
import { pool } from "./pool.js";
import type {
  WorkInput,
  WorkKind,
  WorkLayout,
  WorkLicense,
  WorkStatus,
  WorkVersionInput,
} from "@saedu/shared";

// --- Row shapes ------------------------------------------------------------

export interface WorkRow {
  id: string;
  author_id: string;
  kind: WorkKind;
  layout: WorkLayout;
  title: string;
  slug: string;
  abstract: string | null;
  body_md: string | null;
  discipline_tags: string[];
  license: WorkLicense;
  status: WorkStatus;
  doi: string | null;
  cover_url: string | null;
  cover_storage_key: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkAuthorRow {
  user_id: string | null;
  display_name: string;
  affiliation: string | null;
  ord: number;
}

export interface WorkVersionRow {
  id: string;
  work_id: string;
  version: number;
  file_url: string | null;
  storage_key: string | null;
  image_urls: string[];
  changelog: string | null;
  created_at: string;
}

export interface WorkReferenceRow {
  id: string;
  raw: string;
  doi: string | null;
  ord: number;
}

export interface WorkDetail {
  work: WorkRow;
  authors: WorkAuthorRow[];
  versions: WorkVersionRow[];
  references: WorkReferenceRow[];
}

const WORK_COLS = `id, author_id, kind, layout, title, slug, abstract, body_md,
  discipline_tags, license, status, doi, cover_url, cover_storage_key,
  published_at, created_at, updated_at`;

// --- Slug ------------------------------------------------------------------

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const suffix = randomUUID().slice(0, 6);
  return base ? `${base}-${suffix}` : `work-${suffix}`;
}

// --- Create ----------------------------------------------------------------

export async function createWork(authorId: string, input: WorkInput): Promise<WorkRow> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const slug = slugify(input.title);
    const { rows } = await client.query<WorkRow>(
      `INSERT INTO works
          (author_id, kind, layout, title, slug, abstract, body_md,
           discipline_tags, license, cover_url, cover_storage_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING ${WORK_COLS}`,
      [
        authorId,
        input.kind,
        input.layout,
        input.title,
        slug,
        input.abstract ?? null,
        input.bodyMd ?? null,
        input.disciplineTags,
        input.license,
        input.coverUrl ?? null,
        input.coverStorageKey ?? null,
      ]
    );
    const work = rows[0];
    await replaceAuthors(client, work.id, authorId, input.authors);
    await replaceReferences(client, work.id, input.references ?? []);
    await client.query("COMMIT");
    return work;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// --- Update (drafts only, owner only) --------------------------------------

export async function updateWork(
  workId: string,
  authorId: string,
  input: WorkInput
): Promise<WorkRow | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<WorkRow>(
      `UPDATE works
          SET kind = $3, layout = $4, title = $5, abstract = $6, body_md = $7,
              discipline_tags = $8, license = $9, cover_url = $10,
              cover_storage_key = $11, updated_at = NOW()
        WHERE id = $1 AND author_id = $2 AND status = 'draft'
        RETURNING ${WORK_COLS}`,
      [
        workId,
        authorId,
        input.kind,
        input.layout,
        input.title,
        input.abstract ?? null,
        input.bodyMd ?? null,
        input.disciplineTags,
        input.license,
        input.coverUrl ?? null,
        input.coverStorageKey ?? null,
      ]
    );
    if (!rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }
    await replaceAuthors(client, workId, authorId, input.authors);
    await replaceReferences(client, workId, input.references ?? []);
    await client.query("COMMIT");
    return rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function replaceAuthors(
  client: { query: typeof pool.query },
  workId: string,
  authorId: string,
  authors: WorkInput["authors"]
): Promise<void> {
  await client.query(`DELETE FROM work_authors WHERE work_id = $1`, [workId]);
  // Guarantee the owner is credited first if the caller omitted them.
  const list = authors.length > 0 ? authors : [{ displayName: "", userId: authorId }];
  for (let ord = 0; ord < list.length; ord++) {
    const a = list[ord];
    await client.query(
      `INSERT INTO work_authors (work_id, user_id, display_name, affiliation, ord)
       VALUES ($1, $2, $3, $4, $5)`,
      [workId, a.userId ?? null, a.displayName, a.affiliation ?? null, ord]
    );
  }
}

async function replaceReferences(
  client: { query: typeof pool.query },
  workId: string,
  references: NonNullable<WorkInput["references"]>
): Promise<void> {
  await client.query(`DELETE FROM work_references WHERE work_id = $1`, [workId]);
  for (let ord = 0; ord < references.length; ord++) {
    const r = references[ord];
    await client.query(
      `INSERT INTO work_references (work_id, raw, doi, ord) VALUES ($1, $2, $3, $4)`,
      [workId, r.raw, r.doi ?? null, ord]
    );
  }
}

// --- Versions --------------------------------------------------------------

export async function addWorkVersion(
  workId: string,
  authorId: string,
  input: WorkVersionInput
): Promise<WorkVersionRow | null> {
  const owned = await pool.query(`SELECT 1 FROM works WHERE id = $1 AND author_id = $2`, [
    workId,
    authorId,
  ]);
  if (owned.rowCount === 0) return null;

  const { rows } = await pool.query<WorkVersionRow>(
    `INSERT INTO work_versions (work_id, version, file_url, storage_key, image_urls, changelog)
     VALUES (
       $1,
       COALESCE((SELECT MAX(version) FROM work_versions WHERE work_id = $1), 0) + 1,
       $2, $3, $4, $5
     )
     RETURNING id, work_id, version, file_url, storage_key, image_urls, changelog, created_at`,
    [workId, input.fileUrl ?? null, input.storageKey ?? null, input.imageUrls ?? [], input.changelog ?? null]
  );
  return rows[0];
}

// --- Status transitions ----------------------------------------------------

export async function publishWork(workId: string, authorId: string): Promise<WorkRow | null> {
  const { rows } = await pool.query<WorkRow>(
    `UPDATE works
        SET status = 'published', published_at = COALESCE(published_at, NOW()), updated_at = NOW()
      WHERE id = $1 AND author_id = $2 AND status = 'draft'
      RETURNING ${WORK_COLS}`,
    [workId, authorId]
  );
  return rows[0] ?? null;
}

export async function withdrawWork(workId: string, authorId: string): Promise<WorkRow | null> {
  const { rows } = await pool.query<WorkRow>(
    `UPDATE works
        SET status = 'withdrawn', updated_at = NOW()
      WHERE id = $1 AND author_id = $2 AND status IN ('published', 'curated')
      RETURNING ${WORK_COLS}`,
    [workId, authorId]
  );
  return rows[0] ?? null;
}

// --- Reads -----------------------------------------------------------------

/** Full public detail by slug. Visibility is enforced by the caller. */
export async function getWorkDetailBySlug(slug: string): Promise<WorkDetail | null> {
  const { rows } = await pool.query<WorkRow>(`SELECT ${WORK_COLS} FROM works WHERE slug = $1`, [
    slug,
  ]);
  const work = rows[0];
  if (!work) return null;
  return assembleDetail(work);
}

export async function getWorkForOwner(workId: string, authorId: string): Promise<WorkRow | null> {
  const { rows } = await pool.query<WorkRow>(
    `SELECT ${WORK_COLS} FROM works WHERE id = $1 AND author_id = $2`,
    [workId, authorId]
  );
  return rows[0] ?? null;
}

async function assembleDetail(work: WorkRow): Promise<WorkDetail> {
  const [authors, versions, references] = await Promise.all([
    pool.query<WorkAuthorRow>(
      `SELECT user_id, display_name, affiliation, ord
         FROM work_authors WHERE work_id = $1 ORDER BY ord ASC`,
      [work.id]
    ),
    pool.query<WorkVersionRow>(
      `SELECT id, work_id, version, file_url, storage_key, image_urls, changelog, created_at
         FROM work_versions WHERE work_id = $1 ORDER BY version DESC`,
      [work.id]
    ),
    pool.query<WorkReferenceRow>(
      `SELECT id, raw, doi, ord FROM work_references WHERE work_id = $1 ORDER BY ord ASC`,
      [work.id]
    ),
  ]);
  return { work, authors: authors.rows, versions: versions.rows, references: references.rows };
}

/** An author's bibliography. `viewerIsOwner` includes drafts/withdrawn. */
export async function listAuthorWorks(
  authorId: string,
  viewerIsOwner: boolean
): Promise<WorkRow[]> {
  const statusFilter = viewerIsOwner ? "" : `AND status IN ('published', 'curated')`;
  const { rows } = await pool.query<WorkRow>(
    `SELECT ${WORK_COLS} FROM works
      WHERE author_id = $1 ${statusFilter}
      ORDER BY COALESCE(published_at, created_at) DESC`,
    [authorId]
  );
  return rows;
}

/** Resolve a public profile username to a user id (for the bibliography route). */
export async function getUserIdByUsername(username: string): Promise<string | null> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE username = $1`,
    [username]
  );
  return rows[0]?.id ?? null;
}

/** Public discovery feed: most recent published/curated works, optional layout filter. */
export async function listPublishedWorks(opts: {
  layout?: WorkLayout;
  limit: number;
  offset: number;
}): Promise<WorkRow[]> {
  const params: unknown[] = [];
  let where = `WHERE status IN ('published', 'curated')`;
  if (opts.layout) {
    params.push(opts.layout);
    where += ` AND layout = $${params.length}`;
  }
  params.push(opts.limit);
  const limitIdx = params.length;
  params.push(opts.offset);
  const offsetIdx = params.length;
  const { rows } = await pool.query<WorkRow>(
    `SELECT ${WORK_COLS} FROM works
      ${where}
      ORDER BY published_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );
  return rows;
}
