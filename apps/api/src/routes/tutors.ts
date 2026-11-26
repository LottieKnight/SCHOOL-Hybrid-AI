import { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PassThrough } from "node:stream";
import { pipeline } from "node:stream/promises";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import {
  createRating,
  createSessionRequest,
  ensureCommissionRecord,
  flagRating,
  getPayoutSummary,
  getRatingForSession,
  getSessionWithTutor,
  getTutorById,
  getTutorByUserId,
  listPayoutHistory,
  listSessionsForUser,
  listTutorVerifications,
  listTutors,
  updateTutorVerificationStatus,
  updateSessionStatus,
  upsertTutorProfile,
} from "../db/tutors.js";
import { recomputeTutorRankingSnapshot } from "../db/tutor-ranking.js";
import {
  addTutorStrike,
  countRecentDisputes,
  createDispute,
  createRefundTransaction,
  incrementLearnerRisk,
  listDisputes,
  updateDispute,
} from "../db/policies.js";
import {
  calculateCompletion,
  calculateLearnerCancel,
  calculateNoShowLearner,
  calculateNoShowTutor,
  calculateResolution,
  calculateTutorCancel,
  isDisputeWindowOpen,
  isNoShowWindowOpen,
} from "../lib/tutor-policy.js";
import { clearDashboardSummaryCache } from "../lib/dashboard-summary.js";

const PLATFORM_INVARIANT =
  "Tutors on SCHOOL operate as independent service providers and are not employees, agents, or representatives of the platform.";

const COMPLIANCE_NOTICE = [
  "Tutors manage their own tax obligations.",
  "No PAYE withholding applies.",
  "SCHOOL acts as a facilitator, not an employer.",
];

const qualificationTypeSchema = z.enum([
  "grade_12",
  "university_student",
  "qualified_teacher",
  "retired_educator",
  "subject_specialist",
]);

const subjectSchema = z
  .object({
    subject: z.string().min(2).max(80),
    achievedPercent: z.number().min(0).max(100).optional(),
    currentlyStudying: z.boolean().optional(),
    professionallyQualified: z.boolean().optional(),
  })
  .refine(
    (value) =>
      (value.achievedPercent !== undefined && value.achievedPercent >= 60) ||
      value.currentlyStudying ||
      value.professionallyQualified,
    {
      message: "Subject eligibility requires >= 60%, currently studying, or professionally qualified.",
    }
  );

const availabilitySchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .refine((value) => value.startTime < value.endTime, {
    message: "Availability start time must be before end time.",
  });

const onboardingSchema = z.object({
  fullName: z.string().min(3).max(120),
  highestQualification: z.string().min(2).max(120),
  qualificationType: qualificationTypeSchema,
  proofOfQualificationUrl: z.string().min(6).max(500),
  proofOfQualificationName: z.string().min(1).max(200).optional(),
  deliveryMode: z.enum(["online", "in_person", "hybrid"]),
  locationCountry: z.string().min(2).max(80),
  locationProvince: z.string().min(2).max(80),
  locationCity: z.string().min(2).max(80),
  locationAddress: z.string().max(160).optional(),
  locationLat: z.number().min(-90).max(90).optional(),
  locationLng: z.number().min(-180).max(180).optional(),
  radiusKm: z.number().min(0).max(150),
  hourlyRate: z.number().min(config.minSessionPrice),
  bio: z.string().max(500).optional(),
  subjects: z.array(subjectSchema).min(1),
  availability: z.array(availabilitySchema).min(1),
  qualifications: z
    .array(
      z.object({
        qualificationType: qualificationTypeSchema,
        title: z.string().min(2).max(120),
        institution: z.string().max(160).optional(),
        yearCompleted: z.number().int().min(1950).max(2100).optional(),
        isPrimary: z.boolean().optional(),
      })
    )
    .optional(),
});

const sessionRequestSchema = z.object({
  tutorId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  price: z.number().min(config.minSessionPrice),
});

const sessionStatusSchema = z.object({
  status: z.enum(["confirmed", "completed", "cancelled", "disputed"]),
  reason: z.string().max(300).optional(),
});

const ratingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: z.string().max(500).optional(),
});

const flagSchema = z.object({
  reason: z.string().min(4).max(500),
});

const cancelSchema = z.object({
  reason: z.string().max(300).optional(),
});

const noShowSchema = z.object({
  reportedBy: z.enum(["learner", "tutor"]),
});

const disputeSchema = z.object({
  category: z.enum(["no_show", "quality", "misconduct", "billing", "other"]),
  description: z.string().min(6).max(2000),
  evidenceUploads: z.array(z.string().min(1)).optional(),
});

const disputeDecisionSchema = z.object({
  status: z.enum(["under_review", "resolved", "rejected"]),
  resolutionOutcome: z
    .enum(["uphold_tutor", "partial_refund", "full_refund", "tutor_fault", "learner_fault"])
    .optional(),
  refundAmount: z.number().min(0).optional(),
  adminNotes: z.string().max(2000).optional(),
});

const verificationDecisionSchema = z
  .object({
    status: z.enum(["approved", "rejected", "revoked"]),
    reason: z.string().max(500).optional(),
  })
  .refine((value) => value.status === "approved" || Boolean(value.reason?.trim()), {
    message: "Reason is required for rejection or revocation.",
  });

async function readFirstChunk(stream: NodeJS.ReadableStream) {
  return new Promise<Buffer>((resolve, reject) => {
    const onData = (chunk: Buffer) => {
      cleanup();
      resolve(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    };
    const onEnd = () => {
      cleanup();
      resolve(Buffer.alloc(0));
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      stream.off("data", onData);
      stream.off("end", onEnd);
      stream.off("error", onError);
    };
    stream.once("data", onData);
    stream.once("end", onEnd);
    stream.once("error", onError);
  });
}

function matchesMagicBytes(buffer: Buffer, extension: string) {
  if (extension === ".pdf") {
    return buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  }
  if (extension === ".png") {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  return false;
}

function invalidateDashboardForUsers(userIds: Array<string | null | undefined>) {
  const unique = new Set(userIds.filter((value): value is string => Boolean(value)));
  for (const userId of unique) {
    clearDashboardSummaryCache({ userId });
  }
}

function invalidateDashboardForSession(session: {
  learner_id?: string | null;
  tutor_user_id?: string | null;
}) {
  invalidateDashboardForUsers([session.learner_id, session.tutor_user_id]);
}

export async function registerTutorRoutes(app: FastifyInstance) {
  const uploadsRoot = fileURLToPath(new URL("../../uploads/tutor-qualifications", import.meta.url));

  app.get("/admin/tutor-verifications", { preHandler: requireAdmin }, async (request, reply) => {
    const query = request.query as { status?: string };
    const rawStatus = typeof query?.status === "string" ? query.status : "pending";
    const status = ["pending", "approved", "rejected", "revoked"].includes(rawStatus)
      ? (rawStatus as any)
      : "pending";
    const verifications = await listTutorVerifications(status);
    reply.send({ verifications });
  });

  app.post<{ Params: { id: string } }>(
    "/admin/tutor-verifications/:id/decision",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const parsed = verificationDecisionSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
        return;
      }

      const updated = await updateTutorVerificationStatus({
        id: request.params.id,
        status: parsed.data.status,
        reason: parsed.data.reason?.trim() ?? null,
        reviewerId: request.user.sub,
      });

      if (!updated) {
        reply.code(404).send({ error: "Verification request not found" });
        return;
      }

      if (updated.tutor_id) {
        await recomputeTutorRankingSnapshot(updated.tutor_id);
      }

      reply.send({ verification: updated });
    }
  );

  app.get("/tutors/config", async (_request, reply) => {
    reply.send({
      minSessionPrice: config.minSessionPrice,
      commissionRate: config.commissionRate,
      platformInvariant: PLATFORM_INVARIANT,
    });
  });

  app.get("/tutors/marketplace", async (request, reply) => {
    const query = request.query as {
      subject?: string;
      mode?: string;
      minRating?: string;
      learnerLat?: string;
      learnerLng?: string;
    };
    const subject = typeof query?.subject === "string" ? query.subject : undefined;
    const mode = typeof query?.mode === "string" ? query.mode : undefined;
    const minRatingRaw = typeof query?.minRating === "string" ? query.minRating : undefined;
    const parsedRating = minRatingRaw ? Number(minRatingRaw) : undefined;
    const minRating = Number.isFinite(parsedRating as number) ? parsedRating : undefined;
    const learnerLatRaw = typeof query?.learnerLat === "string" ? Number(query.learnerLat) : undefined;
    const learnerLngRaw = typeof query?.learnerLng === "string" ? Number(query.learnerLng) : undefined;
    const learnerLat = Number.isFinite(learnerLatRaw as number) ? learnerLatRaw : undefined;
    const learnerLng = Number.isFinite(learnerLngRaw as number) ? learnerLngRaw : undefined;

    const tutors = await listTutors({ subject, mode, minRating, learnerLat, learnerLng });
    reply.send({ tutors, platformInvariant: PLATFORM_INVARIANT });
  });

  app.get("/tutors/me", { preHandler: requireAuth }, async (request, reply) => {
    const tutor = await getTutorByUserId(request.user.sub);
    reply.send({
      tutor,
      platformInvariant: PLATFORM_INVARIANT,
      complianceNotice: COMPLIANCE_NOTICE,
    });
  });

  app.post("/tutors/onboard", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = onboardingSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }

    if (parsed.data.hourlyRate < config.minSessionPrice) {
      reply.code(400).send({ error: `Minimum session price is R${config.minSessionPrice} per hour.` });
      return;
    }

    for (const subject of parsed.data.subjects) {
      if (subject.subject.trim().length < 2) {
        reply.code(400).send({ error: "Subject name is required." });
        return;
      }
    }

    const tutor = await upsertTutorProfile(request.user.sub, {
      fullName: parsed.data.fullName.trim(),
      highestQualification: parsed.data.highestQualification.trim(),
      qualificationType: parsed.data.qualificationType,
      proofOfQualificationUrl: parsed.data.proofOfQualificationUrl,
      proofOfQualificationName: parsed.data.proofOfQualificationName?.trim() ?? null,
      deliveryMode: parsed.data.deliveryMode,
      locationCountry: parsed.data.locationCountry.trim(),
      locationProvince: parsed.data.locationProvince.trim(),
      locationCity: parsed.data.locationCity.trim(),
      locationAddress: parsed.data.locationAddress?.trim() ?? null,
      locationLat: parsed.data.locationLat ?? null,
      locationLng: parsed.data.locationLng ?? null,
      radiusKm: parsed.data.radiusKm,
      hourlyRate: parsed.data.hourlyRate,
      bio: parsed.data.bio?.trim() ?? null,
      subjects: parsed.data.subjects.map((subject) => ({
        subject: subject.subject.trim(),
        achievedPercent: subject.achievedPercent ?? null,
        currentlyStudying: subject.currentlyStudying ?? false,
        professionallyQualified: subject.professionallyQualified ?? false,
      })),
      availability: parsed.data.availability,
      qualifications: parsed.data.qualifications,
    });
    invalidateDashboardForUsers([request.user.sub]);

    reply.send({ tutor, platformInvariant: PLATFORM_INVARIANT, complianceNotice: COMPLIANCE_NOTICE });
  });

  app.post("/tutors/qualification-upload", { preHandler: requireAuth }, async (request, reply) => {
    const file = await request.file();
    if (!file) {
      reply.code(400).send({ error: "No file uploaded" });
      return;
    }

    const extension = path.extname(file.filename || "");
    const allowedExtensions = new Set([".pdf", ".png", ".jpg", ".jpeg"]);
    const allowedMimeTypes = new Set(["application/pdf", "image/png", "image/jpeg"]);
    if (!allowedExtensions.has(extension.toLowerCase()) || !allowedMimeTypes.has(file.mimetype)) {
      file.file.resume();
      reply.code(400).send({ error: "Unsupported file type" });
      return;
    }
    const firstChunk = await readFirstChunk(file.file);
    if (!matchesMagicBytes(firstChunk, extension.toLowerCase())) {
      file.file.resume();
      reply.code(400).send({ error: "File content does not match type" });
      return;
    }
    const safeExtension = extension && extension.length <= 10 ? extension : "";
    const fileName = `${randomUUID()}${safeExtension}`;
    const userDir = path.join(uploadsRoot, request.user.sub);
    await fs.mkdir(userDir, { recursive: true });
    const filePath = path.join(userDir, fileName);

    const passthrough = new PassThrough();
    if (firstChunk.length > 0) {
      passthrough.write(firstChunk);
    }
    file.file.pipe(passthrough);
    await pipeline(passthrough, createWriteStream(filePath));

    const fileUrl = `/api/tutors/qualification-files/${request.user.sub}/${fileName}`;

    reply.send({
      fileUrl,
      fileName: file.filename,
    });
  });

  app.get(
    "/tutors/qualification-files/:userId/:fileName",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { userId, fileName } = request.params as { userId: string; fileName: string };
      if (userId !== request.user.sub && request.user.role !== "admin") {
        reply.code(403).send({ error: "Unauthorized" });
        return;
      }
      if (fileName.includes("..")) {
        reply.code(400).send({ error: "Invalid file name" });
        return;
      }
      const filePath = path.join(uploadsRoot, userId, fileName);
      try {
        await fs.access(filePath);
      } catch {
        reply.code(404).send({ error: "File not found" });
        return;
      }
      const safeFileName = path.basename(fileName).replace(/["\\]/g, "_");
      const lowerName = safeFileName.toLowerCase();
      const contentType = lowerName.endsWith(".pdf")
        ? "application/pdf"
        : lowerName.endsWith(".png")
        ? "image/png"
        : lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")
        ? "image/jpeg"
        : "application/octet-stream";
      reply.type(contentType);
      reply.header("Content-Disposition", `attachment; filename="${safeFileName}"`);
      return reply.send(createReadStream(filePath));
    }
  );

  app.post("/tutors/sessions", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = sessionRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }

    const tutor = await getTutorById(parsed.data.tutorId);
    if (!tutor || tutor.status !== "active") {
      reply.code(404).send({ error: "Tutor not found" });
      return;
    }

    if (tutor.userId === request.user.sub) {
      reply.code(400).send({ error: "You cannot book a session with yourself." });
      return;
    }

    // POPIA §35: minors may not book in-person or hybrid sessions without verified parental consent
    if (["in_person", "hybrid"].includes(tutor.deliveryMode)) {
      const learnerRow = await pool.query<{ is_minor: boolean; parental_consent_given_at: string | null }>(
        "SELECT is_minor, parental_consent_given_at FROM users WHERE id = $1",
        [request.user.sub]
      );
      const learner = learnerRow.rows[0];
      if (learner?.is_minor && !learner.parental_consent_given_at) {
        reply.code(403).send({ error: "Parental consent is required before booking in-person sessions as a minor." });
        return;
      }
    }

    if (parsed.data.price < config.minSessionPrice) {
      reply.code(400).send({ error: `Minimum session price is R${config.minSessionPrice} per hour.` });
      return;
    }

    if (new Date(parsed.data.endTime) <= new Date(parsed.data.startTime)) {
      reply.code(400).send({ error: "Session end time must be after start time." });
      return;
    }

    const countHour = await pool.query(
      `
        SELECT COUNT(*)::int AS count
        FROM tutor_sessions
        WHERE learner_id = $1 AND created_at >= NOW() - INTERVAL '1 hour'
      `,
      [request.user.sub]
    );
    if ((countHour.rows[0]?.count ?? 0) >= config.sessionRequestLimitPerHour) {
      reply.code(429).send({ error: "Too many session requests. Try again later." });
      return;
    }
    const countDay = await pool.query(
      `
        SELECT COUNT(*)::int AS count
        FROM tutor_sessions
        WHERE learner_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'
      `,
      [request.user.sub]
    );
    if ((countDay.rows[0]?.count ?? 0) >= config.sessionRequestLimitPerDay) {
      reply.code(429).send({ error: "Daily session request limit reached." });
      return;
    }

    const session = await createSessionRequest({
      tutorId: parsed.data.tutorId,
      learnerId: request.user.sub,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      price: parsed.data.price,
    });
    invalidateDashboardForUsers([request.user.sub, tutor.userId]);

    // CPA §16: 14-day cooling-off notice for distance transactions
    reply.code(201).send({
      session,
      coolingOffNotice: "In terms of the Consumer Protection Act (South Africa), you have 14 days from booking confirmation to cancel this session without penalty if it has not yet taken place.",
    });
  });

  app.get("/tutors/sessions", { preHandler: requireAuth }, async (request, reply) => {
    const sessions = await listSessionsForUser(request.user.sub);
    reply.send({ sessions });
  });

  app.post<{ Params: { id: string } }>(
    "/tutors/sessions/:id/status",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = sessionStatusSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
        return;
      }

      const session = await getSessionWithTutor(request.params.id);
      if (!session) {
        reply.code(404).send({ error: "Session not found" });
        return;
      }

      const isTutor = session.tutor_user_id === request.user.sub;
      const isLearner = session.learner_id === request.user.sub;

      if (!isTutor && !isLearner) {
        reply.code(403).send({ error: "Unauthorized" });
        return;
      }

      const status = parsed.data.status;
      const updates: Record<string, unknown> = {};

      if (status === "confirmed") {
        if (!isTutor || session.status !== "requested") {
          reply.code(400).send({ error: "Only the tutor can confirm a requested session." });
          return;
        }
        const verification = await pool.query(
          "SELECT is_email_verified, is_phone_verified FROM users WHERE id = $1",
          [session.tutor_user_id]
        );
        const v = verification.rows[0];
        if (!v?.is_email_verified) {
          reply.code(403).send({ error: "Email verification required to confirm sessions." });
          return;
        }
        const tutorRow = await pool.query("SELECT delivery_mode FROM tutors WHERE id = $1", [session.tutor_id]);
        if (!v?.is_phone_verified && ["in_person", "hybrid"].includes(tutorRow.rows[0]?.delivery_mode)) {
          reply.code(403).send({ error: "Phone verification required for in-person sessions." });
          return;
        }
        updates.status = "confirmed";
        updates.confirmed_at = new Date().toISOString();
      }

      if (status === "completed") {
        if (!isTutor || session.status !== "confirmed") {
          reply.code(400).send({ error: "Only the tutor can complete a confirmed session." });
          return;
        }
        const outcome = calculateCompletion(Number(session.price));
        updates.status = outcome.status;
        updates.completed_at = new Date().toISOString();
        updates.payout_eligible_amount = outcome.payoutEligibleAmount;
        updates.refund_amount = outcome.refundAmount;
        updates.platform_fee_amount = outcome.platformFeeAmount;
        updates.tutor_payout_amount = outcome.tutorPayoutAmount;
      }

      if (status === "cancelled") {
        if (!["requested", "confirmed"].includes(session.status)) {
          reply.code(400).send({ error: "Only requested or confirmed sessions can be cancelled." });
          return;
        }
        updates.status = "cancelled";
        updates.cancelled_by = isTutor ? "tutor" : "learner";
        updates.cancelled_reason = parsed.data.reason ?? null;
      }

      if (status === "disputed") {
        if (!["confirmed", "completed"].includes(session.status)) {
          reply.code(400).send({ error: "Only confirmed or completed sessions can be disputed." });
          return;
        }
        updates.status = "disputed";
        updates.disputed_reason = parsed.data.reason ?? null;
      }

      const updated = await updateSessionStatus(session.id, updates);

      if (updated?.status === "completed") {
        await ensureCommissionRecord({
          id: session.id,
          price: Number(updated.payout_eligible_amount ?? session.price),
        });
        await recomputeTutorRankingSnapshot(session.tutor_id);
      }
      invalidateDashboardForSession(session);

      const responseBody: Record<string, unknown> = { session: updated };
      if (updated?.status === "confirmed") {
        responseBody.coolingOffNotice = "In terms of the Consumer Protection Act (South Africa), you have 14 days from this confirmation to cancel without penalty if the session has not yet taken place.";
      }
      reply.send(responseBody);
    }
  );

  app.post<{ Params: { id: string } }>(
    "/tutors/sessions/:id/cancel",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = cancelSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
        return;
      }
      const session = await getSessionWithTutor(request.params.id);
      if (!session) {
        reply.code(404).send({ error: "Session not found" });
        return;
      }

      const isTutor = session.tutor_user_id === request.user.sub;
      const isLearner = session.learner_id === request.user.sub;
      if (!isTutor && !isLearner) {
        reply.code(403).send({ error: "Unauthorized" });
        return;
      }
      if (!["requested", "confirmed"].includes(session.status)) {
        reply.code(400).send({ error: "Only requested or confirmed sessions can be cancelled." });
        return;
      }

      const startAt = new Date(session.scheduled_start_at ?? session.start_time).getTime();
      const hoursBefore = (startAt - Date.now()) / (1000 * 60 * 60);
      const price = Number(session.price);
      const outcome = isLearner
        ? calculateLearnerCancel(price, hoursBefore)
        : calculateTutorCancel(price, hoursBefore);

      const updates: Record<string, unknown> = {
        status: outcome.status,
        cancelled_at: new Date().toISOString(),
        cancelled_reason: parsed.data.reason ?? null,
        payout_eligible_amount: outcome.payoutEligibleAmount,
        refund_amount: outcome.refundAmount,
        platform_fee_amount: outcome.platformFeeAmount,
        tutor_payout_amount: outcome.tutorPayoutAmount,
      };

      const updated = await updateSessionStatus(session.id, updates);

      if (outcome.refundAmount > 0) {
        await createRefundTransaction({
          sessionId: session.id,
          amount: outcome.refundAmount,
          reason: "Cancellation refund",
          status: "pending",
        });
      }

      if (!isLearner && hoursBefore < config.cancellationWindowHours) {
        await addTutorStrike({
          tutorId: session.tutor_id,
          sessionId: session.id,
          reason: "late_cancel",
          points: 1,
        });
      }

      if (isLearner) {
        await incrementLearnerRisk(session.learner_id, { cancellations: 1 });
      }

      await recomputeTutorRankingSnapshot(session.tutor_id);
      invalidateDashboardForSession(session);

      reply.send({ session: updated });
    }
  );

  app.post<{ Params: { id: string } }>(
    "/tutors/sessions/:id/no-show",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = noShowSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
        return;
      }
      const session = await getSessionWithTutor(request.params.id);
      if (!session) {
        reply.code(404).send({ error: "Session not found" });
        return;
      }

      const isTutor = session.tutor_user_id === request.user.sub;
      const isLearner = session.learner_id === request.user.sub;
      if (!isTutor && !isLearner) {
        reply.code(403).send({ error: "Unauthorized" });
        return;
      }
      if (session.status !== "confirmed") {
        reply.code(400).send({ error: "No-show can only be reported after confirmation." });
        return;
      }
      const startAt = new Date(session.scheduled_start_at ?? session.start_time);
      if (!isNoShowWindowOpen(startAt)) {
        reply.code(400).send({ error: "No-show can only be reported after the grace period." });
        return;
      }

      const price = Number(session.price);
      const outcome =
        parsed.data.reportedBy === "learner" ? calculateNoShowTutor(price) : calculateNoShowLearner(price);

      const updates: Record<string, unknown> = {
        status: outcome.status,
        dispute_opened_at: new Date().toISOString(),
        payout_eligible_amount: outcome.payoutEligibleAmount,
        refund_amount: outcome.refundAmount,
        platform_fee_amount: outcome.platformFeeAmount,
        tutor_payout_amount: outcome.tutorPayoutAmount,
        completed_at: new Date().toISOString(),
      };

      const updated = await updateSessionStatus(session.id, updates);

      if (outcome.refundAmount > 0) {
        await createRefundTransaction({
          sessionId: session.id,
          amount: outcome.refundAmount,
          reason: "No-show refund",
          status: "pending",
        });
      }

      if (outcome.status === "no_show_tutor") {
        await addTutorStrike({
          tutorId: session.tutor_id,
          sessionId: session.id,
          reason: "no_show",
          points: 2,
        });
      }

      await recomputeTutorRankingSnapshot(session.tutor_id);
      invalidateDashboardForSession(session);

      reply.send({ session: updated });
    }
  );

  app.post<{ Params: { id: string } }>(
    "/tutors/sessions/:id/dispute",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = disputeSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
        return;
      }
      const session = await getSessionWithTutor(request.params.id);
      if (!session) {
        reply.code(404).send({ error: "Session not found" });
        return;
      }
      const isTutor = session.tutor_user_id === request.user.sub;
      const isLearner = session.learner_id === request.user.sub;
      if (!isTutor && !isLearner) {
        reply.code(403).send({ error: "Unauthorized" });
        return;
      }

      const endTime = new Date(session.completed_at ?? session.scheduled_end_at ?? session.end_time);
      if (!isDisputeWindowOpen(endTime)) {
        reply.code(400).send({ error: "Dispute window expired." });
        return;
      }

      const recentDisputes = await countRecentDisputes(
        isLearner ? session.learner_id : session.tutor_user_id,
        24
      );
      if (recentDisputes >= config.disputeLimitPerDay) {
        reply.code(429).send({ error: "Dispute rate limit reached." });
        return;
      }

      const dispute = await createDispute({
        sessionId: session.id,
        openedBy: isLearner ? "learner" : "tutor",
        category: parsed.data.category,
        description: parsed.data.description,
        evidenceUploads: parsed.data.evidenceUploads ?? [],
      });

      await updateSessionStatus(session.id, {
        status: "disputed",
        dispute_opened_at: new Date().toISOString(),
      });

      if (isLearner) {
        await incrementLearnerRisk(session.learner_id, { disputes: 1 });
      }

      await recomputeTutorRankingSnapshot(session.tutor_id);
      invalidateDashboardForSession(session);

      reply.code(201).send({ dispute });
    }
  );

  app.get("/admin/tutor-disputes", { preHandler: requireAdmin }, async (request, reply) => {
    const query = request.query as { status?: string };
    const disputes = await listDisputes(query?.status);
    reply.send({ disputes });
  });

  app.post<{ Params: { id: string } }>(
    "/admin/tutor-disputes/:id/resolve",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const parsed = disputeDecisionSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
        return;
      }

      const disputes = await listDisputes();
      const target = disputes.find((item) => item.id === request.params.id);
      if (!target) {
        reply.code(404).send({ error: "Dispute not found" });
        return;
      }

      const session = await getSessionWithTutor(target.session_id);
      if (!session) {
        reply.code(404).send({ error: "Session not found" });
        return;
      }

      if (parsed.data.status === "under_review") {
        const updated = await updateDispute({
          id: target.id,
          status: "under_review",
          adminNotes: parsed.data.adminNotes ?? null,
        });
        reply.send({ dispute: updated });
        return;
      }

      if (parsed.data.status === "rejected") {
        const updated = await updateDispute({
          id: target.id,
          status: "rejected",
          adminNotes: parsed.data.adminNotes ?? null,
        });
        reply.send({ dispute: updated });
        return;
      }

      const refundAmount = parsed.data.refundAmount ?? 0;
      const outcome = calculateResolution(Number(session.price), refundAmount);

      await updateSessionStatus(session.id, {
        status: "resolved",
        dispute_resolved_at: new Date().toISOString(),
        resolution_outcome: parsed.data.resolutionOutcome ?? "uphold_tutor",
        payout_eligible_amount: outcome.payoutEligibleAmount,
        refund_amount: outcome.refundAmount,
        platform_fee_amount: outcome.platformFeeAmount,
        tutor_payout_amount: outcome.tutorPayoutAmount,
      });

      if (refundAmount > 0) {
        await createRefundTransaction({
          sessionId: session.id,
          amount: refundAmount,
          reason: "Dispute refund",
          status: "pending",
        });
      }

      if (parsed.data.resolutionOutcome === "tutor_fault") {
        await addTutorStrike({
          tutorId: session.tutor_id,
          sessionId: session.id,
          reason: "misconduct",
          points: 2,
        });
      }

      const updated = await updateDispute({
        id: target.id,
        status: "resolved",
        adminNotes: parsed.data.adminNotes ?? null,
        resolvedAt: new Date().toISOString(),
      });

      await recomputeTutorRankingSnapshot(session.tutor_id);
      invalidateDashboardForSession(session);

      reply.send({ dispute: updated });
    }
  );

  app.post<{ Params: { id: string } }>(
    "/tutors/sessions/:id/rating",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = ratingSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
        return;
      }

      const session = await getSessionWithTutor(request.params.id);
      if (!session) {
        reply.code(404).send({ error: "Session not found" });
        return;
      }

      if (session.status !== "completed") {
        reply.code(400).send({ error: "Ratings can only be left after completion." });
        return;
      }

      if (session.learner_id !== request.user.sub) {
        reply.code(403).send({ error: "Only the learner can rate a session." });
        return;
      }

      const existingRating = await getRatingForSession(session.id);
      if (existingRating) {
        reply.code(409).send({ error: "Session has already been rated." });
        return;
      }

      const rating = await createRating({
        sessionId: session.id,
        tutorId: session.tutor_id,
        learnerId: request.user.sub,
        rating: parsed.data.rating,
        feedback: parsed.data.feedback ?? null,
      });

      await recomputeTutorRankingSnapshot(session.tutor_id);
      invalidateDashboardForSession(session);

      reply.code(201).send({ rating });
    }
  );

  app.post<{ Params: { id: string } }>(
    "/tutors/ratings/:id/flag",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = flagSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
        return;
      }

      const rating = await flagRating(request.params.id, parsed.data.reason);
      if (!rating) {
        reply.code(404).send({ error: "Rating not found" });
        return;
      }
      reply.send({ rating });
    }
  );

  app.get("/tutors/payouts/summary", { preHandler: requireAuth }, async (request, reply) => {
    const tutor = await getTutorByUserId(request.user.sub);
    if (!tutor) {
      reply.code(404).send({ error: "Tutor profile not found" });
      return;
    }
    const summary = await getPayoutSummary(tutor.id);
    reply.send({ summary, commissionRate: config.commissionRate });
  });

  app.get("/tutors/payouts/history", { preHandler: requireAuth }, async (request, reply) => {
    const tutor = await getTutorByUserId(request.user.sub);
    if (!tutor) {
      reply.code(404).send({ error: "Tutor profile not found" });
      return;
    }
    const history = await listPayoutHistory(tutor.id);
    reply.send({ history });
  });
}
