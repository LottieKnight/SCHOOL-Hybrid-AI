// apps/api/src/routes/files.ts
// Serves generated lesson illustrations persisted by lib/imageGen.ts.
import { FastifyInstance } from "fastify";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireAuth } from "../middleware/auth.js";

const IMAGE_ROOT = fileURLToPath(new URL("../../uploads/lesson-images", import.meta.url));

export async function registerFilesRoutes(app: FastifyInstance) {
  // Lesson illustrations (generated via DALL·E / future FAL). Public-ish but gated to
  // authenticated users to avoid hotlinking of generated assets.
  app.get("/files/lesson-image/:file", { preHandler: requireAuth }, async (request, reply) => {
    const { file } = request.params as { file: string };
    // Prevent path traversal: only allow bare filenames.
    if (!/^[A-Za-z0-9-]+\.png$/.test(file)) {
      reply.code(400).send({ error: "Invalid file name." });
      return;
    }
    const resolved = path.join(IMAGE_ROOT, file);
    if (!resolved.startsWith(IMAGE_ROOT)) {
      reply.code(400).send({ error: "Invalid path." });
      return;
    }
    try {
      await fs.access(resolved);
    } catch {
      reply.code(404).send({ error: "Not found." });
      return;
    }
    reply.header("Cache-Control", "public, max-age=31536000, immutable");
    reply.type("image/png");
    return reply.send(createReadStream(resolved));
  });
}
