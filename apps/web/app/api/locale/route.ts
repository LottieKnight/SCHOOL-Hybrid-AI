import { NextResponse } from "next/server";
import { DEFAULT_LOCALE, isLocale, LOCALES, LOCALE_NAMES } from "@/lib/locale";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    locales: LOCALES.map((code) => ({
      code,
      label: LOCALE_NAMES[code],
      default: code === DEFAULT_LOCALE,
    })),
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const locale = (body as { locale?: unknown })?.locale;
  if (!isLocale(locale)) {
    return NextResponse.json({ error: "Unsupported locale." }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true, locale });
  response.cookies.set("NEXT_LOCALE", locale, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  return response;
}
