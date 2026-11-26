import { FastifyInstance } from "fastify";
import { z } from "zod";
import { searchSchools } from "../db/schools.js";

const querySchema = z.object({
  q: z.string().optional(),
  country: z.string().optional(),
  province: z.string().optional(),
  city: z.string().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radius: z.coerce.number().optional(),
  limit: z.coerce.number().int().min(1).max(25).optional(),
});

export async function registerSchoolRoutes(app: FastifyInstance) {
  app.get("/schools", async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid query" });
      return;
    }

    const schools = await searchSchools({
      query: parsed.data.q?.trim(),
      country: parsed.data.country?.trim(),
      province: parsed.data.province?.trim(),
      city: parsed.data.city?.trim(),
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      radiusKm: parsed.data.radius,
      limit: parsed.data.limit,
    });

    reply.header("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    reply.send({ schools });
  });
}
