"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "@/components/SessionProvider";

type AdminCheck = {
  isAdmin: boolean;
};

type AdminGateState = "loading" | "allowed" | "denied";
type DenyReason = "unauthenticated" | "unverified" | "not_admin";

export function AdminGate({ children }: { children: React.ReactNode }) {
  const { session, loading: sessionLoading } = useSession();
  const pathname = usePathname();
  const [state, setState] = useState<AdminGateState>("loading");
  const [denyReason, setDenyReason] = useState<DenyReason>("unauthenticated");
  const allowUnverifiedInDev = process.env.NODE_ENV !== "production";
  const [allowLocalSetupBypass, setAllowLocalSetupBypass] = useState(false);
  const sessionKey = session
    ? `${session.user?.email ?? ""}|${session.user?.isEmailVerified ? "1" : "0"}|${
        session.user?.isPhoneVerified ? "1" : "0"
      }`
    : "";

  useEffect(() => {
    if (pathname === "/admin/setup") {
      setAllowLocalSetupBypass(
        ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
      );
    }
  }, [pathname]);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const response = await fetch("/api/admin/check", {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) {
          if (active) {
            setDenyReason("not_admin");
            setState("denied");
          }
          return;
        }
        const data = (await response.json()) as AdminCheck;
        if (active) {
          if (data.isAdmin) {
            setState("allowed");
          } else {
            setDenyReason("not_admin");
            setState("denied");
          }
        }
      } catch {
        if (active) {
          setDenyReason("not_admin");
          setState("denied");
        }
      }
    };
    if (!sessionLoading) {
      if (allowLocalSetupBypass) {
        setState("allowed");
        return;
      }
      if (!session) {
        setDenyReason("unauthenticated");
        setState("denied");
        return;
      }
      const isVerified = Boolean(session.user?.isEmailVerified && session.user?.isPhoneVerified);
      if (!isVerified && !allowUnverifiedInDev) {
        setDenyReason("unverified");
        setState("denied");
        return;
      }
      check();
    }
    return () => {
      active = false;
    };
  }, [allowLocalSetupBypass, allowUnverifiedInDev, session, sessionLoading, sessionKey]);

  if (state === "loading") {
    return (
      <div className="glass card card-with-back">
        <h1 className="title">Loading...</h1>
        <p className="subtitle">Checking your session.</p>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="glass card card-with-back">
        <h1 className="title">Admin only</h1>
        {denyReason === "unverified" ? (
          <p className="subtitle">Verify your email and phone to access admin tools.</p>
        ) : denyReason === "unauthenticated" ? (
          <p className="subtitle">You need to sign in to access this page.</p>
        ) : (
          <p className="subtitle">You do not have access to this page.</p>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
