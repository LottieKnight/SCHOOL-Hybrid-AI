// apps/api/src/routes/planner.ts
import { FastifyPluginAsync } from 'fastify';
import { generateLearningPath } from '../services/planner.js';

export const plannerRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/plan', async (req, reply) => {
    const { tenantId } = req.params as any; // tenant middleware populates
    const { curriculum } = req.body as { curriculum: unknown };
    if (!curriculum) {
      return reply.code(400).send({ error: 'curriculum payload required' });
    }
    const plan = await generateLearningPath(tenantId, curriculum);
    return reply.send(plan);
  });
};
