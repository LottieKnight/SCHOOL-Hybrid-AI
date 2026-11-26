import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin";

function getApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
}

async function fetchSession(request: NextRequest) {
  const sessionUrl = `${getApiBase()}/auth/session`;
  try {
    const response = await fetch(sessionUrl, {
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function proxyAdminLessonRequest(
  request: NextRequest,
  apiPath: string,
  options: { method: "GET" | "POST"; payload?: unknown } = { method: "GET" }
) {
  const session = await fetchSession(request);
  const admin = isAdminSession(session);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const headers: Record<string, string> = {
    cookie: request.headers.get("cookie") || "",
  };

  if (options.method !== "GET") {
    const csrfToken = typeof session?.csrfToken === "string" ? session.csrfToken : "";
    if (!csrfToken) {
      return NextResponse.json({ error: "Missing CSRF token" }, { status: 401 });
    }
    headers["Content-Type"] = "application/json";
    headers["x-csrf-token"] = csrfToken;
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBase()}${apiPath}`, {
      method: options.method,
      headers,
      cache: "no-store",
      body: options.method === "GET" ? undefined : JSON.stringify(options.payload ?? {}),
    });
  } catch {
    return NextResponse.json({ error: "Upstream API unavailable" }, { status: 503 });
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    return NextResponse.json(data || { error: "Request failed" }, { status: response.status });
  }
  return NextResponse.json(data || { ok: true });
}

export async function proxyAdminLessonGet(request: NextRequest, apiPath: string) {
  return proxyAdminLessonRequest(request, apiPath, { method: "GET" });
}

export async function proxyAdminLessonPost(request: NextRequest, apiPath: string, payload: unknown) {
  return proxyAdminLessonRequest(request, apiPath, { method: "POST", payload });
}
