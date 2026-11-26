import { NextResponse } from "next/server";
import { LOCALES, LOCALE_NAMES, DEFAULT_LOCALE, isLocale } from "@/lib/locale";

export const runtime = "nodejs";

const COOKIE = "LESSON_LANGUAGE";

export async function GET() {
  return NextResponse.json({
    locales: LOCALES.map((code) => ({
      code,
      label: LOCALE_NAMES[code],
      default: code === DEFAULT_LOCALE,
    })),
    cookie: COOKIE,
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const language = (body as { language?: unknown })?.language;
  // Allow "en" (default) or any supported locale; unknown values fall back to default.
  const normalized = isLocale(language) ? language : DEFAULT_LOCALE;

  const response = NextResponse.json({ ok: true, language: normalized });
  response.cookies.set(COOKIE, normalized, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
