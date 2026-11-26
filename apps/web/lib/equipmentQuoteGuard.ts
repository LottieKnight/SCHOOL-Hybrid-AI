import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type QuoteRateBucket = {
  count: number;
  windowStart: number;
};

const RATE_LIMIT_STATE_KEY = "__saedu_equipment_quote_rate_limit__";
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_PER_WINDOW = 8;
const SENSITIVE_NOTE_KEY = /(phone|email|whatsapp|contact|address|street|name|surname|passport|id)/i;
const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_PATTERN = /\+?\d[\d\s\-()]{7,}\d/;

const quotePayloadSchema = z.object({
  items: z
    .array(
      z.object({
        slug: z.string().trim().min(1).max(200),
        quantity: z.coerce.number().int().min(1).max(20),
      })
    )
    .min(1)
    .max(100),
  requester: z.object({
    organizationName: z.string().trim().max(120).optional().default(""),
    contactEmail: z.string().trim().email().max(160),
    province: z.string().trim().max(80).optional().default(""),
  }),
  notes: z.record(z.union([z.string().trim().max(240), z.number().finite(), z.boolean()])).optional().default({}),
  website: z.string().optional(), // honeypot
  source: z.string().trim().min(1).max(80).optional().default("web"),
});

function getRateLimitStore() {
  const globalAny = globalThis as any;
  if (!globalAny[RATE_LIMIT_STATE_KEY]) {
    globalAny[RATE_LIMIT_STATE_KEY] = new Map<string, QuoteRateBucket>();
  }
  return globalAny[RATE_LIMIT_STATE_KEY] as Map<string, QuoteRateBucket>;
}

function rateLimitWindowMs() {
  const value = Number(process.env.EQUIPMENT_QUOTE_RATE_WINDOW_MS || DEFAULT_WINDOW_MS);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_WINDOW_MS;
}

function rateLimitMaxPerWindow() {
  const value = Number(process.env.EQUIPMENT_QUOTE_RATE_MAX || DEFAULT_MAX_PER_WINDOW);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_MAX_PER_WINDOW;
}

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const candidate = forwarded.split(",")[0]?.trim();
    if (candidate) return candidate;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

function checkRateLimit(clientKey: string) {
  const now = Date.now();
  const windowMs = rateLimitWindowMs();
  const maxPerWindow = rateLimitMaxPerWindow();
  const store = getRateLimitStore();
  const current = store.get(clientKey);

  if (!current || now - current.windowStart >= windowMs) {
    store.set(clientKey, { count: 1, windowStart: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= maxPerWindow) {
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - current.windowStart)) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  current.count += 1;
  store.set(clientKey, current);
  return { allowed: true, retryAfterSeconds: 0 };
}

export type ParsedEquipmentQuotePayload = z.infer<typeof quotePayloadSchema>;

function hasSensitivePii(notes: ParsedEquipmentQuotePayload["notes"]) {
  for (const [key, rawValue] of Object.entries(notes || {})) {
    if (SENSITIVE_NOTE_KEY.test(key)) return true;
    if (typeof rawValue !== "string") continue;
    if (EMAIL_PATTERN.test(rawValue) || PHONE_PATTERN.test(rawValue)) return true;
  }
  return false;
}

export async function parseAndGuardEquipmentQuoteRequest(request: NextRequest) {
  const text = await request.text().catch(() => "");
  const rawBody = (() => {
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  })();
  if (!rawBody || typeof rawBody !== "object") {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Invalid quote payload" }, { status: 400 }),
    };
  }
  const parsed = quotePayloadSchema.safeParse(rawBody);
  if (!parsed.success) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Invalid quote payload", details: parsed.error.flatten() },
        { status: 400 }
      ),
    };
  }

  if (parsed.data.website && parsed.data.website.trim().length > 0) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Rejected request." }, { status: 400 }),
    };
  }

  const normalizedNotes: ParsedEquipmentQuotePayload["notes"] = {};
  for (const [rawKey, rawValue] of Object.entries(parsed.data.notes || {})) {
    const key = rawKey.trim().slice(0, 40);
    if (!key) continue;
    normalizedNotes[key] = rawValue;
  }

  if (Object.keys(normalizedNotes).length > 12) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Too many note fields for quote request." }, { status: 400 }),
    };
  }

  if (hasSensitivePii(normalizedNotes)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Quote notes must not include personal contact details." },
        { status: 400 }
      ),
    };
  }

  const ip = getClientIp(request);
  const key = `${ip}|equipment-quote`;
  const rateCheck = checkRateLimit(key);
  if (!rateCheck.allowed) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Too many quote requests. Please try again shortly." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateCheck.retryAfterSeconds),
          },
        }
      ),
    };
  }

  return {
    ok: true as const,
    payload: {
      ...parsed.data,
      requester: {
        organizationName: parsed.data.requester.organizationName.trim() || null,
        contactEmail: parsed.data.requester.contactEmail.trim().toLowerCase(),
        province: parsed.data.requester.province.trim() || null,
      },
      notes: normalizedNotes,
    },
    client: {
      ip,
      userAgent: request.headers.get("user-agent"),
    },
  };
}
