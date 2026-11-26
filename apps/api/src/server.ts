import Fastify from "fastify";
import { FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/node";
import { config } from "./config.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerBillingRoutes } from "./routes/billing.js";
import { registerFilesRoutes } from "./routes/files.js";
import { registerCatalogRoutes } from "./routes/catalog.js";
import { registerBookstoreRoutes } from "./routes/bookstore.js";
import { registerStoreRoutes } from "./routes/stores.js";
import { registerMarketplaceEconomicsRoutes } from "./routes/marketplaceEconomics.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerMetricsRoutes } from "./routes/metrics.js";
import { registerCurriculumRoutes } from "./routes/curriculum.js";
import { registerMessageRoutes } from "./routes/messages.js";
import { registerCommunityRoutes } from "./routes/community.js";
import { registerProfileRoutes } from "./routes/profile.js";
import { registerSchoolRoutes } from "./routes/schools.js";
import { registerSignupRoutes } from "./routes/signups.js";
import { registerTutorRoutes } from "./routes/tutors.js";
import { registerLessonQuizRoutes } from "./routes/lessons.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { plannerRoutes } from "./routes/planner.js";
import { registerResearchRoutes } from "./routes/research.js";
import { registerPressRoutes } from "./routes/press.js";
import { onboardingRoutes } from "./routes/onboarding.js";
import { registerApiKeyRoutes } from "./routes/api-keys.js";
import { registerInstitutionRoutes } from "./routes/institutions.js";
import { registerInstitutionImportRoutes } from "./routes/institution-import.js";
import { registerWebhookRoutes } from "./routes/webhooks.js";
import { registerEnterpriseBillingRoutes } from "./routes/enterprise-billing.js";
import { registerScimRoutes } from "./routes/scim.js";
import { registerInvoiceRoutes } from "./routes/invoices.js";
import { registerPublicBrandingRoutes } from "./routes/public-branding.js";
import { registerLtiRoutes } from "./routes/lti.js";
import { registerInstitutionAnalyticsRoutes } from "./routes/analytics/institution.js";
import { registerAdminConsoleRoutes } from "./routes/admin-console.js";
import { registerAiAdminRoutes } from "./routes/ai-admin.js";
import { registerDsarRoutes } from "./routes/dsar.js";
import { registerAuditExportRoutes } from "./routes/audit-export.js";
import { registerRetentionRoutes } from "./routes/retention.js";
import { tenantMiddleware } from "./middleware/tenant.js";
import { rbacMiddleware } from "./middleware/rbac.js";
import { registerBursaryRoutes } from "./routes/bursaries.js";
import { registerReferralRoutes } from "./routes/referrals.js";
import { registerWalletRoutes } from "./routes/wallet.js";
import { registerCreditsRoutes } from "./routes/credits.js";
import { registerBrandRoutes } from "./routes/brand.js";
import { registerBrandWebhookRoutes } from "./routes/brandWebhooks.js";
import { registerNotificationRoutes } from "./routes/notifications.js";
import { registerMusicRoutes } from "./routes/music.js";
import { registerLibraryRoutes } from "./routes/library.js";
import { registerUniversityRoutes } from "./routes/university.js";
import { brandGenerateQueue } from "./queue/brandWorkers.js";
import { startAssignmentReminderScheduler } from "./lib/assignmentReminders.js";
import { recordRequestObservation } from "./lib/observability.js";

export async function buildServer() {
  if (config.sentryDsn) {
    Sentry.init({
      dsn: config.sentryDsn,
      environment: config.env,
      tracesSampleRate: 0.1,
    });
  }

  const app = Fastify({
    logger: { level: config.logLevel },
    genReqId: (req) => (req.headers["x-request-id"] as string) || randomUUID(),
  });

  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_request, body, done) => {
      try {
        const params: Record<string, string> = {};
        for (const [key, value] of new URLSearchParams(String(body))) params[key] = value;
        done(null, params);
      } catch (err) {
        done(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );

  const allowedOrigins = config.corsOrigin.split(",").map((origin) => origin.trim());

  function isOriginAllowed(origin: string): boolean {
    return allowedOrigins.some((allowed) => {
      if (allowed.startsWith("*.")) {
        return origin.endsWith(allowed.slice(1));
      }
      return allowed === origin;
    });
  }

  await app.register(cors, {
    credentials: true,
    origin: (origin, callback) => {
      if (!origin || isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }
      // FIX: Assign statusCode 403 to prevent the ErrorHandler from defaulting to 500
      const error = new Error("Not allowed by CORS");
      (error as any).statusCode = 403;
      callback(error, false);
    },
  });

  await app.register(helmet);
  await app.register(cookie, { secret: config.cookieSecret });
  await app.register(jwt, {
    secret: config.jwtSecret,
    cookie: { cookieName: config.cookieName, signed: false },
    sign: { expiresIn: "7d" },
  });
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
  });

  app.addHook("onRequest", (request, _reply, done) => {
    (request as FastifyRequest & { _startedAtMs?: number })._startedAtMs = Date.now();
    done();
  });

  app.addHook("onSend", async (request, reply, payload) => {
    reply.header("x-request-id", request.id);

    if (config.isProd && reply.statusCode === 400 && typeof payload === "string") {
      try {
        const body = JSON.parse(payload) as unknown;
        if (body !== null && typeof body === "object" && "details" in (body as object)) {
          const { details: _removed, ...safe } = body as Record<string, unknown>;
          return JSON.stringify(safe);
        }
      } catch { /* pass through */ }
    }
    return payload;
  });

  app.addHook("onResponse", (request, reply, done) => {
    const startedAtMs = (request as FastifyRequest & { _startedAtMs?: number })._startedAtMs ?? Date.now();
    const durationMs = Math.max(0, Date.now() - startedAtMs);
    recordRequestObservation({ durationMs, statusCode: reply.statusCode });
    done();
  });

  app.addHook("onError", (request, _reply, error, done) => {
    if (config.sentryDsn) {
      // Only surface genuine server failures to Sentry. 4xx errors here are
      // expected client-driven rejections (CORS origin checks, auth middleware,
      // rate limiting) — reporting them creates noise with no debugging value.
      const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
      if (statusCode >= 500) {
        Sentry.withScope((scope) => {
          scope.setTag(
            "route",
            request.routeOptions?.url ?? String(request.url ?? "unknown")
          );
          scope.setTag("method", request.method);
          scope.setTag("statusCode", String(statusCode));
          Sentry.captureException(error);
        });
      }
    }
    request.log.error(error);
    done();
  });

  app.setErrorHandler((error, request, reply) => {
    const err = error as { statusCode?: number; message?: string };
    const statusCode = err.statusCode ?? 500;
    
    // Logic to handle specific business messages like the 18+ age restriction
    // If it's a 500, we mask the message. If it's 4xx (like 403), we show the specific reason.
    const message = statusCode >= 500 ? "Internal server error" : err.message ?? "Request failed";
    
    request.log.error({ err: error }, "Request failed");
    reply.code(statusCode).send({ error: message });
  });

  // Register core middlewares
  await app.register(tenantMiddleware);
  // Permission checks are enforced per-route via requirePermission / requireRole.
  // The global registration is a no-op decorator for `request.can(...)`.
  await app.register(rbacMiddleware);

  // Register new feature routes
  await app.register(onboardingRoutes);
  await app.register(analyticsRoutes);
  await app.register(plannerRoutes);
  await registerApiKeyRoutes(app);
  await registerInstitutionRoutes(app);
  await registerInstitutionImportRoutes(app);
  await registerWebhookRoutes(app);
  await registerEnterpriseBillingRoutes(app);
  await registerScimRoutes(app);
  await registerInvoiceRoutes(app);
  await registerPublicBrandingRoutes(app);
  await registerLtiRoutes(app);
  await registerInstitutionAnalyticsRoutes(app);
  await registerAdminConsoleRoutes(app);
  await registerAiAdminRoutes(app);
  await registerDsarRoutes(app);
  await registerAuditExportRoutes(app);
  await registerRetentionRoutes(app);

  // Existing route registrations (unchanged)
  await registerHealthRoutes(app);
  await registerMetricsRoutes(app);
  await registerAuthRoutes(app);
  await registerBillingRoutes(app);
  await registerFilesRoutes(app);
  await registerWalletRoutes(app);
  await registerCreditsRoutes(app);
  await registerCatalogRoutes(app);
  await registerStoreRoutes(app);
  await registerMarketplaceEconomicsRoutes(app);
  await registerBookstoreRoutes(app);
  await registerSignupRoutes(app);
  await registerCurriculumRoutes(app);
  await registerMessageRoutes(app);
  await registerCommunityRoutes(app);
  await registerProfileRoutes(app);
  await registerMusicRoutes(app);
  await registerSchoolRoutes(app);
  await registerTutorRoutes(app);
  await registerLessonQuizRoutes(app);
  await registerAdminRoutes(app);
  await registerResearchRoutes(app);
  await registerPressRoutes(app);
  await registerBursaryRoutes(app);
  await registerReferralRoutes(app);
  await registerNotificationRoutes(app);
  await registerLibraryRoutes(app);
  await registerUniversityRoutes(app);

  app.decorate("brandQueue", brandGenerateQueue);
  await app.register(registerBrandRoutes);
  await app.register(registerBrandWebhookRoutes);

  const assignmentReminderScheduler = startAssignmentReminderScheduler(app.log);
  app.addHook("onClose", async () => {
    assignmentReminderScheduler.stop();
  });

  return app;
}