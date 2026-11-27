"use client";

import { createContext, useCallback, useContext, useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/apiBase";
import { safeJson } from "@/lib/http";
import { useIdleSession } from "@/lib/useIdleSession";

type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  verificationLevel?: string;
};

type SessionAccess = {
  planType?: string | null;
  planStatus?: string | null;
};

type Session = {
  user: SessionUser;
  access?: SessionAccess | null;
  csrfToken: string;
};

type AuthState = {
  isGuest: boolean;
  isFreeUser: boolean;
  isPaidUser: boolean;
  planTier: "free" | "scholar" | "family" | "school" | "bursary" | "trial" | "";
  isScholar: boolean;
  isFamily: boolean;
  isSchool: boolean;
  isBursary: boolean;
};

function isSessionPayload(value: unknown): value is Session {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Session>;
  return Boolean(candidate.user && typeof candidate.csrfToken === "string");
}

type SessionContextValue = {
  session: Session | null;
  loading: boolean;
  refresh: () => Promise<Session | null>;
  isIdle: boolean;
  showWarning: boolean;
  resetTimer: () => void;
  authState: AuthState;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const apiBase = API_BASE;
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(`${apiBase}/auth/session`, {
        credentials: "include",
        signal: controller.signal,
      });
      if (!response.ok) {
        setSession(null);
        return null;
      }
      const data = await safeJson(response);
      if (!data || (typeof data === "object" && "__nonJson" in data)) {
        setSession(null);
        return null;
      }
      if (!isSessionPayload(data)) {
        setSession(null);
        return null;
      }
      setSession(data);
      return data;
    } catch {
      setSession(null);
      return null;
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    setLoading(true);
    loadSession();
  }, [loadSession]);

  const handleIdleLogout = useCallback(async () => {
    try {
      // Read CSRF token from the non-httpOnly cookie so the Fastify requireAuth
      // middleware accepts the POST without a 403.
      const csrfToken = document.cookie.match(/(?:^|;\s*)saedu_csrf=([^;]+)/)?.[1] ?? "";
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: { "x-csrf-token": csrfToken },
      });
    } catch { /* best-effort — cookie will still expire */ }
    try {
      const { signOutFirebase } = await import("@/lib/firebaseGoogleAuth");
      await signOutFirebase();
    } catch { /* still leave the signed-in app */ }
    setSession(null);
    router.push("/auth?session_expired=true");
  }, [router]);

  const { isIdle, showWarning, resetTimer } = useIdleSession({
    onLogout: handleIdleLogout,
    enabled: session !== null,
  });

  const authState = useMemo<AuthState>(() => {
    if (!session?.user?.id) {
      return {
        isGuest: true,
        isFreeUser: false,
        isPaidUser: false,
        planTier: "",
        isScholar: false,
        isFamily: false,
        isSchool: false,
        isBursary: false,
      };
    }

    const planType = session.access?.planType?.toLowerCase() ?? "";
    const planStatus = session.access?.planStatus?.toLowerCase() ?? "";
    const isPaidUser =
      Boolean(planType) &&
      planType !== "free" &&
      planType !== "trial" &&
      planStatus !== "canceled" &&
      planStatus !== "expired";

    const tier = (planType || "free") as AuthState["planTier"];
    return {
      isGuest: false,
      isFreeUser: !isPaidUser,
      isPaidUser,
      planTier: tier,
      isScholar: tier === "scholar",
      isFamily: tier === "family",
      isSchool: tier === "school",
      isBursary: tier === "bursary",
    };
  }, [session]);

  const value = useMemo(
    () => ({
      session,
      loading,
      refresh: async () => {
        setLoading(true);
        return loadSession();
      },
      isIdle,
      showWarning,
      resetTimer,
      authState,
    }),
    [session, loading, loadSession, isIdle, showWarning, resetTimer, authState]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
