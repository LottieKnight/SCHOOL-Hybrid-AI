"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SignupForm } from "@/components/SignupForm";
import { useSession } from "@/components/SessionProvider";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import { safeReturnUrl } from "@/lib/safeReturnUrl";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

function AuthPageInner() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useSession();
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextPath = useMemo(
    () => safeReturnUrl(searchParams.get("next"), "/dashboard"),
    [searchParams],
  );

  const sessionExpired = searchParams.get("session_expired") === "true";
  const referralCode = searchParams.get("ref");

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || t("loginFailed"));
      }
      await refresh();
      router.push(nextPath);
      router.refresh();
    } catch (loginError) {
      setError(getApiErrorMessage(loginError, t("loginFailed")));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "32px 16px 56px",
      }}
    >
      <div style={{ width: "min(1040px, 100%)", display: "grid", gap: "24px" }}>
        <div className="glass card" style={{ display: "grid", gap: "12px" }}>
          <span className="eyebrow">{t("eyebrow")}</span>
          <h1 style={{ margin: 0 }}>{t("heading")}</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            {t("subtitle")}
          </p>
          {sessionExpired ? (
            <div className="badge">{t("sessionExpired")}</div>
          ) : null}
        </div>

        <div style={{ display: "grid", gap: "24px", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
          <section className="glass card" style={{ display: "grid", gap: "16px" }}>
            <h2 style={{ margin: 0 }}>{t("signInHeading")}</h2>
            <form onSubmit={handleLogin} style={{ display: "grid", gap: "14px" }}>
              <label style={{ display: "grid", gap: "8px" }}>
                {t("emailLabel")}
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  required
                  inputMode="email"
                  autoComplete="email"
                />
              </label>
              <div style={{ display: "grid", gap: "8px" }}>
                <span style={{ fontSize: "0.9rem" }}>{t("passwordLabel")}</span>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    required
                    autoComplete="current-password"
                    style={{ width: "100%", paddingRight: "42px", boxSizing: "border-box" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                    style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: "2px", display: "flex", alignItems: "center" }}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </div>
              <div style={{ textAlign: "right", marginTop: "-6px", marginBottom: "4px" }}>
                <a href="/auth/forgot-password" style={{ fontSize: "13px", color: "#a3a3a3" }}>
                  {t("forgotPassword")}
                </a>
              </div>
              {error ? <div className="assistant-error">{error}</div> : null}
              <button className="button" type="submit" disabled={submitting}>
                {submitting ? t("signingIn") : t("signInButton")}
              </button>
            </form>
          </section>

          <section className="glass card" style={{ display: "grid", gap: "16px" }}>
            <h2 style={{ margin: 0 }}>{t("createAccountHeading")}</h2>
            <SignupForm redirectTo={nextPath} referralCode={referralCode} />
          </section>
        </div>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageInner />
    </Suspense>
  );
}
