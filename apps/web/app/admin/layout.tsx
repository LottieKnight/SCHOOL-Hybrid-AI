import type { ReactNode } from "react";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { AdminGate } from "./AdminGate";
import { decideAdminPageAccess } from "@/lib/adminPageAccess";
import { getBackendSessionFromCookieHeader } from "@/lib/server/backendSession";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const headerStore = await headers();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
  const session = await getBackendSessionFromCookieHeader(cookieHeader).catch(() => null);
  const decision = decideAdminPageAccess({
    session,
    pathname: headerStore.get("x-pathname") ?? "",
    host: headerStore.get("host") ?? "",
    nodeEnv: process.env.NODE_ENV ?? "production",
  });

  if (!decision.allow) {
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame">
          <div className="glass card card-with-back">
            <h1 className="title">Admin only</h1>
            <p className="subtitle">{decision.message}</p>
            {decision.reason === "unauthenticated" ? (
              <p>
                <Link className="button" href="/auth/login?returnUrl=%2Fadmin">
                  Sign in
                </Link>
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="route-lock-dock">
      <div className="route-lock-frame">
        <AdminGate>{children}</AdminGate>
      </div>
    </div>
  );
}
