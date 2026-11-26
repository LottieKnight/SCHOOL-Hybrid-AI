import dotenv from "dotenv";
import { z } from "zod";
import { fileURLToPath } from "node:url";

const rootEnvPath = fileURLToPath(new URL("../../../.env", import.meta.url));
dotenv.config();
dotenv.config({ path: rootEnvPath });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  COOKIE_SECRET: z.string().min(1),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  SENTRY_DSN: z.string().optional().default(""),
  LOG_LEVEL: z.string().default("info"),
  METRICS_TOKEN: z.string().optional().default(""),
  ENABLE_WORKER: z
    .string()
    .optional()
    .default("false")
    .transform((value) => value === "true"),
  MIN_SESSION_PRICE: z.coerce.number().default(120),
  COMMISSION_RATE: z.coerce.number().default(0.12),
  ZERO_RATED_ENDPOINTS: z.string().optional().default(""),
  CANCELLATION_WINDOW_HOURS: z.coerce.number().default(6),
  DISPUTE_WINDOW_HOURS: z.coerce.number().default(48),
  NO_SHOW_GRACE_MINUTES: z.coerce.number().default(15),
  CANCELLATION_FEE_PERCENT: z.coerce.number().default(0.3),
  NO_SHOW_PAYOUT_PERCENT: z.coerce.number().default(0.5),
  SESSION_REQUEST_LIMIT_PER_HOUR: z.coerce.number().default(4),
  SESSION_REQUEST_LIMIT_PER_DAY: z.coerce.number().default(10),
  DISPUTE_LIMIT_PER_DAY: z.coerce.number().default(3),
  ADMIN_EMAILS: z.string().optional().default(""),
  ASSIGNMENT_REMINDER_POLL_SECONDS: z.coerce.number().default(60),
  ASSIGNMENT_REMINDER_BATCH_SIZE: z.coerce.number().default(300),
  BOOKSTORE_PAYMENT_PROVIDER: z.enum(["stub", "stripe", "payfast"]).optional().default("stub"),
  BOOKSTORE_PUBLIC_BASE_URL: z.string().optional().default(""),
  STRIPE_SECRET_KEY: z.string().optional().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),
  PAYFAST_MERCHANT_ID: z.string().optional().default(""),
  PAYFAST_MERCHANT_KEY: z.string().optional().default(""),
  PAYFAST_PASSPHRASE: z.string().optional().default(""),
  PAYFAST_SANDBOX: z
    .string()
    .optional()
    .default("true")
    .transform((v) => v === "true"),
  ALLOW_FAKE_PHONE_VERIFY: z
    .string()
    .optional()
    .default("false")
    .transform((value) => value === "true"),
  WALLET_CREDITS_PER_ZAR: z.coerce.number().positive().default(100),
  WALLET_DETAILED_REPORT_CREDITS: z.coerce.number().int().positive().default(15),
  PHONE_ENCRYPTION_KEY: z.string().optional().default(""),
  MESSAGE_ENCRYPTION_KEY: z.string().optional().default(""),
  RESEND_API_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().optional().default("SCHOOL <notifications@school.ditshego-ventures.co.za>"),
  NEXT_PUBLIC_SITE_URL: z.string().optional().default("https://school.ditshego-ventures.co.za"),
  APP_URL: z.string().optional().default("https://school.ditshego-ventures.co.za"),
  TWILIO_ACCOUNT_SID: z.string().optional().default(""),
  TWILIO_AUTH_TOKEN: z.string().optional().default(""),
  TWILIO_PHONE_NUMBER: z.string().optional().default(""),
  ALLOW_DEMO_AUTH: z
    .string()
    .optional()
    .default("false")
    .transform((value) => value === "true"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ");
  throw new Error(`Invalid environment variables: ${issues}`);
}

export const config = {
  env: parsed.data.NODE_ENV,
  isProd: parsed.data.NODE_ENV === "production",
  port: parsed.data.PORT,
  databaseUrl: parsed.data.DATABASE_URL,
  redisUrl: parsed.data.REDIS_URL,
  jwtSecret: parsed.data.JWT_SECRET,
  cookieSecret: parsed.data.COOKIE_SECRET,
  corsOrigin: parsed.data.CORS_ORIGIN,
  sentryDsn: parsed.data.SENTRY_DSN,
  logLevel: parsed.data.LOG_LEVEL,
  metricsToken: parsed.data.METRICS_TOKEN,
  enableWorker: parsed.data.ENABLE_WORKER,
  minSessionPrice: parsed.data.MIN_SESSION_PRICE,
  commissionRate: parsed.data.COMMISSION_RATE,
  zeroRatedEndpoints: parsed.data.ZERO_RATED_ENDPOINTS.split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  cancellationWindowHours: parsed.data.CANCELLATION_WINDOW_HOURS,
  disputeWindowHours: parsed.data.DISPUTE_WINDOW_HOURS,
  noShowGraceMinutes: parsed.data.NO_SHOW_GRACE_MINUTES,
  cancellationFeePercent: parsed.data.CANCELLATION_FEE_PERCENT,
  noShowPayoutPercent: parsed.data.NO_SHOW_PAYOUT_PERCENT,
  sessionRequestLimitPerHour: parsed.data.SESSION_REQUEST_LIMIT_PER_HOUR,
  sessionRequestLimitPerDay: parsed.data.SESSION_REQUEST_LIMIT_PER_DAY,
  disputeLimitPerDay: parsed.data.DISPUTE_LIMIT_PER_DAY,
  adminEmails: parsed.data.ADMIN_EMAILS.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
  assignmentReminderPollSeconds: Math.max(15, parsed.data.ASSIGNMENT_REMINDER_POLL_SECONDS),
  assignmentReminderBatchSize: Math.max(1, parsed.data.ASSIGNMENT_REMINDER_BATCH_SIZE),
  bookstorePaymentProvider: parsed.data.BOOKSTORE_PAYMENT_PROVIDER,
  bookstorePublicBaseUrl: parsed.data.BOOKSTORE_PUBLIC_BASE_URL,
  stripeSecretKey: parsed.data.STRIPE_SECRET_KEY,
  stripeWebhookSecret: parsed.data.STRIPE_WEBHOOK_SECRET,
  payfastMerchantId: parsed.data.PAYFAST_MERCHANT_ID,
  payfastMerchantKey: parsed.data.PAYFAST_MERCHANT_KEY,
  payfastPassphrase: parsed.data.PAYFAST_PASSPHRASE,
  payfastSandbox: parsed.data.PAYFAST_SANDBOX,
  // A real PayFast merchant is the only path that can move ZAR. Without all three
  // credentials the gateway rejects the request, so treat the account as unusable
  // rather than silently building an unsigned checkout.
  payfastConfigured: Boolean(
    parsed.data.PAYFAST_MERCHANT_ID &&
      parsed.data.PAYFAST_MERCHANT_KEY &&
      parsed.data.PAYFAST_PASSPHRASE,
  ),
  // Fail closed: in production a paid checkout may never be served by the stub
  // provider, which returns checkoutUrl: null and renders a success receipt for
  // an order that was never paid. This covers both an unset provider (stub) and
  // provider=payfast with incomplete credentials, which would otherwise fall
  // through the PayFast branch to the same stub.
  paidCheckoutBlocked:
    parsed.data.NODE_ENV === "production" &&
    !parsed.data.STRIPE_SECRET_KEY &&
    !(parsed.data.PAYFAST_MERCHANT_ID && parsed.data.PAYFAST_MERCHANT_KEY && parsed.data.PAYFAST_PASSPHRASE),
  allowFakePhoneVerify:
    parsed.data.NODE_ENV !== "production" && parsed.data.ALLOW_FAKE_PHONE_VERIFY,
  allowDemoAuth:
    parsed.data.NODE_ENV !== "production" && parsed.data.ALLOW_DEMO_AUTH,
  walletCreditsPerZar: parsed.data.WALLET_CREDITS_PER_ZAR,
  walletDetailedReportCredits: parsed.data.WALLET_DETAILED_REPORT_CREDITS,
  phoneEncryptionKey: parsed.data.PHONE_ENCRYPTION_KEY,
  messageEncryptionKey: parsed.data.MESSAGE_ENCRYPTION_KEY,
  resendApiKey: parsed.data.RESEND_API_KEY,
  emailFrom: parsed.data.EMAIL_FROM,
  siteUrl: parsed.data.NEXT_PUBLIC_SITE_URL,
  appUrl: parsed.data.APP_URL,
  twilioAccountSid: parsed.data.TWILIO_ACCOUNT_SID,
  twilioAuthToken: parsed.data.TWILIO_AUTH_TOKEN,
  twilioPhoneNumber: parsed.data.TWILIO_PHONE_NUMBER,
  cookieName: "saedu_session",
  csrfCookieName: "saedu_csrf",
};
