import { NextResponse } from "next/server";
import { resolveTutorUserId, tutorCookieOptions, TUTOR_LEARNER_COOKIE } from "@/lib/tutor/identity";

export const runtime = "nodejs";

export async function POST() {
  const current = await resolveTutorUserId();
  if (current.userId) {
    return NextResponse.json({ userId: current.userId, source: current.source });
  }
  const userId = crypto.randomUUID();
  const response = NextResponse.json({ userId, source: "tutor_cookie" });
  response.cookies.set(TUTOR_LEARNER_COOKIE, userId, tutorCookieOptions());
  return response;
}
