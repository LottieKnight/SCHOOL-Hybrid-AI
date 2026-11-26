"use client";

import { useSession } from "./SessionProvider";

type SessionUser = {
  firstName?: string;
  lastName?: string;
  email?: string;
};

export function WelcomeBanner() {
  const { session } = useSession();
  const user = session?.user as SessionUser | undefined;

  if (!user) return null;

  const first = (user.firstName || "").trim();
  const last = (user.lastName || "").trim();
  const fullName = `${first} ${last}`.trim();
  const name = fullName || user.email || null;

  if (!name) return null;

  return <div className="welcome-banner">Welcome back to SCHOOL, {name}.</div>;
}
