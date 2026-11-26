import { cookies, headers } from "next/headers";
import { verifyToken, COOKIE_NAME } from "@/lib/server/cookieAuth";

export type UserContext = {
  userId: string | null;
  source: "header" | "cookie" | "demo" | "session" | "none";
};

function allowDemoAuthFallbacks() {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_DEMO_AUTH === "true";
}

export async function getUserContextFromRequest(): Promise<UserContext> {
  if (allowDemoAuthFallbacks()) {
    const headerStore = await headers();
    const explicit = headerStore.get("x-user-id");
    if (explicit) {
      return { userId: explicit, source: "header" };
    }

    const cookieStore = await cookies();
    const cookieUser = cookieStore.get("saedu_demo_user")?.value;
    if (cookieUser) {
      return { userId: cookieUser, source: "cookie" };
    }

    const demo = process.env.PAST_PAPERS_DEMO_USER_ID;
    if (demo) {
      return { userId: demo, source: "demo" };
    }
  }

  // Production: read the real JWT session cookie
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    const payload = await verifyToken(token).catch(() => null);
    if (payload?.sub) {
      return { userId: payload.sub, source: "session" };
    }
  }

  return { userId: null, source: "none" };
}

export async function getUserIdFromRequest() {
  const context = await getUserContextFromRequest();
  return context.userId;
}
