import { FastifyInstance } from "fastify";
import { getCachedJson, setCachedJson } from "../cache.js";

export async function registerCurriculumRoutes(app: FastifyInstance) {
  app.get("/curriculum/outline", async (_request, reply) => {
    const cacheKey = "curriculum:outline:stub";
    const cached = await getCachedJson<{ status: string; message: string; cached: boolean }>(cacheKey);

    if (cached) {
      reply.send({ ...cached, cached: true });
      return;
    }

    const payload = {
      status: "stub",
      message: "Curriculum is currently served from static JSON in the web app.",
      cached: false,
    };

    await setCachedJson(cacheKey, payload, 60);
    reply.send(payload);
  });
}
