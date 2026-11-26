import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { findUserById, updateVerification } from "../../db/users.js";
import { config } from "../../config.js";
import { isTwilioEnabled, sendSms } from "../../lib/sms.js";
import { issueOtp, verifyOtp } from "../../lib/phone-otp.js";

export async function registerPhoneRoutes(app: FastifyInstance) {
  app.post(
    "/auth/verify-phone/start",
    {
      preHandler: requireAuth,
      config: { rateLimit: { max: 3, timeWindow: "10 minutes" } },
    },
    async (request, reply) => {
      const twilio = isTwilioEnabled();
      const fake = config.allowFakePhoneVerify;

      if (!twilio && !fake) {
        reply.code(501).send({
          error: "Phone verification provider is not configured.",
          code: "PHONE_VERIFY_UNAVAILABLE",
        });
        return;
      }

      const user = await findUserById(request.user.sub);
      if (!user) { reply.code(404).send({ error: "User not found" }); return; }

      if (fake) {
        reply.send({ ok: true, code: "123456" });
        return;
      }

      const phone = user.phone?.trim();
      if (!phone) {
        reply.code(400).send({ error: "No phone number on file. Update your profile first." });
        return;
      }

      try {
        const code = await issueOtp(user.id);
        await sendSms(phone, `Your SCHOOL verification code is: ${code}. It expires in 10 minutes.`);
        reply.send({ ok: true });
      } catch (err) {
        request.log.error({ err: err instanceof Error ? err.message : String(err) }, "[auth] verify-phone/start failed");
        reply.code(503).send({ error: "Unable to send verification SMS. Please try again." });
      }
    }
  );

  app.post(
    "/auth/verify-phone/confirm",
    {
      preHandler: requireAuth,
      config: { rateLimit: { max: 10, timeWindow: "10 minutes" } },
    },
    async (request, reply) => {
      const parsed = z.object({ code: z.string().min(4).max(10) }).safeParse(request.body);
      if (!parsed.success) { reply.code(400).send({ error: "Invalid code" }); return; }

      const twilio = isTwilioEnabled();
      const fake = config.allowFakePhoneVerify;

      if (!twilio && !fake) {
        reply.code(501).send({
          error: "Phone verification provider is not configured.",
          code: "PHONE_VERIFY_UNAVAILABLE",
        });
        return;
      }

      if (fake) {
        if (parsed.data.code !== "123456") { reply.code(400).send({ error: "Invalid code" }); return; }
      } else {
        const result = await verifyOtp(request.user.sub, parsed.data.code);
        if (result === "locked") { reply.code(429).send({ error: "Too many attempts. Request a new code." }); return; }
        if (result === "expired") { reply.code(400).send({ error: "Code has expired. Request a new one." }); return; }
        if (result === "invalid") { reply.code(400).send({ error: "Incorrect code. Please try again." }); return; }
      }

      const user = await updateVerification(request.user.sub, {
        is_phone_verified: true,
        verification_level: request.user.isEmailVerified ? "verified" : "basic",
      });
      if (!user) { reply.code(404).send({ error: "User not found" }); return; }
      reply.send({ ok: true });
    }
  );
}
