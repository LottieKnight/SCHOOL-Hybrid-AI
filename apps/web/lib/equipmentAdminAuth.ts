import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin";
import { isSameOrigin, isValidCsrfToken } from "@/lib/csrf";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

type SafeJsonValue = any;

async function safeServerJson(res: Response): Promise<SafeJsonValue | null> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { __nonJson: true, rawSnippet: text.slice(0, 500) };
  }
}

function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
}

export async function requireAdminWebRoute(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Invalid origin" }, { status: 403 }),
    };
  }

  if (!SAFE_METHODS.has(request.method) && !isValidCsrfToken(request)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }),
    };
  }

  try {
    const res = await fetch(`${apiBase()}/auth/session`, {
      headers: { cookie: request.headers.get("cookie") || "" },
      cache: "no-store",
    });
    if (!res.ok) {
      const payload = await safeServerJson(res);
      return {
        ok: false as const,
        response: NextResponse.json(
          { error: "Unable to verify session", details: payload ?? null },
          { status: res.status || 401 }
        ),
      };
    }
    const session = await safeServerJson(res);
    if (!isAdminSession(session)) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
      };
    }
    return { ok: true as const, session };
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unable to verify admin session" }, { status: 502 }),
    };
  }
}
