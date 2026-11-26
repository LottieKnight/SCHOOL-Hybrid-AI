import { FastifyInstance } from "fastify";
import { z } from "zod";
import { getBursaryFacets, matchBursaries } from "../db/bursaries.js";
import { PROVIDER_TYPES, YEAR_LEVELS } from "../lib/bursaryVocab.js";

// Parse a query-string boolean explicitly. z.coerce.boolean() is unsafe here:
// it does Boolean(value), so the string "false" coerces to TRUE. Only "true"/"1"
// (and a real boolean true) are truthy; everything else — including "false" and
// undefined — is false.
const boolParam = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => v === true || v === "true" || v === "1");

// `field` and `year` accept "" to mean "any" — matchBursaries still returns
// bursaries that are open to all fields/years (their arrays are empty) and scores
// the rest. Values flow into the matcher as bound parameters, never interpolated.
const matchQuery = z.object({
  field: z.string().max(120).optional().default(""),
  year: z.enum(["", ...YEAR_LEVELS] as unknown as [string, ...string[]]).optional().default(""),
  needsAid: boolParam,
  providerType: z.enum(PROVIDER_TYPES as unknown as [string, ...string[]]).optional(),
  needsOnly: boolParam,
  sortBy: z.enum(["match", "deadline"]).optional().default("match"),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  offset: z.coerce.number().int().min(0).max(10_000).optional().default(0),
});

export async function registerBursaryRoutes(app: FastifyInstance) {
  // Public matcher — drives the Bursary Finder. No auth: prospective students
  // (not yet registered) are a core audience, so this stays open.
  app.get("/bursaries/match", async (request, reply) => {
    const parsed = matchQuery.safeParse(request.query ?? {});
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid query", details: parsed.error.flatten() });
      return;
    }
    const { field, year, needsAid, providerType, needsOnly, sortBy, limit, offset } = parsed.data;
    try {
      const { bursaries, total } = await matchBursaries({
        fieldOfStudy: field,
        yearOfStudy: year,
        needsFinancialAid: needsAid,
        providerType,
        needsOnly,
        sortBy,
        limit,
        offset,
      });
      reply.send({ bursaries, total, limit, offset });
    } catch (err) {
      request.log.error({ err }, "bursary match failed");
      reply.code(500).send({ error: "bursary_match_failed" });
    }
  });

  // Filter facets (provider-type counts + total live bursaries).
  app.get("/bursaries/facets", async (_request, reply) => {
    try {
      const facets = await getBursaryFacets();
      reply.send(facets);
    } catch {
      reply.code(500).send({ error: "bursary_facets_failed" });
    }
  });
}
