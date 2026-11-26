import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { generateFingerprint } from "@saedu/shared";

const SignalSchema = z.object({
  source: z.enum(["github", "trading", "ideas", "price", "manual", "telegram"]),
  rawContent: z.string().min(1).max(5000),
  pillar: z.enum(["trading", "school", "aura", "builder"]),
});

export async function registerBrandRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/brand/signal",
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const parsedBody = SignalSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return reply.status(400).send({
          error: parsedBody.error.issues[0]?.message ?? "Invalid brand signal payload",
        });
      }
      const body = parsedBody.data;
      const { source, rawContent, pillar } = body;

      const fingerprint = generateFingerprint(rawContent);
      const existing = await pool.query(
        "SELECT id FROM brand_content_fingerprints WHERE fingerprint = $1 AND expires_at > NOW()",
        [fingerprint]
      );
      if (existing.rows.length > 0) {
        return reply.status(409).send({
          error: "Duplicate content detected within 7 days",
        });
      }

      const {
        rows: [signal],
      } = await pool.query(
        "INSERT INTO brand_signals (source, raw_content, pillar) VALUES ($1, $2, $3) RETURNING id",
        [source, rawContent, pillar]
      );
      if (!signal) {
        return reply.status(500).send({ error: "Failed to create signal" });
      }

      await app.brandQueue.add("generate", {
        signalId: signal.id as number,
        source,
        rawContent,
        pillar,
      });

      return reply.status(202).send({
        signalId: signal.id,
        status: "queued",
      });
    }
  );

  app.get("/brand/drafts", { preHandler: [requireAuth] }, async (_req, reply) => {
    const { rows } = await pool.query(`
      SELECT d.*, s.source, s.pillar, s.raw_content
      FROM brand_drafts d
      JOIN brand_signals s ON s.id = d.signal_id
      ORDER BY d.created_at DESC
      LIMIT 50
    `);
    return reply.send({ drafts: rows });
  });

  app.get("/brand/analytics", { preHandler: [requireAuth] }, async (_req, reply) => {
    const { rows } = await pool.query(`
      SELECT
        d.platform,
        COUNT(d.id) AS posts,
        COALESCE(SUM(a.impressions), 0)::bigint AS total_impressions,
        COALESCE(SUM(a.engagements), 0)::bigint AS total_engagements,
        ROUND(AVG(CASE WHEN a.impressions > 0 THEN a.engagements::numeric / a.impressions * 100 END), 2) AS avg_engagement_rate
      FROM brand_drafts d
      LEFT JOIN brand_analytics a ON a.draft_id = d.id
      WHERE d.published_at > NOW() - INTERVAL '7 days'
      GROUP BY d.platform
    `);
    return reply.send({ weekly: rows });
  });

  app.get("/brand/voice-model", { preHandler: [requireAuth] }, async (_req, reply) => {
    const {
      rows: [model],
    } = await pool.query(
      "SELECT * FROM brand_voice_model WHERE active = TRUE LIMIT 1"
    );
    return reply.send({ voiceModel: model ?? null });
  });

  const VoiceModelBodySchema = z.object({
    systemPrompt: z.string().min(50),
    examples: z
      .array(
        z.object({
          platform: z.enum(["x", "linkedin", "instagram", "youtube"]),
          content: z.string(),
          engagements: z.number(),
        })
      )
      .optional()
      .default([]),
  });

  app.post(
    "/brand/voice-model",
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const parsedBody = VoiceModelBodySchema.safeParse(req.body);
      if (!parsedBody.success) {
        return reply.status(400).send({
          error: parsedBody.error.issues[0]?.message ?? "Invalid voice model payload",
        });
      }

      const { systemPrompt, examples } = parsedBody.data;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          "UPDATE brand_voice_model SET active = FALSE WHERE active = TRUE"
        );
        const {
          rows: [versionRow],
        } = await client.query(
          "SELECT COALESCE(MAX(version), 0) + 1 AS version FROM brand_voice_model"
        );
        const nextVersion = (versionRow?.version as number) ?? 1;
        const {
          rows: [model],
        } = await client.query(
          `INSERT INTO brand_voice_model (version, system_prompt, examples, active)
           VALUES ($1, $2, $3, TRUE) RETURNING *`,
          [nextVersion, systemPrompt, JSON.stringify(examples)]
        );
        await client.query("COMMIT");
        return reply.status(201).send({ voiceModel: model });
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    }
  );
}
