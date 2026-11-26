import { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { createUser, findUserByEmail } from "../../db/users.js";
import { pool } from "../../db/pool.js";
import { ensureProfile, updateProfile } from "../../db/profile.js";
import { getSchoolById } from "../../db/schools.js";
import { getAccessStatus } from "../../lib/access.js";
import { creditWallet } from "../../db/wallet.js";
import { findReferralCodeOwner, recordReferral, REFERRAL_BONUS_CREDITS, REFEREE_WELCOME_CREDITS } from "../../db/referrals.js";
import { writeAuditLog } from "../../db/audit-log.js";
import { upsertActiveSession, listActiveSessionsForUser } from "../../db/auth-sessions.js";
import { createAuthLoginAlert } from "../../db/platform.js";
import { config } from "../../config.js";
import { setAuthCookies, getClientIp, handleAuthServiceError } from "./utils.js";
import { sendVerificationEmail, sendParentalConsentEmail } from "./tokens.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(7),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  parentalConsentAcknowledged: z.boolean().optional(),
  parentEmail: z.string().email().optional(),
  country: z.string().trim().min(2).optional().default("South Africa"),
  province: z.string().trim().min(2).optional().default("Gauteng"),
  city: z.string().trim().min(2).optional().default("Johannesburg"),
  schoolId: z.string().uuid().optional(),
  referralCode: z.string().trim().min(6).max(12).optional(),
});

export async function maybeCreateSuspiciousLoginAlert(input: {
  userId: string;
  sessionId: string;
  ipAddress: string | null;
  userAgent: string | null;
}) {
  const existing = await listActiveSessionsForUser(input.userId);
  if (!existing.length) return;
  const hasKnownIp =
    !!input.ipAddress &&
    existing.some((session) => Boolean(session.ip_address) && session.ip_address === input.ipAddress);
  if (!hasKnownIp && input.ipAddress) {
    await createAuthLoginAlert({
      userId: input.userId,
      sessionId: input.sessionId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      riskLevel: "warn",
      reason: "Login from a new IP address",
      metadata: { knownSessions: existing.length },
    });
  }
}

export async function registerRegistrationRoutes(app: FastifyInstance) {
  app.post(
    "/auth/register",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      try {
        const parsed = registerSchema.safeParse(request.body);
        if (!parsed.success) {
          reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
          return;
        }

        // POPIA §35 age gate (dateOfBirth is now mandatory):
        // under-13 blocked; 13-17 requires parental consent acknowledgment + parent email
        {
          const dob = new Date(parsed.data.dateOfBirth);
          if (isNaN(dob.getTime())) {
            reply.code(400).send({ error: "Invalid date of birth" });
            return;
          }
          const today = new Date();
          const age =
            today.getFullYear() - dob.getFullYear() -
            (today.getMonth() < dob.getMonth() ||
              (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())
              ? 1 : 0);
          if (age < 13) {
            reply.code(403).send({ error: "Users under 13 may not register in accordance with POPIA §35" });
            return;
          }
          if (age < 18 && !parsed.data.parentalConsentAcknowledged) {
            reply.code(403).send({ error: "Parental consent is required for users under 18", requiresParentalConsent: true });
            return;
          }
          if (age < 18 && !parsed.data.parentEmail) {
            reply.code(400).send({ error: "A parent or guardian email address is required for users under 18" });
            return;
          }
        }

        const email = parsed.data.email.toLowerCase();
        const existing = await findUserByEmail(email);
        if (existing) { reply.code(409).send({ error: "Email already registered" }); return; }

        const passwordHash = await bcrypt.hash(parsed.data.password, 12);
        const firstName = parsed.data.firstName.trim();
        const lastName = parsed.data.lastName.trim();
        const phone = parsed.data.phone.replace(/\s+/g, " ").trim();
        const country = parsed.data.country.trim();
        const province = parsed.data.province.trim();
        const city = parsed.data.city.trim();

        if (parsed.data.schoolId) {
          const school = await getSchoolById(parsed.data.schoolId);
          if (!school) { reply.code(400).send({ error: "School not found" }); return; }
        }

        const user = await createUser(email, passwordHash, firstName, lastName, phone, "learner", parsed.data.dateOfBirth ?? null);
        const baseName = email.split("@")[0];
        await ensureProfile(user.id, baseName);
        const onboardingMarkedAt = new Date().toISOString();
        await updateProfile(user.id, {
          country,
          province,
          city,
          school_id: parsed.data.schoolId ?? null,
          app_preferences: {
            profileSettings: {
              preferenceOnboardingStatus: "pending",
              promptedAt: onboardingMarkedAt,
              discoverableInSuggestions: true,
              allowFollowers: true,
            },
          },
        });

        if (parsed.data.referralCode) {
          try {
            const referrerId = await findReferralCodeOwner(parsed.data.referralCode);
            if (referrerId && referrerId !== user.id) {
              await Promise.all([
                creditWallet({
                  userId: referrerId,
                  amountCredits: REFERRAL_BONUS_CREDITS,
                  reason: "Referral reward — a friend joined SCHOOL",
                  refType: "referral_reward",
                  refId: user.id,
                  idempotencyKey: `referral:reward:${referrerId}:${user.id}`,
                }),
                creditWallet({
                  userId: user.id,
                  amountCredits: REFEREE_WELCOME_CREDITS,
                  reason: "Welcome bonus — joined via referral",
                  refType: "referral_welcome",
                  refId: referrerId,
                  idempotencyKey: `referral:welcome:${user.id}`,
                }),
                recordReferral(referrerId, user.id, parsed.data.referralCode),
              ]);
            }
          } catch (referralError) {
            request.log.error(
              { err: referralError instanceof Error ? referralError.message : String(referralError) },
              "[auth] referral processing failed"
            );
          }
        }

        const ipAddress = getClientIp(request);
        const userAgent = request.headers["user-agent"] ?? null;

        void writeAuditLog({ userId: user.id, actorId: user.id, action: "auth.register", ipAddress, userAgent });
        void sendVerificationEmail(request.log, user.id, user.email, user.first_name);

        if (user.is_minor && parsed.data.parentEmail) {
          const parentEmail = parsed.data.parentEmail;
          void pool.query(`UPDATE users SET parent_email = $1 WHERE id = $2`, [parentEmail, user.id]);
          void sendParentalConsentEmail(request.log, user.id, user.first_name, parentEmail);
        }

        const token = await reply.jwtSign({
          sub: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          planType: user.plan_type,
          planStatus: user.plan_status,
          isEmailVerified: user.is_email_verified,
          isPhoneVerified: user.is_phone_verified,
          verificationLevel: user.verification_level,
          isMinor: user.is_minor,
        });
        const csrfToken = randomUUID();

        setAuthCookies(reply, token, csrfToken);
        await maybeCreateSuspiciousLoginAlert({ userId: user.id, sessionId: csrfToken, ipAddress, userAgent });
        await upsertActiveSession({ userId: user.id, sessionId: csrfToken, userAgent, ipAddress });

        const access = getAccessStatus(user);
        reply.send({
          user: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            isEmailVerified: user.is_email_verified,
            isPhoneVerified: user.is_phone_verified,
            verificationLevel: user.verification_level,
          },
          access,
          csrfToken,
          token,
        });
      } catch (error) {
        handleAuthServiceError(reply, error, "register");
      }
    }
  );
}
