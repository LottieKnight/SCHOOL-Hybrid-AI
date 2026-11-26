"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/components/SessionProvider";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import styles from "./HomeAuthCard.module.css";

export function HomeAuthCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, loading, refresh } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextPath = (() => {
    const value = searchParams.get("next");
    return value && value.startsWith("/") ? value : "/dashboard";
  })();

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
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Login failed.");
      }
      await refresh();
      router.push(nextPath);
      router.refresh();
    } catch (err) {
      setError(getApiErrorMessage(err, "Login failed."));
    } finally {
      setSubmitting(false);
    }
  };

  if (!loading && session?.user) {
    const user = session.user;
    return (
      <div className={styles.card}>
        <div className={styles.quickJump}>
          <span className="eyebrow" style={{ textAlign: "center", display: "block" }}>
            Welcome back
          </span>
          <h2 className={styles.title}>{user.firstName}</h2>
          <p className={styles.quickJumpTag}>You&rsquo;re signed in and ready to study.</p>
          <Link
            className={`button prestigious-shine ${styles.submitBtn}`}
            href="/dashboard"
          >
            Go to dashboard →
          </Link>
          <div className={styles.quickJumpLinks}>
            <Link href="/past-papers" className={`button ${styles.quickJumpBtn}`}>
              Past papers
            </Link>
            <Link href="/community" className={`button ${styles.quickJumpBtn}`}>
              Community
            </Link>
            <Link href="/community/games" className={`button ${styles.quickJumpBtn}`}>
              Games
            </Link>
            <Link href="/daily-quiz" className={`button ${styles.quickJumpBtn}`}>
              Daily quiz
            </Link>
          </div>
          <div className={styles.proof}>
            <span>✓ {user.firstName} {user.lastName}</span>
            <span>✓ {user.email}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.signIn}>
        <span className="eyebrow" style={{ textAlign: "center", display: "block" }}>
          Welcome back
        </span>
        <h2 className={styles.title}>Sign in to SCHOOL</h2>

        <form onSubmit={handleLogin} className={styles.form}>
          <label className={styles.field}>
            <span className={styles.label}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              className={styles.input}
            />
          </label>
          <div className={styles.field}>
            <span className={styles.label}>Password</span>
            <div className={styles.passwordWrap}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className={`${styles.input} ${styles.inputWithToggle}`}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                )}
              </button>
            </div>
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
          <button className={`button prestigious-shine ${styles.submitBtn}`} type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in →"}
          </button>
        </form>
      </div>

      <div className={styles.divider}>
        <span className={styles.dividerText}>or</span>
      </div>

      <div className={styles.signUp}>
        <p className={styles.signUpCopy}>
          New to SCHOOL? You&rsquo;re welcome to join us.
        </p>
        <Link
          className={`button prestigious-shine ${styles.signUpBtn}`}
          href={`/onboarding?returnUrl=${encodeURIComponent(nextPath)}`}
          prefetch={false}
        >
          Join free →
        </Link>
        <div className={styles.proof}>
          <span>✓ No credit card</span>
          <span>✓ Free forever</span>
          <span>✓ SA-built</span>
        </div>
      </div>

      <div className={styles.guestSection}>
        <div className={styles.divider}>
          <span className={styles.dividerText}>or</span>
        </div>
        <button
          type="button"
          className={styles.guestBtn}
          onClick={() => router.push("/past-papers")}
        >
          Continue as Guest →
        </button>
        <p className={styles.guestHint}>No account needed · limited features</p>
      </div>
    </div>
  );
}
