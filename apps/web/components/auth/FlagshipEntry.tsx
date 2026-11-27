"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SignupForm } from "@/components/SignupForm";
import { useSession } from "@/components/SessionProvider";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import type { GoogleAccount } from "@/lib/firebaseGoogleAuth";
import { readMinimalProfile } from "@/lib/minimalProfile";
import { destinationAfterGoogleSignIn, safeNextPath, shouldAutoLeaveLogin } from "@/lib/postGoogleSignIn";
import { safeReturnUrl } from "@/lib/safeReturnUrl";
import styles from "./FlagshipEntry.module.css";

type EmailPanel = "signin" | "create" | null;

function GoogleMark() {
  return (
    <svg className={styles.icon} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M5 12h14" strokeLinecap="round" />
      <path d="M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function FlagshipEntry() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, refresh } = useSession();
  const [emailPanel, setEmailPanel] = useState<EmailPanel>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const left = useRef(false);

  const requestedNext = searchParams.get("next") || searchParams.get("returnUrl");
  const nextPath = safeReturnUrl(requestedNext, "/dashboard");
  const guestPath = safeNextPath(requestedNext);
  const sessionExpired = searchParams.get("session_expired") === "true";
  const referralCode = searchParams.get("ref");
  const signingIn = googlePending || submitting;

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    const leave = async (account: GoogleAccount) => {
      if (!active || left.current) return;
      left.current = true;
      setGooglePending(true);
      setError(null);
      let profile = typeof window === "undefined" ? null : readMinimalProfile(window.localStorage);
      try {
        const { persistGoogleAccount } = await import("@/lib/persistGoogleAccount");
        profile = await persistGoogleAccount(account, session?.csrfToken);
      } catch {
        profile = profile ?? (typeof window === "undefined" ? null : readMinimalProfile(window.localStorage));
      }
      router.replace(destinationAfterGoogleSignIn({ requestedNext: nextPath, profile }));
      router.refresh();
    };

    void (async () => {
      const auth = await import("@/lib/firebaseGoogleAuth");
      const redirect = await auth.completeGoogleRedirect();
      if (!active) return;
      if (!redirect.ok) setError(redirect.message);
      if (redirect.ok && redirect.account) {
        await leave(redirect.account);
        return;
      }
      unsubscribe = auth.watchSignedInAccount((account, meta) => {
        if (!shouldAutoLeaveLogin({ source: "auth-state", initialSnapshot: meta.initial, hasAccount: true })) return;
        void leave(account);
      });
    })();

    return () => {
      active = false;
      unsubscribe();
    };
  }, [nextPath, router, session?.csrfToken]);

  const onGoogle = async () => {
    if (googlePending) return;
    setGooglePending(true);
    setError(null);
    const { continueWithGoogle } = await import("@/lib/firebaseGoogleAuth");
    const result = await continueWithGoogle();
    if (!result.ok) {
      setError(result.message);
      setGooglePending(false);
      return;
    }
    if (result.mode === "sign-in-redirect") return;
    if (left.current) return;
    left.current = true;
    try {
      const { persistGoogleAccount } = await import("@/lib/persistGoogleAccount");
      const profile = await persistGoogleAccount(result, session?.csrfToken);
      router.replace(destinationAfterGoogleSignIn({ requestedNext: nextPath, profile }));
      router.refresh();
    } catch (signInError) {
      left.current = false;
      setError(signInError instanceof Error ? signInError.message : "Google sign-in did not finish. You can try again, use email, or continue without an account.");
      setGooglePending(false);
    }
  };

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
      if (!response.ok) throw new Error(data?.error || t("loginFailed"));
      await refresh();
      router.push(guestPath);
      router.refresh();
    } catch (loginError) {
      setError(getApiErrorMessage(loginError, t("loginFailed")));
      setSubmitting(false);
    }
  };

  const togglePanel = (panel: EmailPanel) => {
    setEmailPanel((current) => (current === panel ? null : panel));
    setError(null);
  };

  return (
    <main className={styles.page} data-testid="login-screen">
      <section className={styles.card}>
        <div className={styles.hero}>
          <div className={styles.mark}>
            <span className={styles.glow} aria-hidden="true" />
            <SchoolLogo size={96} />
          </div>
          <h1 className={styles.title}>Welcome to SCHOOL</h1>
          <p className={styles.subhead}>Your lessons, past papers, and tutor history stay together.</p>
        </div>

        {sessionExpired ? <p className={styles.notice}>{t("sessionExpired")}</p> : null}
        {error ? <p className={styles.error} role="alert">{error}</p> : null}

        <div className={styles.actions}>
          <button
            className={styles.google}
            type="button"
            onClick={() => void onGoogle()}
            disabled={googlePending}
            data-testid="continue-with-google"
            aria-busy={googlePending}
          >
            {googlePending ? <span className={styles.spinner} aria-hidden="true" /> : <GoogleMark />}
            {googlePending ? "Signing you in..." : "Continue with Google"}
          </button>
          <Link className={styles.guest} href={guestPath} data-testid="continue-without-account">
            <ArrowIcon />
            Continue without an account
          </Link>
        </div>

        <div className={styles.divider} aria-hidden="true">or</div>

        <div className={styles.tabs} role="tablist" aria-label="Email">
          <button
            className={styles.tab}
            type="button"
            role="tab"
            id="email-signin-tab"
            aria-selected={emailPanel === "signin"}
            aria-controls="email-panel"
            data-testid="email-signin-tab"
            onClick={() => togglePanel("signin")}
          >
            Sign in with email
          </button>
          <button
            className={styles.tab}
            type="button"
            role="tab"
            id="email-create-tab"
            aria-selected={emailPanel === "create"}
            aria-controls="email-panel"
            data-testid="email-create-tab"
            onClick={() => togglePanel("create")}
          >
            Create account
          </button>
        </div>

        {emailPanel ? (
          <div className={styles.panel} id="email-panel" role="tabpanel" data-testid="email-panel">
            {emailPanel === "signin" ? (
              <form className={styles.form} onSubmit={handleLogin}>
                <label className={styles.field}>
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
                <div className={styles.field}>
                  <span>{t("passwordLabel")}</span>
                  <div className={styles.password}>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      className={styles.eye}
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                    >
                      <EyeIcon open={showPassword} />
                    </button>
                  </div>
                </div>
                <div className={styles.forgot}>
                  <a href="/auth/forgot-password">{t("forgotPassword")}</a>
                </div>
                <button className={styles.submit} type="submit" disabled={signingIn}>
                  {submitting ? t("signingIn") : t("signInButton")}
                </button>
              </form>
            ) : (
              <SignupForm redirectTo={guestPath} referralCode={referralCode} />
            )}
          </div>
        ) : null}

        <ul className={styles.reassure}>
          <li>Free CAPS lessons & past papers</li>
          <li>Syncs your tutor history</li>
          <li>No hoops</li>
        </ul>
      </section>
    </main>
  );
}
