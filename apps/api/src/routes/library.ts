import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { pool } from "../db/pool.js";

const contentTypeEnum = z.enum([
  "article",
  "book",
  "journal",
  "publication",
  "past_paper",
  "video_lesson",
]);

const gradeBandEnum = z.enum([
  "foundation",
  "intermediate",
  "senior",
  "fet",
  "university",
  "all",
]);

const accessTypeEnum = z.enum(["free", "premium", "subscription"]);
const fileTypeEnum = z.enum(["pdf", "epub", "link", "video", "html"]);

const listQuerySchema = z.object({
  content_type: contentTypeEnum.optional(),
  grade_band: gradeBandEnum.optional(),
  subject: z.string().trim().min(1).max(120).optional(),
  search: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const createResourceSchema = z.object({
  title: z.string().min(2).max(300),
  description: z.string().max(10000).optional(),
  content_type: contentTypeEnum,
  subject: z.string().max(120).optional(),
  grade_band: gradeBandEnum.optional(),
  topic_tags: z.array(z.string().max(80)).max(20).optional(),
  author: z.string().max(200).optional(),
  publisher: z.string().max(200).optional(),
  published_year: z.number().int().min(1800).max(2100).optional(),
  language: z.string().min(2).max(10).optional().default("en"),
  access_type: accessTypeEnum.optional().default("free"),
  thumbnail_url: z.string().url().max(2000).optional(),
  resource_url: z.string().url().max(2000).optional(),
  storage_key: z.string().max(500).optional(),
  file_type: fileTypeEnum.optional(),
  file_size_bytes: z.number().int().nonnegative().optional(),
  metadata_json: z.record(z.unknown()).optional(),
});

const updateResourceSchema = createResourceSchema.partial();

export async function registerLibraryRoutes(app: FastifyInstance) {
  app.get("/library/resources", async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid query", details: parsed.error.flatten() });
      return;
    }

    const { content_type, grade_band, subject, search, limit, offset } = parsed.data;

    let query = `
      SELECT id, title, description, content_type, subject, grade_band, topic_tags,
             author, publisher, published_year, language, access_type,
             thumbnail_url, resource_url, file_type, is_active, created_at
      FROM library_resources
      WHERE is_active = true
    `;
    const params: unknown[] = [];
    let idx = 1;

    if (content_type) {
      query += ` AND content_type = $${idx++}`;
      params.push(content_type);
    }
    if (grade_band) {
      query += ` AND grade_band = $${idx++}`;
      params.push(grade_band);
    }
    if (subject) {
      query += ` AND subject ILIKE $${idx++}`;
      params.push(`%${subject}%`);
    }
    if (search) {
      query += ` AND (title ILIKE $${idx} OR description ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    reply.send({ resources: result.rows, limit, offset });
  });

  app.get("/library/resources/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(
      `SELECT id, title, description, content_type, subject, grade_band, topic_tags,
              author, publisher, published_year, language, access_type,
              thumbnail_url, resource_url, file_type, metadata_json, is_active, created_at
       FROM library_resources
       WHERE id = $1 AND is_active = true`,
      [id]
    );
    if (result.rows.length === 0) {
      reply.code(404).send({ error: "Resource not found" });
      return;
    }
    reply.send({ resource: result.rows[0] });
  });

  app.post("/library/collections", { preHandler: requireAuth }, async (request, reply) => {
    const body = request.body as { resource_id?: string };
    if (!body?.resource_id) {
      reply.code(400).send({ error: "resource_id is required" });
      return;
    }

    const exists = await pool.query(
      `SELECT id FROM library_resources WHERE id = $1 AND is_active = true`,
      [body.resource_id]
    );
    if (exists.rows.length === 0) {
      reply.code(404).send({ error: "Resource not found" });
      return;
    }

    await pool.query(
      `INSERT INTO library_collections (user_id, resource_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [request.user.sub, body.resource_id]
    );
    reply.code(201).send({ saved: true });
  });

  app.delete("/library/collections/:resourceId", { preHandler: requireAuth }, async (request, reply) => {
    const { resourceId } = request.params as { resourceId: string };
    await pool.query(
      `DELETE FROM library_collections WHERE user_id = $1 AND resource_id = $2`,
      [request.user.sub, resourceId]
    );
    reply.send({ removed: true });
  });

  app.get("/library/collections", { preHandler: requireAuth }, async (request, reply) => {
    const result = await pool.query(
      `SELECT r.id, r.title, r.description, r.content_type, r.subject, r.grade_band,
              r.topic_tags, r.author, r.publisher, r.language, r.access_type,
              r.thumbnail_url, r.resource_url, r.file_type, r.created_at,
              c.added_at
       FROM library_collections c
       JOIN library_resources r ON r.id = c.resource_id
       WHERE c.user_id = $1 AND r.is_active = true
       ORDER BY c.added_at DESC`,
      [request.user.sub]
    );
    reply.send({ resources: result.rows });
  });

  app.post("/admin/library/resources", { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = createResourceSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }

    const d = parsed.data;
    const result = await pool.query(
      `INSERT INTO library_resources (
         title, description, content_type, subject, grade_band, topic_tags,
         author, publisher, published_year, language, access_type,
         thumbnail_url, resource_url, storage_key, file_type, file_size_bytes, metadata_json
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING id, title, content_type, created_at`,
      [
        d.title,
        d.description ?? null,
        d.content_type,
        d.subject ?? null,
        d.grade_band ?? null,
        d.topic_tags ?? [],
        d.author ?? null,
        d.publisher ?? null,
        d.published_year ?? null,
        d.language,
        d.access_type,
        d.thumbnail_url ?? null,
        d.resource_url ?? null,
        d.storage_key ?? null,
        d.file_type ?? null,
        d.file_size_bytes ?? null,
        JSON.stringify(d.metadata_json ?? {}),
      ]
    );
    reply.code(201).send({ resource: result.rows[0] });
  });

  app.put("/admin/library/resources/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateResourceSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }

    const d = parsed.data;
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const fields: [string, unknown][] = [
      ["title", d.title],
      ["description", d.description],
      ["content_type", d.content_type],
      ["subject", d.subject],
      ["grade_band", d.grade_band],
      ["topic_tags", d.topic_tags],
      ["author", d.author],
      ["publisher", d.publisher],
      ["published_year", d.published_year],
      ["language", d.language],
      ["access_type", d.access_type],
      ["thumbnail_url", d.thumbnail_url],
      ["resource_url", d.resource_url],
      ["storage_key", d.storage_key],
      ["file_type", d.file_type],
      ["file_size_bytes", d.file_size_bytes],
    ];

    for (const [col, val] of fields) {
      if (val !== undefined) {
        setClauses.push(`${col} = $${idx++}`);
        params.push(val);
      }
    }

    if (d.metadata_json !== undefined) {
      setClauses.push(`metadata_json = $${idx++}`);
      params.push(JSON.stringify(d.metadata_json));
    }

    if (setClauses.length === 0) {
      reply.code(400).send({ error: "No fields to update" });
      return;
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(id);

    const result = await pool.query(
      `UPDATE library_resources SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING id, title, updated_at`,
      params
    );

    if (result.rows.length === 0) {
      reply.code(404).send({ error: "Resource not found" });
      return;
    }
    reply.send({ resource: result.rows[0] });
  });

  app.delete("/admin/library/resources/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(
      `UPDATE library_resources SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [id]
    );
    if (result.rows.length === 0) {
      reply.code(404).send({ error: "Resource not found" });
      return;
    }
    reply.send({ deleted: true });
  });
}
