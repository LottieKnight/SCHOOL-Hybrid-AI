import { FastifyInstance } from "fastify";
import { z } from "zod";
import Expo, { ExpoPushMessage } from "expo-server-sdk";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { upsertPushToken, getTokensForUsers } from "../db/pushTokens.js";

const expo = new Expo();

const registerSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(["ios", "android"]),
  deviceId: z.string().min(1).nullable().optional(),
});

const sendSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(500),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(500),
  data: z.record(z.string()).optional(),
});

export async function registerNotificationRoutes(app: FastifyInstance) {
  app.post(
    "/api/notifications/register",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = registerSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid request", details: parsed.error.flatten() });
      }

      const { token, platform, deviceId } = parsed.data;
      const userId = request.user.sub;

      if (!Expo.isExpoPushToken(token)) {
        return reply.code(400).send({ error: "Invalid Expo push token" });
      }

      await upsertPushToken(userId, token, platform, deviceId ?? null);
      return reply.code(200).send({ ok: true });
    },
  );

  // Internal-only: send push notifications to a list of users.
  app.post(
    "/api/notifications/send",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const parsed = sendSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid request", details: parsed.error.flatten() });
      }

      const { userIds, title, body, data } = parsed.data;
      const tokens = await getTokensForUsers(userIds);
      const validTokens = tokens.filter(Expo.isExpoPushToken);

      if (!validTokens.length) {
        return reply.code(200).send({ sent: 0, skipped: tokens.length });
      }

      const messages: ExpoPushMessage[] = validTokens.map((to) => ({
        to,
        title,
        body,
        data: data ?? {},
        sound: "default",
      }));

      const chunks = expo.chunkPushNotifications(messages);
      let sent = 0;
      for (const chunk of chunks) {
        try {
          await expo.sendPushNotificationsAsync(chunk);
          sent += chunk.length;
        } catch (err) {
          request.log.error({ err }, "push chunk delivery failed");
        }
      }

      return reply.code(200).send({ sent, skipped: tokens.length - sent });
    },
  );
}
