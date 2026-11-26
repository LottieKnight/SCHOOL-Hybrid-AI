// apps/api/src/routes/analytics.ts
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { getStudentMetrics } from "../services/analytics.js";
import {
  getDashboardSummaryCached,
  clearDashboardSummaryCache,
} from "../lib/dashboard-summary.js";
import {
  recordLessonEngagement,
  recordQuizAttemptV2,
  upsertLessonCheckpoint,
  listLessonCheckpoints,
  listSpacedReviews,
  setSpacedReviewStatus,
} from "../db/policies.js";

export const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  // Existing per-student analytics endpoint (kept for backwards compatibility).
  fastify.get("/analytics/:studentId", async (req, reply) => {
    const { tenantId } = req.params as any;
    const { studentId } = req.params as any;
    if (!studentId) {
      return reply.code(400).send({ error: "studentId required" });
    }
    const data = await getStudentMetrics(tenantId, studentId);
    return reply.send(data);
  });

  // ----- Dashboard summary (cached, role-aware) -----
  // `refresh` only accepts the literal strings "true"/"false"; any other value
  // (e.g. "1") is rejected as an invalid query so callers can't silently bypass
  // the cache contract.
  const dashboardQuerySchema = z.object({
    refresh: z.enum(["true", "false"]).optional(),
  });

  fastify.get(
    "/analytics/dashboard-summary",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = dashboardQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid query" });
      }
      const refresh = parsed.data.refresh === "true";
      const { summary, cached, generatedAt, ttlMs } = await getDashboardSummaryCached(
        { userId: request.user.sub, role: request.user.role, email: request.user.email },
        { refresh }
      );
      return reply
        .header("cache-control", "private, max-age=0")
        .header("x-dashboard-cache", cached ? "hit" : "miss")
        .send({ summary, meta: { cached, generatedAt, ttlMs } });
    }
  );

  // ----- Analytics write endpoints -----
  // Each write mutates learner state and must invalidate the dashboard cache for
  // that learner so the next summary read reflects the new data (miss → rebuild).
  const lessonEngagementSchema = z.object({
    lessonKey: z.string().min(1),
    openedAt: z.string().min(1),
    timeSpentSeconds: z.number().int().min(0),
    completed: z.boolean(),
  });

  fastify.post(
    "/analytics/lesson-engagement",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = lessonEngagementSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      }
      await recordLessonEngagement({
        learnerId: request.user.sub,
        lessonKey: parsed.data.lessonKey,
        openedAt: parsed.data.openedAt,
        timeSpentSeconds: parsed.data.timeSpentSeconds,
        completed: parsed.data.completed,
      });
      clearDashboardSummaryCache({ userId: request.user.sub });
      return reply.code(201).send({ ok: true });
    }
  );

  const quizAttemptSchema = z.object({
    lessonKey: z.string().min(1),
    subject: z.string().min(1),
    grade: z.number().int().min(0),
    scorePercent: z.number().min(0).max(100),
    timeSpentSeconds: z.number().int().min(0),
    answersJson: z.record(z.unknown()),
  });

  fastify.post(
    "/analytics/quiz-attempt",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = quizAttemptSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      }
      await recordQuizAttemptV2({
        learnerId: request.user.sub,
        lessonKey: parsed.data.lessonKey,
        subject: parsed.data.subject,
        grade: parsed.data.grade,
        scorePercent: parsed.data.scorePercent,
        timeSpentSeconds: parsed.data.timeSpentSeconds,
        answersJson: parsed.data.answersJson,
      });
      clearDashboardSummaryCache({ userId: request.user.sub });
      return reply.code(201).send({ ok: true });
    }
  );

  const lessonCheckpointSchema = z.object({
    lessonKey: z.string().min(1),
    sectionKey: z.string().min(1),
    completed: z.boolean(),
    notes: z.string().nullable().optional(),
  });

  fastify.post(
    "/analytics/lesson-checkpoints",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = lessonCheckpointSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      }
      await upsertLessonCheckpoint({
        learnerId: request.user.sub,
        lessonKey: parsed.data.lessonKey,
        sectionKey: parsed.data.sectionKey,
        completed: parsed.data.completed,
        notes: parsed.data.notes ?? null,
      });
      clearDashboardSummaryCache({ userId: request.user.sub });
      return reply.code(201).send({ ok: true });
    }
  );

  fastify.get(
    "/analytics/lesson-checkpoints",
    { preHandler: requireAuth },
    async (request, reply) => {
      const query = z.object({ lessonKey: z.string().min(1) }).safeParse(request.query);
      if (!query.success) {
        return reply.code(400).send({ error: "Invalid query" });
      }
      const checkpoints = await listLessonCheckpoints({
        learnerId: request.user.sub,
        lessonKey: query.data.lessonKey,
      });
      return reply.send({ checkpoints });
    }
  );

  fastify.get(
    "/analytics/spaced-reviews",
    { preHandler: requireAuth },
    async (request, reply) => {
      const query = z
        .object({
          dueOnly: z.enum(["true", "false"]).optional(),
          limit: z.coerce.number().int().min(1).max(100).optional(),
        })
        .safeParse(request.query);
      if (!query.success) {
        return reply.code(400).send({ error: "Invalid query" });
      }
      const reviews = await listSpacedReviews(request.user.sub, {
        dueOnly: query.data.dueOnly === "true",
        limit: query.data.limit,
      });
      return reply.send({ reviews });
    }
  );

  const spacedReviewParamsSchema = z.object({ reviewId: z.string().uuid() });

  fastify.post(
    "/analytics/spaced-reviews/:reviewId/done",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = spacedReviewParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.code(400).send({ error: "Invalid input" });
      }
      const updated = await setSpacedReviewStatus({
        userId: request.user.sub,
        reviewId: params.data.reviewId,
        status: "done",
      });
      clearDashboardSummaryCache({ userId: request.user.sub });
      return reply.code(200).send({ updated: updated ? true : false });
    }
  );

  fastify.post(
    "/analytics/spaced-reviews/:reviewId/dismiss",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = spacedReviewParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.code(400).send({ error: "Invalid input" });
      }
      const updated = await setSpacedReviewStatus({
        userId: request.user.sub,
        reviewId: params.data.reviewId,
        status: "dismissed",
      });
      clearDashboardSummaryCache({ userId: request.user.sub });
      return reply.code(200).send({ updated: updated ? true : false });
    }
  );

  // Adaptive analytics surface (auth-gated). The route skeletons exist so
  // unauthenticated traffic is rejected with 401; full behaviour is delivered
  // in the adaptive-analytics phase (see CLAUDE_CONTEXT Phase 7).
  const notImplemented = async (_request: FastifyRequest, reply: FastifyReply) =>
    reply.code(501).send({ error: "Not implemented" });

  fastify.get("/analytics/recommendations", { preHandler: requireAuth }, notImplemented);
  fastify.get("/analytics/baseline", { preHandler: requireAuth }, notImplemented);
  fastify.put("/analytics/baseline", { preHandler: requireAuth }, notImplemented);
  fastify.get("/analytics/mastery-heatmap", { preHandler: requireAuth }, notImplemented);
  fastify.get("/analytics/adaptive-path", { preHandler: requireAuth }, notImplemented);
  fastify.get("/analytics/guardian-links", { preHandler: requireAuth }, notImplemented);
  fastify.post("/analytics/guardian-links", { preHandler: requireAuth }, notImplemented);
  fastify.get("/analytics/guardian-summary", { preHandler: requireAuth }, notImplemented);
};
