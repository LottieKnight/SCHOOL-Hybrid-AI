// apps/api/src/routes/onboarding.ts
import { FastifyPluginAsync } from 'fastify';

/**
 * Minimal onboarding endpoint used by the self‑service portal.
 * POST /onboarding { schoolName, subdomain }
 * Returns: { apiKey, tenantId }
 */
export const onboardingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/onboarding', async (req, reply) => {
    const { schoolName, subdomain } = req.body as { schoolName: string; subdomain: string };
    if (!schoolName || !subdomain) {
      return reply.code(400).send({ error: 'schoolName and subdomain are required' });
    }
    // Very simple implementation: tenantId = subdomain, apiKey = random UUID.
    const tenantId = subdomain.replace(/[^a-z0-9-]/gi, '').toLowerCase();
    const apiKey = crypto.randomUUID();
    // Persist to DB – placeholder (in real world we would insert a row).
    // Here we just echo back.
    return reply.code(201).send({ tenantId, apiKey });
  });
};
