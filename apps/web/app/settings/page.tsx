"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import UniversityProfileSettings from "@/components/settings/UniversityProfileSettings";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import { useSession } from "@/components/SessionProvider";
import { getSoundEnabled, setSoundEnabled } from "@/lib/sounds";
import { ThemePicker } from "@/components/ThemePicker";
import { ActiveSessionsPanel } from "@/components/settings/ActiveSessionsPanel";
import { AccountSecurityPanel } from "@/components/settings/AccountSecurityPanel";
import { PushNotificationsPanel } from "@/components/settings/PushNotificationsPanel";
import { DSARRequestsPanel } from "@/components/settings/DSARRequestsPanel";
import { BursaryRedemptionPanel } from "@/components/settings/BursaryRedemptionPanel";
import { UpgradePanel } from "@/components/settings/UpgradePanel";
import { AboutLegal } from "@/components/ui/AboutLegal";
import { GoogleSyncPrompt } from "@/components/profile/GoogleSyncPrompt";
import { MinimalProfileForm } from "@/components/profile/MinimalProfileForm";

type ProfileSettings = {
  preferenceOnboardingStatus?: "pending" | "completed" | "declined";
  promptedAt?: string;
  completedAt?: string;
  declinedAt?: string;
  discoverableInSuggestions?: boolean;
  allowFollowers?: boolean;
  allowSearch?: boolean;
  allowMessages?: boolean;
  showGameScores?: boolean;
  showPresence?: boolean;
};

type ProfileResponse = {
  profile?: {
    likes?: string[];
    interests?: string[];
    favoriteBook?: string | null;
    favoriteMovie?: string | null;
    appPreferences?: {
      profileSettings?: ProfileSettings;
      language?: "en" | "zu" | "xh" | "af" | "st" | "tn" | "nso" | "ts" | "ss" | "ve" | "nr";
      personalisation?: {
        aiPersona?: "standard" | "mzansi" | "strict" | null;
      };
    };
  };
};

const PROFILE_TAG_LIMIT = 20;

const parseList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export default function SettingsPage() {
  const { session } = useSession();
  const apiBase = API_BASE;
  const router = useRouter();
  const t = useTranslations("settings");
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Handle Stripe top-up return redirect: /settings?walletTopup=<id>&session_id=<id> (success)
  // or /settings?walletTopup=<id>&canceled=1 (cancel)
  useEffect(() => {
    const topupId = searchParams.get("walletTopup");
    if (!topupId) return;

    const canceled = searchParams.get("canceled");
    if (canceled === "1") {
      setNotice({ type: "info", message: "Payment cancelled — your wallet was not charged." });
    } else {
      setNotice({
        type: "success",
        message: "Payment successful! Your Scholar Credits will appear in your wallet within a few seconds.",
      });
    }

    // Remove the Stripe return params from the URL without a page reload.
    const clean = new URLSearchParams(searchParams.toString());
    clean.delete("walletTopup");
    clean.delete("session_id");
    clean.delete("canceled");
    const next = clean.size > 0 ? `/settings?${clean.toString()}` : "/settings";
    router.replace(next);
  }, [router, searchParams]);

  // Handle PayFast subscription return: /settings?plan=<tier>&status=success|cancel
  // The plan is applied by the ITN handler, not this redirect, so re-fetch the
  // session to pick it up and tell the user to wait if it has not landed yet.
  useEffect(() => {
    const plan = searchParams.get("plan");
    const status = searchParams.get("status");
    if (!plan || !status) return;

    if (status === "success") {
      setNotice({
        type: "success",
        message: "Payment received! Your plan will activate within a few seconds.",
      });
      router.refresh();
    } else {
      setNotice({ type: "info", message: "Checkout cancelled — you were not charged." });
    }

    const clean = new URLSearchParams(searchParams.toString());
    clean.delete("plan");
    clean.delete("status");
    const next = clean.size > 0 ? `/settings?${clean.toString()}` : "/settings";
    router.replace(next);
  }, [router, searchParams]);
  const [favoriteBook, setFavoriteBook] = useState("");
  const [favoriteMovie, setFavoriteMovie] = useState("");
  const [likes, setLikes] = useState("");
  const [interests, setInterests] = useState("");
  const [discoverableInSuggestions, setDiscoverableInSuggestions] = useState(true);
  const [allowFollowers, setAllowFollowers] = useState(true);
  const [allowSearch, setAllowSearch] = useState(true);
  const [allowMessages, setAllowMessages] = useState(true);
  const [showGameScores, setShowGameScores] = useState(true);
  const [showPresence, setShowPresence] = useState(true);
  const [aiPersona, setAiPersona] = useState<"standard" | "mzansi" | "strict">("standard");
  const [appLanguage, setAppLanguage] = useState<"en" | "zu" | "xh" | "af" | "st" | "tn" | "nso" | "ts" | "ss" | "ve" | "nr">("en");
  const [profileSettings, setProfileSettings] = useState<ProfileSettings | undefined>(undefined);
  const [soundEnabled, setSoundEnabledState] = useState(false);
  const soundInitialized = useRef(false);

  const likesTokens = useMemo(() => parseList(likes), [likes]);
  const interestTokens = useMemo(() => parseList(interests), [interests]);

  const loadSettings = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/profile/me`, { credentials: "include" });
      const data = (await response.json().catch(() => null)) as ProfileResponse | null;
      if (!response.ok || !data?.profile) {
        throw new Error("Unable to load settings.");
      }
      const nextSettings = data.profile.appPreferences?.profileSettings;
      setProfileSettings(nextSettings);
      setFavoriteBook(data.profile.favoriteBook ?? "");
      setFavoriteMovie(data.profile.favoriteMovie ?? "");
      setLikes(data.profile.likes?.join(", ") ?? "");
      setInterests(data.profile.interests?.join(", ") ?? "");
      setDiscoverableInSuggestions(nextSettings?.discoverableInSuggestions ?? true);
      setAllowFollowers(nextSettings?.allowFollowers ?? true);
      setAllowSearch(nextSettings?.allowSearch ?? true);
      setAllowMessages(nextSettings?.allowMessages ?? true);
      setShowGameScores(nextSettings?.showGameScores ?? true);
      setShowPresence(nextSettings?.showPresence ?? true);
      setAiPersona(data.profile.appPreferences?.personalisation?.aiPersona ?? "standard");
      setAppLanguage((data.profile.appPreferences?.language as any) ?? "en");
    } catch (error) {
      setNotice({
        type: "error",
        message: getApiErrorMessage(error, "Unable to load settings."),
      });
    } finally {
      setLoading(false);
    }
  }, [apiBase, session]);

  useEffect(() => {
    if (!session) return;
    void loadSettings();
  }, [loadSettings, session]);

  useEffect(() => {
    if (soundInitialized.current) return;
    soundInitialized.current = true;
    setSoundEnabledState(getSoundEnabled());
  }, []);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session || saving) return;

    const normalizedLikes = Array.from(new Set(parseList(likes).map((entry) => entry.slice(0, 40))));
    const normalizedInterests = Array.from(new Set(parseList(interests).map((entry) => entry.slice(0, 40))));
    if (normalizedLikes.length > PROFILE_TAG_LIMIT || normalizedInterests.length > PROFILE_TAG_LIMIT) {
      setNotice({
        type: "error",
        message: `Use at most ${PROFILE_TAG_LIMIT} likes and ${PROFILE_TAG_LIMIT} interests.`,
      });
      return;
    }

    setSaving(true);
    setNotice(null);
    const markedAt = new Date().toISOString();
    try {
      const response = await fetch(`${apiBase}/profile/me`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({
          likes: normalizedLikes,
          interests: normalizedInterests,
          favoriteBook: favoriteBook.trim(),
          favoriteMovie: favoriteMovie.trim(),
          appPreferences: {
            language: appLanguage,
            personalisation: {
              aiPersona,
            },
            profileSettings: {
              ...profileSettings,
              preferenceOnboardingStatus: "completed",
              promptedAt: profileSettings?.promptedAt ?? markedAt,
              completedAt: markedAt,
              discoverableInSuggestions: allowSearch ? discoverableInSuggestions : false,
              allowFollowers,
              allowSearch,
              allowMessages,
              showGameScores,
              showPresence,
            },
          },
        }),
      });
      const data = (await response.json().catch(() => null)) as ProfileResponse | null;
      if (!response.ok) {
        throw new Error("Unable to save settings.");
      }

      // Sync the UI locale cookie so Server Components re-render in the chosen language.
      try {
        await fetch("/api/locale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale: appLanguage }),
        });
        router.refresh();
      } catch {
        // Non-fatal: the language preference is saved; the cookie will sync on next save.
      }

      const nextSettings = data?.profile?.appPreferences?.profileSettings;
      setProfileSettings(nextSettings);
      setFavoriteBook(data?.profile?.favoriteBook ?? "");
      setFavoriteMovie(data?.profile?.favoriteMovie ?? "");
      setLikes((data?.profile?.likes || normalizedLikes).join(", "));
      setInterests((data?.profile?.interests || normalizedInterests).join(", "));
      setDiscoverableInSuggestions(nextSettings?.discoverableInSuggestions ?? allowSearch);
      setAllowFollowers(nextSettings?.allowFollowers ?? allowFollowers);
      setAllowSearch(nextSettings?.allowSearch ?? allowSearch);
      setAllowMessages(nextSettings?.allowMessages ?? allowMessages);
      setShowGameScores(nextSettings?.showGameScores ?? showGameScores);
      setShowPresence(nextSettings?.showPresence ?? showPresence);
      setNotice({ type: "success", message: "Settings saved." });
    } catch (error) {
      setNotice({
        type: "error",
        message: getApiErrorMessage(error, "Unable to save settings."),
      });
    } finally {
      setSaving(false);
    }
  };

  if (!session) {
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card card-with-back" data-testid="settings-open">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)", flexWrap: "wrap" }}>
            <SchoolLogo size={72} />
            <div>
              <span className="eyebrow">Settings</span>
              <h1 className="title" style={{ marginTop: "0.2rem" }}>Your profile, on this device.</h1>
            </div>
          </div>
          <p className="subtitle">
            Learn, past papers, the tutor, and this page work without an account. A name and a grade are enough to personalise them.
          </p>
          <MinimalProfileForm />
          <GoogleSyncPrompt />
          <ThemePicker />
          <p className="subtitle">Password, billing, and signed-in device sessions appear here after you sign in.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            <Link className="button" href="/learn">Continue without an account</Link>
            <Link className="button" href="/login">Sign in with email</Link>
          </div>
          <AboutLegal />
        </div>
      </div>
    );
  }

  return (
    <div className="route-lock-dock">
      <div className="route-lock-frame glass card card-with-back">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)", flexWrap: "wrap" }}>
          <SchoolLogo size={72} />
          <div>
            <span className="eyebrow">Settings</span>
            <h1 className="title" style={{ marginTop: "0.2rem" }}>Tune the profile that drives your SCHOOL experience.</h1>
          </div>
        </div>
        <p className="subtitle">
          Profile settings were moved here from Profile so messaging remains focused on conversations.
        </p>
        <MinimalProfileForm showSkip={false} />
        <GoogleSyncPrompt compact />
        {notice ? (
          <p
            className="badge"
            style={
              notice.type === "success"
                ? { background: "var(--success, #16a34a)", color: "#fff" }
                : notice.type === "error"
                  ? { background: "var(--danger, #dc2626)", color: "#fff" }
                  : undefined
            }
          >
            {notice.message}
          </p>
        ) : null}
        {loading ? <p className="badge">Loading settings...</p> : null}

        <form className="profile-form" onSubmit={handleSave}>
          <div className="profile-section">
            <h3>Profile preferences</h3>
            <label className="profile-field">
              Favorite book
              <input
                type="text"
                value={favoriteBook}
                onChange={(event) => setFavoriteBook(event.target.value)}
              />
            </label>
            <label className="profile-field">
              Favorite movie
              <input
                type="text"
                value={favoriteMovie}
                onChange={(event) => setFavoriteMovie(event.target.value)}
              />
            </label>
            <label className="profile-field">
              Likes (comma separated)
              <input type="text" value={likes} onChange={(event) => setLikes(event.target.value)} />
            </label>
            <label className="profile-field">
              Interests (comma separated)
              <input type="text" value={interests} onChange={(event) => setInterests(event.target.value)} />
            </label>
            <p className="profile-subtitle">
              Likes: {likesTokens.length}/{PROFILE_TAG_LIMIT} | Interests: {interestTokens.length}/{PROFILE_TAG_LIMIT}
            </p>
          </div>

          <div className="profile-section">
            <h3>Discovery and privacy</h3>
            <label>
              <input
                type="checkbox"
                checked={discoverableInSuggestions}
                onChange={(event) => setDiscoverableInSuggestions(event.target.checked)}
                disabled={!allowSearch}
              />
              {" "}Show me in user suggestions
            </label>
            <label>
              <input
                type="checkbox"
                checked={allowFollowers}
                onChange={(event) => setAllowFollowers(event.target.checked)}
              />
              {" "}Allow users to follow me
            </label>
            <label>
              <input
                type="checkbox"
                checked={allowSearch}
                onChange={(event) => setAllowSearch(event.target.checked)}
              />
              {" "}Allow users to find me by username
            </label>
            <label>
              <input
                type="checkbox"
                checked={allowMessages}
                onChange={(event) => setAllowMessages(event.target.checked)}
              />
              {" "}Allow direct messages
            </label>
            <label>
              <input
                type="checkbox"
                checked={showGameScores}
                onChange={(event) => setShowGameScores(event.target.checked)}
              />
              {" "}Show my game scores on my public profile
            </label>
            <label>
              <input
                type="checkbox"
                checked={showPresence}
                onChange={(event) => setShowPresence(event.target.checked)}
              />
              {" "}Show my study presence to followers
            </label>
          </div>

          <div className="profile-section">
            <h3>{t("languageHeading")}</h3>
            <p className="profile-subtitle" style={{ marginBottom: "12px" }}>
              {t("languageSubtitle")}
            </p>
            <label className="profile-field">
              {t("aiTutorLanguage")}
              <select
                value={appLanguage}
                onChange={(e) => setAppLanguage(e.target.value as any)}
                style={{ width: "100%", padding: "8px", borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-1)" }}
              >
                <option value="en">English</option>
                <option value="zu">isiZulu</option>
                <option value="xh">isiXhosa</option>
                <option value="af">Afrikaans</option>
                <option value="st">Sesotho</option>
                <option value="tn">Setswana</option>
                <option value="nso">Sepedi</option>
                <option value="ts">Xitsonga</option>
                <option value="ss">siSwati</option>
                <option value="ve">Tshivenda</option>
                <option value="nr">isiNdebele</option>
              </select>
            </label>
          </div>

          <div className="profile-section">
            <h3>{t("personaHeading")}</h3>
            <p className="profile-subtitle" style={{ marginBottom: "12px" }}>
              {t("personaSubtitle")}
            </p>
            <label className="profile-field">
              {t("persona")}
              <select
                value={aiPersona}
                onChange={(e) => setAiPersona(e.target.value as any)}
                style={{ width: "100%", padding: "8px", borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-1)" }}
              >
                <option value="standard">{t("personaStandard")}</option>
                <option value="mzansi">{t("personaMzansi")}</option>
                <option value="strict">{t("personaStrict")}</option>
              </select>
            </label>
          </div>

          <div className="profile-section">
            <h3>Sound and accessibility</h3>
            <label>
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(event) => {
                  const next = event.target.checked;
                  setSoundEnabledState(next);
                  setSoundEnabled(next);
                }}
              />
              {" "}Play coin sound when earning Scholar Credits
            </label>
            <p className="profile-subtitle" style={{ marginTop: 4 }}>
              A short audio tone plays each time you earn credits in the community. Off by default.
            </p>
          </div>

          <div className="profile-section">
            <ThemePicker />
          </div>

          <div className="profile-section">
            <h3>Connected Apps</h3>
            <div style={{ display: "grid", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "var(--surface-2)", borderRadius: "var(--r-md)", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <span style={{ fontSize: "20px" }}>🎵</span>
                  <div style={{ display: "grid" }}>
                    <span style={{ fontSize: "14px", fontWeight: 600 }}>Spotify</span>
                    <span style={{ fontSize: "11px", color: "var(--text-3)" }}>Share your study vibes on your profile</span>
                  </div>
                </div>
                <Link href="/api/auth/spotify" className="button" style={{ padding: "6px 12px", fontSize: "12px" }}>Connect</Link>
              </div>
            </div>
          </div>

          <div className="profile-actions">
            <button
              className="button"
              type="submit"
              disabled={
                saving ||
                likesTokens.length > PROFILE_TAG_LIMIT ||
                interestTokens.length > PROFILE_TAG_LIMIT
              }
            >
              {saving ? t("saving") : t("save")}
            </button>
            <Link className="button" href="/messages">
              Open messaging
            </Link>
          </div>
        </form>

        <UniversityProfileSettings />

        <ReferralSection />

        <UpgradePanel />

        <BursaryRedemptionPanel />

        <AccountSecurityPanel />

        <ActiveSessionsPanel />

        <PushNotificationsPanel />

        <DSARRequestsPanel />

        <DangerZone />

        <AboutLegal />
      </div>
    </div>
  );
}

function ReferralSection() {
  const apiBase = API_BASE;
  const { session } = useSession();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [stats, setStats] = useState<{ count: number; creditsEarned: number; bonusPerReferral: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    Promise.all([
      fetch(`${apiBase}/referrals/my-code`, { credentials: "include" })
        .then((r) => r.ok ? r.json() : null)
        .catch(() => null),
      fetch(`${apiBase}/referrals/stats`, { credentials: "include" })
        .then((r) => r.ok ? r.json() : null)
        .catch(() => null),
    ]).then(([codeData, statsData]) => {
      if (cancelled) return;
      if (codeData?.shareUrl) {
        setShareUrl(codeData.shareUrl);
        setCode(codeData.code);
      } else {
        setLoadError(true);
      }
      if (statsData?.count !== undefined) setStats(statsData);
    });

    return () => { cancelled = true; };
  }, [apiBase, session]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select the input
    }
  };

  if (!session) return null;

  return (
    <div style={{ marginTop: "40px", borderTop: "1px solid var(--border)", paddingTop: "32px" }}>
      <h2 style={{ fontSize: "18px", marginBottom: "4px" }}>Refer a friend</h2>
      <p style={{ color: "var(--text-3)", fontSize: "13px", marginBottom: "16px" }}>
        Share your link. When a friend registers via your link you both get Scholar Credits — you earn{" "}
        <strong>50 credits</strong>, they get a <strong>25-credit welcome bonus</strong>.
      </p>

      {loadError ? (
        <p style={{ color: "var(--text-3)", fontSize: "13px" }}>Unable to load referral link. Refresh to try again.</p>
      ) : !shareUrl ? (
        <p style={{ color: "var(--text-3)", fontSize: "13px" }}>Loading...</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "16px" }}>
            <input
              readOnly
              value={shareUrl}
              style={{
                flex: 1,
                minWidth: "200px",
                padding: "8px 12px",
                borderRadius: "var(--r-sm)",
                border: "1px solid var(--border)",
                fontSize: "13px",
                background: "var(--bg-2)",
                color: "var(--text-2)",
              }}
              onFocus={(e) => e.target.select()}
            />
            <button
              type="button"
              className="button"
              style={{ flexShrink: 0, fontSize: "13px", padding: "8px 16px" }}
              onClick={() => void handleCopy()}
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>

          <p style={{ fontSize: "12px", color: "var(--text-3)", marginBottom: "16px" }}>
            Your code: <strong style={{ letterSpacing: "0.08em" }}>{code}</strong>
          </p>

          {stats !== null && (
            <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--inst-primary)" }}>
                  {stats.count}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-3)" }}>
                  {stats.count === 1 ? "friend referred" : "friends referred"}
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--inst-primary)" }}>
                  {stats.creditsEarned}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-3)" }}>credits earned</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DangerZone() {
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const handleDelete = async () => {
    if (!password.trim()) { setDeleteError("Enter your current password to confirm deletion."); return; }
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/account`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; message?: string };
      if (!res.ok) { setDeleteError(data.error || "Unable to delete account."); return; }
      window.location.href = "/";
    } catch {
      setDeleteError("Unable to connect. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ marginTop: "40px", borderTop: "1px solid var(--border)", paddingTop: "32px" }}>
      <h2 style={{ color: "#ef4444", fontSize: "18px", marginBottom: "8px" }}>Danger Zone</h2>
      <p style={{ color: "var(--text-3)", fontSize: "13px", marginBottom: "16px" }}>
        Deleting your account is permanent and irreversible. Your email, name, and phone are anonymised immediately.
        Community posts are kept (anonymised) in accordance with POPIA data retention requirements.
      </p>
      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px" }}>
        <a
          href={`${API_BASE}/profile/data-export`}
          style={{ fontSize: "13px", color: "var(--inst-primary)", textDecoration: "underline" }}
        >
          Download my data first
        </a>
      </div>
      {!confirmed ? (
        <button
          type="button"
          style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: "var(--r-md)", padding: "8px 16px", cursor: "pointer", fontSize: "13px" }}
          onClick={() => setConfirmed(true)}
        >
          Delete my account
        </button>
      ) : (
        <div style={{ display: "grid", gap: "8px", maxWidth: "360px" }}>
          <p style={{ fontSize: "13px", color: "#ef4444", fontWeight: 600 }}>Enter your password to confirm permanent deletion:</p>
          <input
            type="password"
            placeholder="Current password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            style={{ padding: "8px 12px", borderRadius: "var(--r-sm)", border: "1px solid #ef4444", fontSize: "13px" }}
          />
          {deleteError ? <p style={{ color: "#ef4444", fontSize: "12px", margin: 0 }}>{deleteError}</p> : null}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: "var(--r-md)", padding: "8px 16px", cursor: "pointer", fontSize: "13px" }}
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Confirm — delete permanently"}
            </button>
            <button
              type="button"
              style={{ background: "var(--bg-2)", color: "var(--text-2)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "8px 16px", cursor: "pointer", fontSize: "13px" }}
              onClick={() => { setConfirmed(false); setPassword(""); setDeleteError(null); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
