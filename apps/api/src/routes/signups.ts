import { FastifyInstance } from "fastify";
import { z } from "zod";
import { createSignup, findSignupByEmail } from "../db/signups.js";

const signupSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(7),
  email: z.string().email(),
});

export async function registerSignupRoutes(app: FastifyInstance) {
  app.post(
    "/signups",
    { config: { rateLimit: { max: 15, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = signupSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
        return;
      }

      const firstName = parsed.data.firstName.trim();
      const lastName = parsed.data.lastName.trim();
      const phone = parsed.data.phone.replace(/\s+/g, " ").trim();
      const email = parsed.data.email.trim().toLowerCase();

      const existing = await findSignupByEmail(email);
      if (existing) {
        reply.code(409).send({ error: "Email already registered" });
        return;
      }

      const signup = await createSignup(firstName, lastName, phone, email);
      reply.code(201).send({ signup });
    }
  );
}
