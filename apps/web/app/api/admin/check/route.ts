import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin";

async function fetchSession(request: NextRequest) {
  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:4000";
  const sessionUrl = `${apiBase}/auth/session`;
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

export async function GET(request: NextRequest) {
  const session = await fetchSession(request);
  const isAdmin = isAdminSession(session);
  return NextResponse.json({ isAdmin });
}

