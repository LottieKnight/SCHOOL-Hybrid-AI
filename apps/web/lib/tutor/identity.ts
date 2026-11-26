import { cookies } from "next/headers";
import { getUserContextFromRequest } from "@/lib/pastPapers/auth";

export const TUTOR_LEARNER_COOKIE = "school_tutor_learner";

export async function resolveTutorUserId() {
  const session = await getUserContextFromRequest();
  if (session.userId) return { userId: session.userId, source: session.source as string };
  const jar = await cookies();
  const anon = jar.get(TUTOR_LEARNER_COOKIE)?.value;
  if (anon) return { userId: anon, source: "tutor_cookie" };
  return { userId: null, source: "none" };
}

export function tutorCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  };
}
