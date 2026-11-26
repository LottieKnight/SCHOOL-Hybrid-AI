"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import { useSession } from "./SessionProvider";

// Prompts a signed-in user who has not yet claimed a public handle to choose
// one. The handle is the ONLY identity other students see — email, phone, and
// real name stay private. Users can defer ("Maybe later") for the current
// session, but the prompt returns next session until a handle is claimed, so
// participation is gently gated on having a public identity.

const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
const DISMISS_KEY = "school:username-claim-dismissed";

function sanitize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
}

function suggestHandle(user: Record<string, unknown> | undefined): string {
  if (!user) return "";
  const first = typeof user.firstName === "string" ? user.firstName : "";
  const email = typeof user.email === "string" ? user.email : "";
  const base = (first || email.split("@")[0] || "").toString();
  return sanitize(base);
}

export function UsernameClaimPrompt() {
  const { session, loading } = useSession();
  const apiBase = API_BASE;
  const [visible, setVisible] = useState(false);
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user = (session?.user ?? undefined) as Record<string, unknown> | undefined;
  const suggestion = useMemo(() => suggestHandle(user), [user]);

  useEffect(() => {
    if (loading || !session) {
      setVisible(false);
      return;
    }
    if (typeof window !== "undefined" && window.sessionStorage.getItem(DISMISS_KEY) === "1") {
      return;
    }

    let active = true;
    fetch(`${apiBase}/profile/me`, { credentials: "include" })
      .then(async (response) => (response.ok ? ((await response.json()) as { profile?: { username?: string | null } }) : null))
      .then((data) => {
        if (!active || !data?.profile) return;
        const current = (data.profile.username ?? "").trim();
        if (!current) {
          setHandle((prev) => prev || suggestion);
          setVisible(true);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [apiBase, loading, session, suggestion]);

  const valid = HANDLE_RE.test(handle);

  const handleClaim = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session || busy) return;
    if (!valid) {
      setError("Pick 3–20 characters: lowercase letters, numbers, or underscores.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(`${apiBase}/profile/me`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json", "x-csrf-token": session.csrfToken },
        body: JSON.stringify({ username: handle }),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 409) {
        setError("That handle is already taken — try another.");
        return;
      }
      if (!response.ok) {
        throw new Error(data?.error || "Could not claim that handle.");
      }
      setVisible(false);
    } catch (claimError) {
      setError(getApiErrorMessage(claimError, "Could not claim that handle."));
    } finally {
      setBusy(false);
    }
  };

  const handleLater = () => {
    if (typeof window !== "undefined") window.sessionStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  if (!session || !visible) return null;

  return (
    <div className="profile-preferences-onboarding-overlay" role="dialog" aria-modal="true" style={{ zIndex: 1200 }}>
      <div className="profile-preferences-onboarding-card glass">
        <h3>Choose your public handle</h3>
        <p className="profile-subtitle">
          This is the only name other students see across SCHOOL. Your email, phone, and real name
          stay private — participate socially without sharing your personal details.
        </p>
        {error && <p className="profile-preferences-onboarding-error">{error}</p>}
        <form className="profile-form" onSubmit={handleClaim}>
          <label className="profile-field">
            Your handle
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span aria-hidden="true" style={{ opacity: 0.6, fontWeight: 600 }}>@</span>
              <input
                type="text"
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={handle}
                placeholder="yourhandle"
                onChange={(event) => setHandle(sanitize(event.target.value))}
                aria-invalid={handle.length > 0 && !valid}
                style={{ flex: 1 }}
              />
            </span>
          </label>
          <p className="profile-subtitle" style={{ marginTop: 0, fontSize: 12, opacity: 0.75 }}>
            3–20 characters · lowercase letters, numbers, and underscores · shown as <strong>@{handle || "yourhandle"}</strong>
          </p>
          <div className="profile-actions">
            <button className="button" type="submit" disabled={busy || !valid}>
              {busy ? "Claiming..." : "Claim handle"}
            </button>
            <button className="button" type="button" onClick={handleLater} disabled={busy}>
              Maybe later
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
