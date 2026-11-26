import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { getLearnerSkillBias, recordQuizAttempt } from "../db/learner-skills.js";
import { recordQuizAttemptV2 } from "../db/policies.js";

const biasQuerySchema = z.object({
  subject: z.string().min(1).max(120),
  grade: z.coerce.number().int().min(0).max(12),
  topicTag: z.string().max(120).optional(),
});

const attemptSchema = z.object({
  subject: z.string().min(1).max(120),
  grade: z.number().int().min(0).max(12),
  lessonKey: z.string().min(1).max(200),
  topicTag: z.string().max(120).optional(),
  scorePercent: z.number().min(0).max(100),
  correctCount: z.number().int().min(0),
  totalCount: z.number().int().min(1),
});

export async function registerLessonQuizRoutes(app: FastifyInstance) {
  app.get("/lessons/quiz/bias", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = biasQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }

    const bias = await getLearnerSkillBias({
      learnerId: request.user.sub,
      subject: parsed.data.subject,
      grade: parsed.data.grade,
      topicTag: parsed.data.topicTag ?? null,
    });

    reply.send({ bias });
  });

  app.post("/lessons/quiz/attempt", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = attemptSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }

    const { attempt, bias } = await recordQuizAttempt({
      learnerId: request.user.sub,
      subject: parsed.data.subject,
      grade: parsed.data.grade,
      lessonKey: parsed.data.lessonKey,
      topicTag: parsed.data.topicTag ?? null,
      scorePercent: parsed.data.scorePercent,
      correctCount: parsed.data.correctCount,
      totalCount: parsed.data.totalCount,
    });

    await recordQuizAttemptV2({
      learnerId: request.user.sub,
      lessonKey: parsed.data.lessonKey,
      subject: parsed.data.subject,
      grade: parsed.data.grade,
      scorePercent: parsed.data.scorePercent,
      timeSpentSeconds: 0,
      answersJson: {},
    });

    reply.code(201).send({ attempt, bias });
  });
}
