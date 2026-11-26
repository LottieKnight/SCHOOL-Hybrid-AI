import type { FastifyInstance } from "fastify";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { generateFingerprint } from "@saedu/shared";

export async function registerBrandWebhookRoutes(
  app: FastifyInstance
): Promise<void> {
  app.post("/webhooks/brand/github", async (req, reply) => {
    const payload = req.body as {
      ref?: string;
      commits?: Array<{
        message?: string;
        author?: { name?: string };
        modified?: string[];
      }>;
      repository?: { name?: string };
    };
    if (payload.ref !== "refs/heads/main") {
      return reply.send({ skip: true });
    }

    const commits = payload.commits ?? [];
    const repo = payload.repository?.name ?? "unknown";

    for (const commit of commits) {
      const message = commit.message ?? "";
      const rawContent = `New commit to ${repo}: "${message}" by ${commit.author?.name ?? "unknown"}. Files changed: ${commit.modified?.join(", ") ?? "multiple"}`;
      const pillar = repo.includes("aura") ? "aura" : "school";

      const fingerprint = generateFingerprint(rawContent);
      const existing = await pool.query(
        "SELECT id FROM brand_content_fingerprints WHERE fingerprint = $1 AND expires_at > NOW()",
        [fingerprint]
      );
      if (existing.rows.length > 0) continue;

      const {
        rows: [signal],
      } = await pool.query(
        "INSERT INTO brand_signals (source, raw_content, pillar) VALUES ($1, $2, $3) RETURNING id",
        ["github", rawContent, pillar]
      );
      if (signal) {
        await app.brandQueue.add("generate", {
          signalId: signal.id as number,
          source: "github",
          rawContent,
          pillar,
        });
      }
    }

    return reply.send({ received: commits.length });
  });

  app.post(
    "/webhooks/brand/manual",
    {
      preHandler: [requireAuth],
      schema: {
        body: {
          type: "object",
          required: ["content", "pillar"],
          properties: {
            content: { type: "string" },
            pillar: { type: "string", enum: ["trading", "school", "aura", "builder"] },
          },
        },
      },
    },
    async (req, reply) => {
      const body = req.body as { content: string; pillar: string };
      const { content, pillar } = body;

      const {
        rows: [signal],
      } = await pool.query(
        "INSERT INTO brand_signals (source, raw_content, pillar) VALUES ($1, $2, $3) RETURNING id",
        ["manual", content, pillar]
      );
      if (!signal) {
        return reply.status(500).send({ error: "Failed to create signal" });
      }

      await app.brandQueue.add("generate", {
        signalId: signal.id as number,
        source: "manual",
        rawContent: content,
        pillar,
      });

      return reply.status(202).send({ queued: true });
    }
  );
}
