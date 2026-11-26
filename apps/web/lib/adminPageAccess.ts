import { isAdminSession } from "@/lib/admin";

export type AdminPageDecision =
  | { allow: true; reason: "admin" | "local-setup" }
  | { allow: false; reason: "unauthenticated" | "not-admin"; message: string };

function hostnameOf(host: string) {
  const trimmed = host.trim().toLowerCase();
  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]");
    return end > 0 ? trimmed.slice(1, end) : trimmed;
  }
  return trimmed.split(":")[0] ?? "";
}

export function isLocalAdminHost(host: string) {
  const hostname = hostnameOf(host);
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

/**
 * Server-side gate for /admin. The client AdminGate hides the UI after
 * render, which still sends server-rendered metrics to anyone who requests
 * the page. Fail closed unless the session is an admin, or this is the
 * local setup checklist in development.
 */
export function decideAdminPageAccess(input: {
  session: unknown;
  pathname: string;
  host: string;
  nodeEnv: string;
}): AdminPageDecision {
  if (isAdminSession(input.session)) {
    return { allow: true, reason: "admin" };
  }

  const pathname = input.pathname || "";
  const localSetup =
    input.nodeEnv !== "production" &&
    isLocalAdminHost(input.host) &&
    (pathname === "/admin/setup" || pathname.startsWith("/admin/setup/"));
  if (localSetup) {
    return { allow: true, reason: "local-setup" };
  }

  const session = input.session as { user?: unknown } | null;
  const signedIn = Boolean(session && typeof session === "object" && session.user);
  if (!signedIn) {
    return {
      allow: false,
      reason: "unauthenticated",
      message: "You need to sign in to access this page.",
    };
  }
  return {
    allow: false,
    reason: "not-admin",
    message: "You do not have access to this page.",
  };
}
