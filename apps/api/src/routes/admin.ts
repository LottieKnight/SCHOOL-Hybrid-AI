import { FastifyInstance } from "fastify";
import { z } from "zod";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  generateUniversityModuleLesson,
  writeUniversityLessonFiles,
} from "@saedu/shared";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { requireAdmin } from "../middleware/auth.js";
import { config } from "../config.js";
import { getObservabilitySummary } from "../lib/observability.js";
import { enrichLessonImages } from "../lib/imageGen.js";
import { pool } from "../db/pool.js";
import { getMonetisationSummary } from "../db/monetisation.js";
import { getImpactInclusionSummary } from "../db/impact.js";
import {
  listPricingExperimentsWithMetrics,
  startPricingExperiment,
} from "../db/pricing-experiments.js";
import {
  createFeatureFlagAudit,
  createUserSuspension,
  evaluateFeatureFlag,
  listFeatureFlagAudits,
  listFeatureFlags,
  revokeActiveUserSuspensions,
  upsertFeatureFlag,
} from "../db/platform.js";
import {
  enqueueLessonGenerationJobs,
  listLessonGenerationJobs,
  transitionLessonGenerationJob,
} from "../db/lesson-generation-queue.js";
import { listAuditLog } from "../db/audit-log.js";
import {
  listAdminBursaries,
  getBursaryById,
  createBursary,
  updateBursary,
  softDeleteBursary,
  hardDeleteBursary,
} from "../db/bursaries.js";
import { FIELDS, PROVIDER_TYPES, YEAR_LEVELS } from "../lib/bursaryVocab.js";
import { upsertUniversityLesson, getUniversityLesson } from "../db/university-lessons.js";

const generateUniversityModuleSchema = z.object({
  institution: z.string().trim().min(1).max(200),
  faculty: z.string().trim().min(1).max(200),
  course: z.string().trim().min(1).max(200),
  yearOfStudy: z.coerce.number().int().min(1).max(8),
  moduleCode: z.string().trim().min(1).max(20),
  moduleName: z.string().trim().max(200).optional(),
  topic: z.string().trim().max(240).optional(),
  force: z.boolean().optional().default(false),
});

const generateWeekSchema = z.object({
  phase: z.string().trim().min(1).max(64),
  grade: z.coerce.number().int().min(0).max(12),
  term: z.coerce.number().int().min(1).max(4),
  week: z.coerce.number().int().min(1).max(53),
  subject: z.string().trim().min(1).max(120).optional(),
  subjectKey: z.string().trim().min(1).max(120).optional(),
  topic: z.string().trim().min(1).max(240).optional(),
  force: z.boolean().optional().default(false),
});

const generateTermSchema = z.object({
  phase: z.string().trim().min(1).max(64),
  grade: z.coerce.number().int().min(0).max(12),
  term: z.coerce.number().int().min(1).max(4),
  subject: z.string().trim().min(1).max(120).optional(),
  subjectKey: z.string().trim().min(1).max(120).optional(),
  force: z.boolean().optional().default(false),
});

const featureFlagParamsSchema = z.object({
  flagKey: z.string().trim().min(1).max(120),
});

const featureFlagQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const featureFlagUpsertSchema = z
  .object({
    description: z.string().trim().max(500).nullable().optional(),
    enabled: z.boolean().optional(),
    rolloutPercent: z.coerce.number().int().min(0).max(100).optional(),
    killSwitch: z.boolean().optional(),
    allowRoles: z.array(z.string().trim().min(1).max(64)).max(20).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .refine(
    (payload) =>
      payload.description !== undefined ||
      payload.enabled !== undefined ||
      payload.rolloutPercent !== undefined ||
      payload.killSwitch !== undefined ||
      payload.allowRoles !== undefined ||
      payload.metadata !== undefined,
    { message: "At least one field is required." }
  );

const featureFlagEvaluateSchema = z.object({
  userId: z.string().uuid(),
  role: z.string().trim().min(1).max(80).optional(),
});

const lessonGenerationQueueQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const lessonGenerationJobTransitionParamsSchema = z.object({
  jobId: z.string().uuid(),
});

const lessonGenerationJobTransitionSchema = z.object({
  action: z.enum(["processing", "completed", "failed", "retry"]),
  error: z.string().trim().max(1000).optional(),
});

function resolveSubjectKey(input: { subject?: string; subjectKey?: string }) {
  const subject = input.subject?.trim();
  if (subject) return subject;
  const subjectKey = input.subjectKey?.trim();
  if (subjectKey) return subjectKey;
  return null;
}

type GenerateLessonInput = {
  phase: string;
  grade: number;
  subjectKey: string;
  term: number;
  week: number;
  topic?: string;
  force: boolean;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function findRepoRoot() {
  const cwd = process.cwd();
  const candidates = [cwd, path.join(cwd, ".."), path.join(cwd, "..", "..")];
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "content")) && existsSync(path.join(candidate, "packages", "shared"))) {
      return candidate;
    }
  }
  return cwd;
}

function getGeneratedLessonOutputPaths(input: GenerateLessonInput) {
  const root = path.join(findRepoRoot(), "content", "generated_lessons", "v1");
  const baseDir = path.join(
    root,
    input.phase,
    `grade-${pad2(input.grade)}`,
    input.subjectKey.trim().toLowerCase(),
    `term-${pad2(input.term)}`,
    `week-${pad2(input.week)}`
  );
  return {
    baseDir,
    lessonPath: path.join(baseDir, "lesson.json"),
    sourcesPath: path.join(baseDir, "sources.json"),
    generationPath: path.join(baseDir, "generation.md"),
  };
}

const execFileAsync = promisify(execFile);
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

async function runGenerateLessonV1(input: GenerateLessonInput) {
  const args = [
    "run",
    "rag:v1:generate",
    "-w",
    "packages/shared",
    "--",
    "--phase",
    input.phase,
    "--grade",
    String(input.grade),
    "--subject",
    input.subjectKey,
    "--term",
    String(input.term),
    "--week",
    String(input.week),
  ];
  if (input.topic) {
    args.push("--topic", input.topic);
  }
  if (input.force) {
    args.push("--force", "true");
  }

  try {
    await execFileAsync(npmCommand, args, {
      cwd: findRepoRoot(),
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (error: any) {
    const stderr = typeof error?.stderr === "string" ? error.stderr.trim() : "";
    const stdout = typeof error?.stdout === "string" ? error.stdout.trim() : "";
    const fallback = typeof error?.message === "string" ? error.message : "Generation failed";
    const detail = (stderr || stdout || fallback)
      .split(/\r?\n/)
      .map((line: string) => line.trim())
      .filter(Boolean)
      .slice(-5)
      .join(" | ");
    throw new Error(detail || "Generation failed");
  }

  return getGeneratedLessonOutputPaths(input);
}

async function runGenerateUniversityModule(input: {
  institution: string;
  faculty: string;
  course: string;
  yearOfStudy: number;
  moduleCode: string;
  moduleName?: string;
  topic?: string;
}) {
  const result = await generateUniversityModuleLesson(input);
  const paths = writeUniversityLessonFiles({ input, result });
  await upsertUniversityLesson({
    institution: input.institution,
    faculty: input.faculty,
    course: input.course,
    yearOfStudy: input.yearOfStudy,
    moduleCode: input.moduleCode,
    moduleName: input.moduleName,
    lesson: result.lesson,
    modelUsed: result.usedModel,
    promptHash: result.promptHash,
  }).catch((err) => {
    console.error("[university-lessons] DB upsert failed (non-fatal):", err?.message);
  });
  return paths;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function evaluateLessonQuality(lessonPath: string) {
  if (!existsSync(lessonPath)) {
    return {
      passed: false,
      checks: {
        hasLessonFile: false,
        citationCount: 0,
        quizQuestionCount: 0,
        sectionCount: 0,
        duplicateSectionHits: 0,
      },
      reason: "Lesson file missing after generation.",
    };
  }

  let parsed: any = null;
  try {
    parsed = JSON.parse(readFileSync(lessonPath, "utf-8"));
  } catch {
    return {
      passed: false,
      checks: {
        hasLessonFile: true,
        citationCount: 0,
        quizQuestionCount: 0,
        sectionCount: 0,
        duplicateSectionHits: 0,
      },
      reason: "Lesson JSON is invalid.",
    };
  }

  const citations = Array.isArray(parsed?.citations) ? parsed.citations.length : 0;
  const quizQuestions = Array.isArray(parsed?.quiz?.questions) ? parsed.quiz.questions.length : 0;
  const sectionGroups = ["explanation", "worked_examples", "guided_practice", "independent_practice"];
  const flatSections: string[] = [];
  for (const key of sectionGroups) {
    const entries = Array.isArray(parsed?.sections?.[key]) ? parsed.sections[key] : [];
    for (const entry of entries) {
      const content = typeof entry?.content === "string" ? normalizeText(entry.content) : "";
      if (content) flatSections.push(content);
    }
  }

  let duplicateSectionHits = 0;
  const seen = new Set<string>();
  for (const content of flatSections) {
    const signature = content.slice(0, 240);
    if (seen.has(signature)) {
      duplicateSectionHits += 1;
    } else {
      seen.add(signature);
    }
  }

  const passed = citations >= 1 && quizQuestions >= 8 && flatSections.length >= 4 && duplicateSectionHits <= 1;
  return {
    passed,
    checks: {
      hasLessonFile: true,
      citationCount: citations,
      quizQuestionCount: quizQuestions,
      sectionCount: flatSections.length,
      duplicateSectionHits,
    },
    reason: passed ? null : "Lesson did not pass quality thresholds.",
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function registerAdminRoutes(app: FastifyInstance) {
  app.get("/admin/config", { preHandler: requireAdmin }, async (_request, reply) => {
    reply.send({
      zeroRatedEndpoints: config.zeroRatedEndpoints,
    });
  });

  app.get("/admin/observability/summary", { preHandler: requireAdmin }, async (_request, reply) => {
    const memory = process.memoryUsage();
    const summary = getObservabilitySummary({
      queueLag: 0,
      memoryUsageBytes: memory.rss,
      extra: {
        heapUsedBytes: memory.heapUsed,
        heapTotalBytes: memory.heapTotal,
        externalBytes: memory.external,
        arrayBuffersBytes: memory.arrayBuffers,
        nodeVersion: process.version,
        pid: process.pid,
      },
    });
    reply.send({ summary });
  });

  app.get("/admin/feature-flags", { preHandler: requireAdmin }, async (_request, reply) => {
    const flags = await listFeatureFlags();
    reply.send({ flags });
  });

  app.put("/admin/feature-flags/:flagKey", { preHandler: requireAdmin }, async (request, reply) => {
    const parsedParams = featureFlagParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      reply.code(400).send({ error: "Invalid flag key", details: parsedParams.error.flatten() });
      return;
    }
    const parsedBody = featureFlagUpsertSchema.safeParse(request.body);
    if (!parsedBody.success) {
      reply.code(400).send({ error: "Invalid input", details: parsedBody.error.flatten() });
      return;
    }

    const before = (await listFeatureFlags()).find((flag) => flag.flag_key === parsedParams.data.flagKey) ?? null;
    const updated = await upsertFeatureFlag({
      flagKey: parsedParams.data.flagKey,
      description: parsedBody.data.description ?? before?.description ?? null,
      enabled: parsedBody.data.enabled ?? before?.enabled ?? false,
      rolloutPercent: parsedBody.data.rolloutPercent ?? before?.rollout_percent ?? 0,
      killSwitch: parsedBody.data.killSwitch ?? before?.kill_switch ?? false,
      allowRoles: parsedBody.data.allowRoles ?? before?.allow_roles ?? [],
      metadata: parsedBody.data.metadata ?? before?.metadata ?? {},
      actorId: request.user.sub,
    });
    if (!updated) {
      reply.code(500).send({ error: "Unable to update feature flag." });
      return;
    }

    await createFeatureFlagAudit({
      flagKey: updated.flag_key,
      actorId: request.user.sub,
      beforeJson: before
        ? {
            description: before.description,
            enabled: before.enabled,
            rolloutPercent: before.rollout_percent,
            killSwitch: before.kill_switch,
            allowRoles: before.allow_roles,
            metadata: before.metadata,
          }
        : {},
      afterJson: {
        description: updated.description,
        enabled: updated.enabled,
        rolloutPercent: updated.rollout_percent,
        killSwitch: updated.kill_switch,
        allowRoles: updated.allow_roles,
        metadata: updated.metadata,
      },
    });

    reply.send({ flag: updated });
  });

  app.get("/admin/feature-flags/:flagKey/audits", { preHandler: requireAdmin }, async (request, reply) => {
    const parsedParams = featureFlagParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      reply.code(400).send({ error: "Invalid flag key", details: parsedParams.error.flatten() });
      return;
    }
    const parsedQuery = featureFlagQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      reply.code(400).send({ error: "Invalid query", details: parsedQuery.error.flatten() });
      return;
    }
    const audits = await listFeatureFlagAudits(parsedParams.data.flagKey, parsedQuery.data.limit ?? 40);
    reply.send({ audits });
  });

  app.post("/admin/feature-flags/:flagKey/evaluate", { preHandler: requireAdmin }, async (request, reply) => {
    const parsedParams = featureFlagParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      reply.code(400).send({ error: "Invalid flag key", details: parsedParams.error.flatten() });
      return;
    }
    const parsedBody = featureFlagEvaluateSchema.safeParse(request.body);
    if (!parsedBody.success) {
      reply.code(400).send({ error: "Invalid input", details: parsedBody.error.flatten() });
      return;
    }
    const evaluation = await evaluateFeatureFlag({
      flagKey: parsedParams.data.flagKey,
      userId: parsedBody.data.userId,
      role: parsedBody.data.role ?? null,
    });
    reply.send({ evaluation });
  });

  app.post("/admin/lessons/v1/generate-week", { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = generateWeekSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }

    const subjectKey = resolveSubjectKey(parsed.data);
    if (!subjectKey) {
      reply.code(400).send({ error: "Missing subject key" });
      return;
    }

    const input = {
      phase: parsed.data.phase,
      grade: parsed.data.grade,
      subjectKey,
      term: parsed.data.term,
      week: parsed.data.week,
      topic: parsed.data.topic,
      force: parsed.data.force,
    };
    const outputPaths = getGeneratedLessonOutputPaths(input);
    if (!parsed.data.force && existsSync(outputPaths.lessonPath)) {
      reply.send({ ok: true, skipped: true, lessonPath: outputPaths.lessonPath });
      return;
    }

    try {
      const written = await runGenerateLessonV1(input);
      const quality = evaluateLessonQuality(written.lessonPath);
      // Best-effort: generate illustrations for any image visuals lacking a src.
      const images = await enrichLessonImages(written.lessonPath).catch(() => 0);
      if (images) console.log(`[admin] generated ${images} illustration(s) for ${written.lessonPath}`);
      reply.send({
        ok: true,
        lessonPath: written.lessonPath,
        sourcesPath: written.sourcesPath,
        quality,
      });
    } catch (error: any) {
      reply.code(500).send({ error: error?.message || "Generation failed" });
    }
  });

  app.post("/admin/university/generate-module", { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = generateUniversityModuleSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }

    const d = parsed.data;
    const repoRoot = findRepoRoot();
    const lessonPath = path.join(
      repoRoot,
      "content", "university-lessons",
      d.institution.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      d.faculty.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      d.course.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      `year-${String(d.yearOfStudy).padStart(2, "0")}`,
      d.moduleCode.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      "lesson.json"
    );

    if (!d.force) {
      const existsOnDisk = existsSync(lessonPath);
      const existsInDb = !existsOnDisk
        ? await getUniversityLesson({
            institution: d.institution,
            faculty: d.faculty,
            course: d.course,
            yearOfStudy: d.yearOfStudy,
            moduleCode: d.moduleCode,
          }).then((r) => r !== null).catch(() => false)
        : false;

      if (existsOnDisk || existsInDb) {
        reply.send({ ok: true, skipped: true, lessonPath });
        return;
      }
    }

    try {
      await runGenerateUniversityModule({
        institution: d.institution,
        faculty: d.faculty,
        course: d.course,
        yearOfStudy: d.yearOfStudy,
        moduleCode: d.moduleCode,
        moduleName: d.moduleName,
        topic: d.topic,
      });
      // Best-effort illustration enrichment for the new module lesson.
      await enrichLessonImages(lessonPath).catch(() => 0);
      reply.send({ ok: true, lessonPath });
    } catch (error: any) {
      reply.code(500).send({ error: error?.message || "Generation failed" });
    }
  });

  app.get("/admin/lessons/v1/queue", { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = lessonGenerationQueueQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }

    const jobs = await listLessonGenerationJobs(parsed.data.limit ?? 100);
    reply.send({ ok: true, jobs });
  });

  app.post("/admin/lessons/v1/queue/:jobId/transition", { preHandler: requireAdmin }, async (request, reply) => {
    const parsedParams = lessonGenerationJobTransitionParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      reply.code(400).send({ error: "Invalid job id", details: parsedParams.error.flatten() });
      return;
    }

    const parsedBody = lessonGenerationJobTransitionSchema.safeParse(request.body);
    if (!parsedBody.success) {
      reply.code(400).send({ error: "Invalid input", details: parsedBody.error.flatten() });
      return;
    }

    try {
      const job = await transitionLessonGenerationJob(
        parsedParams.data.jobId,
        parsedBody.data.action,
        parsedBody.data.error ?? null
      );
      reply.send({ ok: true, job });
    } catch (error: any) {
      const message = error?.message || "Unable to transition job";
      reply.code(message === "Job not found" ? 404 : 400).send({ error: message });
    }
  });

  app.post("/admin/lessons/v1/generate-term", { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = generateTermSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }

    const subjectKey = resolveSubjectKey(parsed.data);
    if (!subjectKey) {
      reply.code(400).send({ error: "Missing subject key" });
      return;
    }

    const requests: Array<Record<string, unknown>> = [];
    const skippedWeeks: number[] = [];
    for (let week = 1; week <= 10; week += 1) {
      const input = {
        phase: parsed.data.phase,
        grade: parsed.data.grade,
        subjectKey,
        term: parsed.data.term,
        week,
        force: parsed.data.force,
      };
      const outputPaths = getGeneratedLessonOutputPaths(input);
      if (!parsed.data.force && existsSync(outputPaths.lessonPath)) {
        skippedWeeks.push(week);
        continue;
      }
      requests.push({
        phase: input.phase,
        grade: input.grade,
        subjectKey: input.subjectKey,
        term: input.term,
        week: input.week,
        force: input.force,
        source: "admin.generate-term.v1",
      });
    }

    const jobs = await enqueueLessonGenerationJobs(requests);
    reply.send({
      ok: true,
      queuedCount: jobs.length,
      skippedWeeks,
      jobs,
    });
  });

  // -------------------------------------------------------------------------
  // User management
  // -------------------------------------------------------------------------

  app.get("/admin/users", { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = z.object({
      search: z.string().trim().min(1).max(200).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional().default(50),
      offset: z.coerce.number().int().min(0).optional().default(0),
    }).safeParse(request.query);

    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid query", details: parsed.error.flatten() });
      return;
    }

    const { search, limit, offset } = parsed.data;
    const values: unknown[] = [limit, offset];
    let whereClause = "";

    if (search) {
      values.push(`%${search.toLowerCase()}%`);
      whereClause = `WHERE lower(email) LIKE $3 OR lower(first_name || ' ' || last_name) LIKE $3`;
    }

    const result = await pool.query<{
      id: string; email: string; first_name: string; last_name: string;
      role: string; plan_type: string; plan_status: string;
      is_email_verified: boolean; is_phone_verified: boolean;
      verification_level: string; created_at: string;
    }>(
      `SELECT id, email, first_name, last_name, role, plan_type, plan_status,
              is_email_verified, is_phone_verified, verification_level, created_at
       FROM users
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      values
    );

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM users ${whereClause}`,
      search ? [values[2]] : []
    );

    reply.send({
      users: result.rows.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.first_name,
        lastName: u.last_name,
        role: u.role,
        planType: u.plan_type,
        planStatus: u.plan_status,
        isEmailVerified: u.is_email_verified,
        isPhoneVerified: u.is_phone_verified,
        verificationLevel: u.verification_level,
        createdAt: u.created_at,
      })),
      total: parseInt(countResult.rows[0]?.count ?? "0", 10),
      limit,
      offset,
    });
  });

  app.get("/admin/users/:userId", { preHandler: requireAdmin }, async (request, reply) => {
    const { userId } = request.params as { userId: string };

    const [userResult, suspensionResult] = await Promise.all([
      pool.query<{
        id: string; email: string; first_name: string; last_name: string; phone: string;
        role: string; plan_type: string; plan_status: string;
        is_email_verified: boolean; is_phone_verified: boolean;
        verification_level: string; created_at: string;
      }>(
        `SELECT id, email, first_name, last_name, phone, role, plan_type, plan_status,
                is_email_verified, is_phone_verified, verification_level, created_at
         FROM users WHERE id = $1`,
        [userId]
      ),
      pool.query<{ id: string; reason: string; ends_at: string | null; starts_at: string }>(
        `SELECT id, reason, starts_at, ends_at
         FROM user_suspensions
         WHERE user_id = $1 AND revoked_at IS NULL AND starts_at <= NOW()
           AND (ends_at IS NULL OR ends_at > NOW())
         ORDER BY starts_at DESC LIMIT 1`,
        [userId]
      ),
    ]);

    const user = userResult.rows[0];
    if (!user) {
      reply.code(404).send({ error: "User not found" });
      return;
    }

    reply.send({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        role: user.role,
        planType: user.plan_type,
        planStatus: user.plan_status,
        isEmailVerified: user.is_email_verified,
        isPhoneVerified: user.is_phone_verified,
        verificationLevel: user.verification_level,
        createdAt: user.created_at,
      },
      suspension: suspensionResult.rows[0] ?? null,
    });
  });

  app.post("/admin/users/:userId/suspend", { preHandler: requireAdmin }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const parsed = z.object({
      reason: z.string().trim().min(1).max(500),
      hours: z.coerce.number().int().min(1).max(24 * 365).optional(),
    }).safeParse(request.body);

    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }

    const endsAt = parsed.data.hours
      ? new Date(Date.now() + parsed.data.hours * 60 * 60 * 1000).toISOString()
      : null;

    // Revoke any existing suspension before creating a new one.
    await revokeActiveUserSuspensions(userId);
    const suspension = await createUserSuspension({
      userId,
      reason: parsed.data.reason,
      suspendedBy: request.user.sub,
      endsAt,
    });

    reply.code(201).send({ ok: true, suspension });
  });

  app.delete("/admin/users/:userId/suspend", { preHandler: requireAdmin }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    await revokeActiveUserSuspensions(userId);
    reply.send({ ok: true });
  });

  const auditLogQuerySchema = z.object({
    userId: z.string().uuid().optional(),
    action: z.string().trim().min(1).max(120).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  });

  app.get("/admin/audit-log", { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = auditLogQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid query", details: parsed.error.flatten() });
      return;
    }
    const { rows, total } = await listAuditLog(parsed.data);
    reply.send({ rows, total, limit: parsed.data.limit ?? 50, offset: parsed.data.offset ?? 0 });
  });

  // ── Bursary admin ──────────────────────────────────────

  // Guard the canonical vocabulary on write so admins can't persist field/year
  // tokens the finder can never surface (provider_type also has a DB CHECK, but
  // catching it here returns a clean 400 instead of a 500). Validates only the
  // keys present, so it works for both full creates and partial updates.
  const bursaryVocabError = (obj: Record<string, unknown>): string | null => {
    if (obj.provider_type != null && !PROVIDER_TYPES.includes(obj.provider_type as never)) {
      return `provider_type must be one of: ${PROVIDER_TYPES.join(", ")}`;
    }
    if (Array.isArray(obj.fields_of_study)) {
      const bad = obj.fields_of_study.map(String).find((f) => !FIELDS.includes(f as never));
      if (bad) return `Unknown field of study: "${bad}". Use a canonical field token.`;
    }
    if (Array.isArray(obj.year_levels)) {
      const bad = obj.year_levels.map(String).find((y) => !YEAR_LEVELS.includes(y as never));
      if (bad) return `Unknown year level: "${bad}". Use one of: ${YEAR_LEVELS.join(", ")}.`;
    }
    return null;
  };

  app.get("/admin/bursaries", { preHandler: requireAdmin }, async (request, reply) => {
    const q = request.query as Record<string, string>;
    const page = Math.max(1, parseInt(q.page ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(q.limit ?? "20", 10)));
    const active = q.active === "true" ? true : q.active === "false" ? false : undefined;
    const search = q.search ?? undefined;
    try {
      const result = await listAdminBursaries({ page, limit, active, search });
      reply.send(result);
    } catch {
      reply.code(500).send({ error: "admin_bursaries_fetch_failed" });
    }
  });

  app.post("/admin/bursaries", { preHandler: requireAdmin }, async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    if (!body.title || !body.provider || !body.provider_type || !body.link) {
      reply.code(400).send({ error: "title, provider, provider_type, and link are required" });
      return;
    }
    if (body.provider_type === "seta" && !body.seta_name) {
      reply.code(400).send({ error: "seta_name is required when provider_type is seta" });
      return;
    }
    const createVocabError = bursaryVocabError(body);
    if (createVocabError) {
      reply.code(400).send({ error: createVocabError });
      return;
    }
    try {
      const bursary = await createBursary({
        title: String(body.title),
        provider: String(body.provider),
        provider_type: String(body.provider_type),
        seta_name: body.seta_name ? String(body.seta_name) : null,
        fields_of_study: Array.isArray(body.fields_of_study) ? body.fields_of_study.map(String) : [],
        year_levels: Array.isArray(body.year_levels) ? body.year_levels.map(String) : [],
        needs_based: Boolean(body.needs_based),
        merit_based: Boolean(body.merit_based),
        amount_min: body.amount_min != null ? Number(body.amount_min) : null,
        amount_max: body.amount_max != null ? Number(body.amount_max) : null,
        deadline: body.deadline ? String(body.deadline) : null,
        description: body.description ? String(body.description) : null,
        requirements: Array.isArray(body.requirements) ? body.requirements.map(String) : [],
        link: String(body.link),
        is_active: body.is_active !== false,
      });
      reply.code(201).send(bursary);
    } catch {
      reply.code(500).send({ error: "bursary_create_failed" });
    }
  });

  app.put("/admin/bursaries/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    const existing = await getBursaryById(id);
    if (!existing) {
      reply.code(404).send({ error: "Bursary not found" });
      return;
    }
    const patch: Record<string, unknown> = {};
    const allowed = ["title","provider","provider_type","seta_name","fields_of_study","year_levels",
      "needs_based","merit_based","amount_min","amount_max","deadline","description","requirements","link","is_active"];
    for (const key of allowed) {
      if (key in body) patch[key] = body[key];
    }
    const updateVocabError = bursaryVocabError(patch);
    if (updateVocabError) {
      reply.code(400).send({ error: updateVocabError });
      return;
    }
    try {
      const updated = await updateBursary(id, patch);
      reply.send(updated);
    } catch {
      reply.code(500).send({ error: "bursary_update_failed" });
    }
  });

  app.delete("/admin/bursaries/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as Record<string, string>;
    const permanent = query.permanent === "true";
    const confirmHeader = request.headers["x-confirm-delete"];

    if (permanent && confirmHeader !== "permanent") {
      reply.code(400).send({ error: "Hard delete requires X-Confirm-Delete: permanent header" });
      return;
    }

    const existing = await getBursaryById(id);
    if (!existing) {
      reply.code(404).send({ error: "Bursary not found" });
      return;
    }

    try {
      if (permanent) {
        await hardDeleteBursary(id);
        reply.send({ deleted: true, permanent: true });
      } else {
        await softDeleteBursary(id);
        reply.send({ deleted: true, permanent: false });
      }
    } catch {
      reply.code(500).send({ error: "bursary_delete_failed" });
    }
  });

  // ── Email / Resend diagnostics ────────────────────────────────────────────

  app.get("/admin/email/diagnostic", { preHandler: requireAdmin }, async (_request, reply) => {
    const apiKey = config.resendApiKey;
    const emailFrom = config.emailFrom;

    const checks: Array<{ name: string; ok: boolean; detail: string }> = [];

    // 1. API key presence
    checks.push({
      name: "RESEND_API_KEY set",
      ok: Boolean(apiKey && apiKey.length > 0),
      detail: apiKey ? `Set (${apiKey.slice(0, 6)}…${apiKey.slice(-4)})` : "Missing — emails will be silently skipped",
    });

    // 2. EMAIL_FROM set
    checks.push({
      name: "EMAIL_FROM set",
      ok: Boolean(emailFrom && emailFrom.length > 0),
      detail: emailFrom || "Missing — using default fallback",
    });

    // 3. Domain extracted from FROM address
    const fromMatch = emailFrom?.match(/<(.+)>/) ?? emailFrom?.match(/(.+)/);
    const fromEmail = fromMatch?.[1]?.trim() ?? "";
    const fromDomain = fromEmail.split("@")[1] ?? "";
    checks.push({
      name: "Sending domain detected",
      ok: Boolean(fromDomain),
      detail: fromDomain || "Could not parse domain from EMAIL_FROM",
    });

    // 4. Resend API reachability + domain verification
    let resendApiOk = false;
    let resendDomainVerified: boolean | null = null;
    let resendDomainDetail = "Skipped (no API key)";
    let resendAccountDetail = "Skipped (no API key)";

    if (apiKey) {
      try {
        const domainsRes = await fetch("https://api.resend.com/domains", {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(8000),
        });
        if (domainsRes.ok) {
          resendApiOk = true;
          const domainsBody = await domainsRes.json() as { data?: Array<{ name: string; status: string }> };
          const domains: Array<{ name: string; status: string }> = domainsBody.data ?? [];
          resendAccountDetail = `Resend API reachable. ${domains.length} domain(s) registered.`;
          if (fromDomain) {
            const matched = domains.find((d) => d.name === fromDomain);
            if (matched) {
              resendDomainVerified = matched.status === "verified";
              resendDomainDetail = `${matched.name} — status: ${matched.status}`;
            } else {
              resendDomainVerified = false;
              resendDomainDetail = `${fromDomain} not found in Resend domains (${domains.map((d) => d.name).join(", ") || "none registered"})`;
            }
          } else {
            resendDomainDetail = "Cannot check — domain not parsed from EMAIL_FROM";
          }
        } else {
          const errBody = await domainsRes.json().catch(() => null) as { message?: string } | null;
          resendAccountDetail = `Resend API returned ${domainsRes.status}: ${errBody?.message ?? "unknown error"}`;
          resendDomainDetail = "Skipped (API call failed)";
        }
      } catch (err) {
        resendAccountDetail = `Resend API unreachable: ${err instanceof Error ? err.message : String(err)}`;
        resendDomainDetail = "Skipped (network error)";
      }
    }

    checks.push({
      name: "Resend API reachable",
      ok: resendApiOk,
      detail: resendAccountDetail,
    });

    checks.push({
      name: "Sending domain verified in Resend",
      ok: resendDomainVerified === true,
      detail: resendDomainDetail,
    });

    const allOk = checks.every((c) => c.ok);
    reply.send({ ok: allOk, checks, fromEmail, fromDomain });
  });

  const emailTestSendSchema = z.object({
    to: z.string().email(),
  });

  app.post("/admin/email/test-send", { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = emailTestSendSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid body", details: parsed.error.flatten() });
      return;
    }

    const apiKey = config.resendApiKey;
    if (!apiKey) {
      reply.code(503).send({ ok: false, error: "RESEND_API_KEY is not set — cannot send test email" });
      return;
    }

    const { to } = parsed.data;
    const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0a0a0a;color:#e5e5e5;padding:32px">
      <div style="max-width:480px;margin:0 auto;background:#141414;border:1px solid #2a2a2a;border-radius:12px;padding:32px">
        <p style="font-size:13px;font-weight:800;letter-spacing:.1em;color:#a3a3a3;margin:0 0 20px">SCHOOL</p>
        <h1 style="font-size:20px;margin:0 0 12px;color:#fafafa">Email diagnostic test</h1>
        <p style="color:#a3a3a3;line-height:1.65;margin:0 0 16px">
          This is a test email sent from the SCHOOL admin email diagnostic tool at ${new Date().toISOString()}.
          If you received this, Resend is configured correctly and your sending domain is verified.
        </p>
        <p style="font-size:12px;color:#525252">Sent from: ${config.emailFrom}</p>
      </div>
    </body></html>`;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: config.emailFrom, to, subject: "SCHOOL email diagnostic test", html }),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const body = await res.json() as { id?: string };
        reply.send({ ok: true, messageId: body.id ?? null, sentTo: to });
      } else {
        const errBody = await res.json().catch(() => null) as { message?: string; name?: string } | null;
        reply.code(502).send({
          ok: false,
          error: errBody?.message ?? `Resend returned ${res.status}`,
          resendError: errBody?.name ?? null,
          status: res.status,
        });
      }
    } catch (err) {
      reply.code(502).send({ ok: false, error: `Network error: ${err instanceof Error ? err.message : String(err)}` });
    }
  });

  // ----- Monetisation analytics (admin) -----
  // NOTE: the underlying summary functions live in src/db/monetisation.ts and
  // src/db/impact.ts (unit-tested directly). These routes serialise their
  // camelCase results to snake_case JSON for the admin dashboard, and require
  // an admin principal so unauthenticated calls return 401.
  const monetisationQuerySchema = z.object({
    range: z.enum(["7d", "30d"]).optional().default("7d"),
    experiment_id: z.string().uuid().optional(),
  });

  app.get("/admin/monetisation", { preHandler: requireAdmin }, async (request, reply) => {
    const query = monetisationQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.code(400).send({ error: "Invalid query" });
    }
    const summary = await getMonetisationSummary(query.data.range, {
      experimentId: query.data.experiment_id ?? null,
    });
    if (!summary) {
      return reply.code(404).send({ error: "Experiment not found" });
    }
    return reply.send({
      range: summary.range,
      range_days: summary.rangeDays,
      generated_at: summary.generatedAt,
      scope: summary.scope,
      experiment_id: summary.experimentId,
      experiment_start_date: summary.experimentStartDate,
      experiment_end_date: summary.experimentEndDate,
      total_attempts: summary.totalAttempts,
      total_unlocks: summary.totalUnlocks,
      unlock_conversion_rate: summary.unlockConversionRate,
      total_credits_spent: summary.totalCreditsSpent,
      spending_learners: summary.spendingLearners,
      average_credits_spent_per_learner: summary.averageCreditsSpentPerLearner,
      weekly_topup_count: summary.weeklyTopupCount,
      total_topup_revenue_zar: summary.totalTopupRevenueZar,
      active_learners: summary.activeLearners,
      arpu_proxy_zar: summary.arpuProxyZar,
    });
  });

  app.get("/admin/impact/inclusion", { preHandler: requireAdmin }, async (request, reply) => {
    const query = z.object({ range: z.enum(["7d", "30d"]).optional().default("7d") }).safeParse(request.query);
    if (!query.success) {
      return reply.code(400).send({ error: "Invalid query" });
    }
    const summary = await getImpactInclusionSummary(query.data.range);
    return reply.send({
      range: summary.range,
      range_days: summary.rangeDays,
      generated_at: summary.generatedAt,
      lite_mode_usage_percent: summary.liteModeUsagePercent,
      median_unlock_payload_size: summary.medianUnlockPayloadSize,
      median_learn_payload_size_proxy: summary.medianLearnPayloadSizeProxy,
      unlock_payload_sample_count: summary.unlockPayloadSampleCount,
      learn_payload_sample_count: summary.learnPayloadSampleCount,
      active_users: summary.activeUsers,
    });
  });

  app.get("/admin/learning-analytics", { preHandler: requireAdmin }, async (_request, reply) =>
    reply.code(501).send({ error: "Not implemented" })
  );
  app.get("/admin/funnels/unlock", { preHandler: requireAdmin }, async (_request, reply) =>
    reply.code(501).send({ error: "Not implemented" })
  );
  app.get("/admin/funnels/quotes", { preHandler: requireAdmin }, async (_request, reply) =>
    reply.code(501).send({ error: "Not implemented" })
  );

  app.get(
    "/admin/monetisation/experiments",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const query = z
        .object({ limit: z.coerce.number().int().min(1).max(100).optional().default(30) })
        .safeParse(request.query);
      if (!query.success) {
        return reply.code(400).send({ error: "Invalid query" });
      }
      const experiments = await listPricingExperimentsWithMetrics(query.data.limit);
      const activeId = experiments.find((e) => e.isActive)?.id ?? null;
      return reply.send({
        active_experiment_id: activeId,
        experiments: experiments.map((e) => ({
          id: e.id,
          start_date: e.startDate,
          end_date: e.endDate,
          duration_seconds: e.durationSeconds,
          is_active: e.isActive,
          metrics: {
            total_attempts: e.metrics.totalAttempts,
            total_unlocks: e.metrics.totalUnlocks,
            unlock_conversion_rate: e.metrics.unlockConversionRate,
            total_credits_spent: e.metrics.totalCreditsSpent,
            spending_learners: e.metrics.spendingLearners,
            average_credits_spent_per_learner: e.metrics.averageCreditsSpentPerLearner,
            weekly_topup_count: e.metrics.topupCount,
            total_topup_revenue_zar: e.metrics.totalTopupRevenueZar,
            active_learners: e.metrics.activeLearners,
            arpu_proxy_zar: e.metrics.arpuProxyZar,
          },
        })),
      });
    }
  );

  app.post(
    "/admin/monetisation/experiments",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const body = z
        .object({
          detailedReportPriceCredits: z.number().int().min(1),
          weeklyFreeUnlocks: z.number().int().min(0),
          bundleStructureJson: z.array(z.unknown()).optional().default([]),
        })
        .safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({ error: "Invalid input", details: body.error.flatten() });
      }
      const created = await startPricingExperiment({
        detailedReportPriceCredits: body.data.detailedReportPriceCredits,
        weeklyFreeUnlocks: body.data.weeklyFreeUnlocks,
        bundleStructureJson: body.data.bundleStructureJson,
        createdByAdmin: request.user.sub,
      });
      return reply.code(201).send(created);
    }
  );
}
