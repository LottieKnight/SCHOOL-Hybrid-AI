import { createHash } from "node:crypto";
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { RESEARCH_TRIAL_EVENT_TYPES } from "@saedu/shared";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import {
  appendTrialEvents,
  completeSession,
  getActiveConsent,
  getSessionForOwner,
  getStudyByCode,
  getStudyExportRows,
  getUserConsentContext,
  grantConsent,
  recordNoticingOutcome,
  recordRecallResponse,
  startSession,
  withdrawConsent,
} from "../db/research.js";

// --- Pseudonymisation helpers ----------------------------------------------
// participant_ref is a per-study pseudonym derived from the study + user id.
// It is stable within a study (supports repeat plays) but is not the user id,
// so the dataset survives account anonymisation. For production, fold a secret
// salt (config) into the hash so refs are not guessable from a known user id.

function participantRef(studyId: string, userId: string): string {
  return createHash("sha256").update(`${studyId}:${userId}`).digest("hex").slice(0, 32);
}

function hashIp(ip: string | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`ip:${ip}`).digest("hex").slice(0, 32);
}

function uaFamily(ua: string | undefined): string | null {
  if (!ua) return null;
  const match = ua.match(/Edg|SamsungBrowser|Chrome|Firefox|Safari|OPR/);
  return match ? match[0] : "Other";
}

// --- Validation ------------------------------------------------------------

const studyCodeParam = z.object({ studyCode: z.string().min(1).max(120) });
const sessionIdParam = z.object({ id: z.string().uuid() });
const consentIdParam = z.object({ consentId: z.string().uuid() });

const consentSchema = z.object({
  consentVersion: z.string().min(1).max(40).optional(),
  scope: z.record(z.unknown()).optional(),
  guardianEmail: z.string().email().max(254).optional(),
});

const withdrawSchema = z.object({
  reason: z.string().max(500).optional(),
});

const deviceSchema = z
  .object({
    viewportWidth: z.number().int().min(0).max(20000).optional(),
    viewportHeight: z.number().int().min(0).max(20000).optional(),
    devicePixelRatio: z.number().min(0).max(10).optional(),
    inputType: z.enum(["mouse", "touch", "keyboard", "unknown"]).optional(),
    refreshRateHz: z.number().min(0).max(1000).optional(),
    platform: z.enum(["web", "ios", "android"]).optional(),
    prefersReducedMotion: z.boolean().optional(),
  })
  .passthrough();

const startSessionSchema = z.object({
  condition: z.string().max(80).optional(),
  isPractice: z.boolean().optional(),
  primaryTask: z.string().max(200).optional(),
  device: deviceSchema.optional(),
});

const trialEventSchema = z.object({
  seq: z.number().int().min(0),
  eventType: z.enum(RESEARCH_TRIAL_EVENT_TYPES),
  eventTimeMs: z.number().int().min(0).max(86_400_000),
  clientTs: z.string().datetime().optional(),
  payload: z.record(z.unknown()).optional(),
});

const eventsBatchSchema = z.object({
  events: z.array(trialEventSchema).min(1).max(500),
});

const noticingSchema = z.object({
  criticalEventKey: z.string().min(1).max(80),
  noticed: z.boolean(),
  noticeLatencyMs: z.number().int().min(0).max(600_000).nullable().optional(),
  confidence: z.number().int().min(1).max(5).nullable().optional(),
  freeText: z.string().max(2000).nullable().optional(),
});

const recallSchema = z.object({
  promptKey: z.string().min(1).max(120),
  responseValue: z.unknown(),
  isCorrect: z.boolean().nullable().optional(),
  score: z.number().nullable().optional(),
});

const completeSchema = z.object({
  reportedPassCount: z.number().int().min(0).max(10_000).nullable().optional(),
  actualPassCount: z.number().int().min(0).max(10_000).nullable().optional(),
  qualityFlags: z.record(z.unknown()).optional(),
});

export async function registerResearchRoutes(app: FastifyInstance) {
  // Grant (or confirm) research consent for a study.
  app.post("/research/:studyCode/consent", { preHandler: requireAuth }, async (request, reply) => {
      // Defensive check: ensure auth middleware did not skip execution
      if (!request.user?.sub) {
        reply.code(401).send({ error: "Unauthorized" });
        return;
      }
    const params = studyCodeParam.safeParse(request.params);
    const body = consentSchema.safeParse(request.body ?? {});
    if (!params.success || !body.success) {
      reply.code(400).send({ error: "Invalid input" });
      return;
    }

    const study = await getStudyByCode(params.data.studyCode);
    if (!study || study.status !== "recruiting") {
      reply.code(404).send({ error: "Study not open for enrolment." });
      return;
    }

    const ctx = await getUserConsentContext(request.user.sub);
    if (!ctx) {
      reply.code(404).send({ error: "User not found." });
      return;
    }

    // Age gate for adult-only studies.
    if (ctx.is_minor && study.min_age >= 18) {
      reply.code(403).send({ error: "This study is restricted to adults." });
      return;
    }

    // Minors may only enrol once a guardian consent is already recorded.
    const guardianConsentRequired = ctx.is_minor;
    if (guardianConsentRequired && !ctx.parental_consent_given_at) {
      reply.code(412).send({
        error: "Guardian consent is required before a minor can enrol.",
        code: "guardian_consent_required",
      });
      return;
    }

    const ref = participantRef(study.id, request.user.sub);
    const consentVersion = body.data.consentVersion ?? study.current_consent_version;

    const existing = await getActiveConsent(study.id, ref);
    if (existing && existing.consent_version === consentVersion) {
      reply.code(200).send({ consent: existing, alreadyEnrolled: true });
      return;
    }

    const consent = await grantConsent({
      studyId: study.id,
      userId: request.user.sub,
      participantRef: ref,
      consentVersion,
      consentScope: body.data.scope ?? {},
      isMinor: ctx.is_minor,
      guardianConsentRequired,
      guardianConsentGivenAt: ctx.parental_consent_given_at,
      guardianEmail: body.data.guardianEmail ?? ctx.parent_email,
      consentIpHash: hashIp(request.ip),
      userAgentFamily: uaFamily(request.headers["user-agent"]),
    });
    reply.code(201).send({ consent });
  });

  // Withdraw consent — also halts any in-progress sessions (see db layer).
  app.post(
    "/research/consent/:consentId/withdraw",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = consentIdParam.safeParse(request.params);
      const body = withdrawSchema.safeParse(request.body ?? {});
      if (!params.success || !body.success) {
        reply.code(400).send({ error: "Invalid input" });
        return;
      }
      const consent = await withdrawConsent({
        consentId: params.data.consentId,
        userId: request.user.sub,
        reason: body.data.reason ?? null,
      });
      if (!consent) {
        reply.code(404).send({ error: "Active consent not found." });
        return;
      }
      reply.send({ consent, withdrawn: true });
    }
  );

  // Start a play-through. Requires active (non-withdrawn) consent.
  app.post("/research/:studyCode/sessions", { preHandler: requireAuth }, async (request, reply) => {
      // Defensive check: ensure auth middleware did not skip execution
      if (!request.user?.sub) {
        reply.code(401).send({ error: "Unauthorized" });
        return;
      }
    const params = studyCodeParam.safeParse(request.params);
    const body = startSessionSchema.safeParse(request.body ?? {});
    if (!params.success || !body.success) {
      reply.code(400).send({ error: "Invalid input" });
      return;
    }

    const study = await getStudyByCode(params.data.studyCode);
    if (!study || study.status !== "recruiting") {
      reply.code(404).send({ error: "Study not open." });
      return;
    }

    const ref = participantRef(study.id, request.user.sub);
    const consent = await getActiveConsent(study.id, ref);
    if (!consent) {
      reply.code(403).send({ error: "Active consent required.", code: "consent_required" });
      return;
    }
    if (consent.guardian_consent_required && !consent.guardian_consent_given_at) {
      reply
        .code(412)
        .send({ error: "Guardian consent required.", code: "guardian_consent_required" });
      return;
    }

    const session = await startSession({
      studyId: study.id,
      consentId: consent.id,
      userId: request.user.sub,
      participantRef: ref,
      condition: body.data.condition ?? null,
      stimulusVersion: study.current_stimulus_version,
      isPractice: body.data.isPractice ?? false,
      primaryTask: body.data.primaryTask ?? null,
      device: body.data.device ?? {},
    });
    reply.code(201).send({ session });
  });

  // Batched trial-event ingest (the experiment clock stream).
  app.post("/research/sessions/:id/events", { preHandler: requireAuth }, async (request, reply) => {
      // Defensive check: ensure auth middleware did not skip execution
      if (!request.user?.sub) {
        reply.code(401).send({ error: "Unauthorized" });
        return;
      }
    const params = sessionIdParam.safeParse(request.params);
    const body = eventsBatchSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      reply.code(400).send({ error: "Invalid input", details: body.success ? undefined : body.error.flatten() });
      return;
    }

    const session = await getSessionForOwner(params.data.id, request.user.sub);
    if (!session) {
      reply.code(404).send({ error: "Session not found." });
      return;
    }
    if (session.consent_withdrawn || session.status === "withdrawn") {
      reply.code(409).send({ error: "Consent withdrawn; no further data accepted.", code: "withdrawn" });
      return;
    }
    if (session.status !== "in_progress") {
      reply.code(409).send({ error: "Session already closed.", code: "closed" });
      return;
    }

    const inserted = await appendTrialEvents({
      sessionId: session.id,
      studyId: session.study_id,
      events: body.data.events,
    });
    reply.code(201).send({ inserted });
  });

  // Record a noticing outcome (inattentional-blindness measure).
  app.post(
    "/research/sessions/:id/noticing",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = sessionIdParam.safeParse(request.params);
      const body = noticingSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        reply.code(400).send({ error: "Invalid input" });
        return;
      }
      const session = await getSessionForOwner(params.data.id, request.user.sub);
      if (!session) {
        reply.code(404).send({ error: "Session not found." });
        return;
      }
      if (session.consent_withdrawn) {
        reply.code(409).send({ error: "Consent withdrawn.", code: "withdrawn" });
        return;
      }
      await recordNoticingOutcome({
        sessionId: session.id,
        studyId: session.study_id,
        outcome: body.data,
      });
      reply.code(201).send({ ok: true });
    }
  );

  // Record a post-trial recall / memory response.
  app.post("/research/sessions/:id/recall", { preHandler: requireAuth }, async (request, reply) => {
      // Defensive check: ensure auth middleware did not skip execution
      if (!request.user?.sub) {
        reply.code(401).send({ error: "Unauthorized" });
        return;
      }
    const params = sessionIdParam.safeParse(request.params);
    const body = recallSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      reply.code(400).send({ error: "Invalid input" });
      return;
    }
    const session = await getSessionForOwner(params.data.id, request.user.sub);
    if (!session) {
      reply.code(404).send({ error: "Session not found." });
      return;
    }
    if (session.consent_withdrawn) {
      reply.code(409).send({ error: "Consent withdrawn.", code: "withdrawn" });
      return;
    }
    await recordRecallResponse({
      sessionId: session.id,
      studyId: session.study_id,
      response: {
        promptKey: body.data.promptKey,
        responseValue: body.data.responseValue,
        isCorrect: body.data.isCorrect ?? null,
        score: body.data.score ?? null,
      },
    });
    reply.code(201).send({ ok: true });
  });

  // Finalise a session with the primary-task result.
  app.post(
    "/research/sessions/:id/complete",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = sessionIdParam.safeParse(request.params);
      const body = completeSchema.safeParse(request.body ?? {});
      if (!params.success || !body.success) {
        reply.code(400).send({ error: "Invalid input" });
        return;
      }
      const owned = await getSessionForOwner(params.data.id, request.user.sub);
      if (!owned) {
        reply.code(404).send({ error: "Session not found." });
        return;
      }
      if (owned.consent_withdrawn) {
        reply.code(409).send({ error: "Consent withdrawn.", code: "withdrawn" });
        return;
      }
      const session = await completeSession({
        sessionId: owned.id,
        userId: request.user.sub,
        reportedPassCount: body.data.reportedPassCount ?? null,
        actualPassCount: body.data.actualPassCount ?? null,
        qualityFlags: body.data.qualityFlags ?? {},
      });
      reply.send({ session });
    }
  );

  // Admin: de-identified analysis export for a study.
  app.get(
    "/admin/research/:studyCode/export",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const params = studyCodeParam.safeParse(request.params);
      if (!params.success) {
        reply.code(400).send({ error: "Invalid study code" });
        return;
      }
      const study = await getStudyByCode(params.data.studyCode);
      if (!study) {
        reply.code(404).send({ error: "Study not found." });
        return;
      }
      const rows = await getStudyExportRows(study.id);
      reply.send({
        study: { code: study.code, title: study.title, ethics_ref: study.ethics_ref },
        count: rows.length,
        rows,
      });
    }
  );
}
