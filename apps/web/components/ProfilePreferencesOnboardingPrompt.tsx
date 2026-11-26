"use client";

import { useEffect, useState, type FormEvent } from "react";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import { useSession } from "./SessionProvider";

type ProfileSettings = {
  preferenceOnboardingStatus?: "pending" | "completed" | "declined";
  promptedAt?: string;
  completedAt?: string;
  declinedAt?: string;
};

type ProfileResponse = {
  profile?: {
    likes?: string[];
    interests?: string[];
    favoriteBook?: string | null;
    favoriteMovie?: string | null;
    appPreferences?: {
      profileSettings?: ProfileSettings;
    };
  };
};

const REPROMPT_AFTER_DECLINE_DAYS = 14;

function shouldDisplayPrompt(settings: ProfileSettings | undefined) {
  const status = settings?.preferenceOnboardingStatus;
  if (status === "pending") return true;
  if (status !== "declined") return false;
  if (!settings?.declinedAt) return false;
  const declinedAt = Date.parse(settings.declinedAt);
  if (!Number.isFinite(declinedAt)) return false;
  const elapsedMs = Date.now() - declinedAt;
  return elapsedMs >= REPROMPT_AFTER_DECLINE_DAYS * 24 * 60 * 60 * 1000;
}

const parseList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export function ProfilePreferencesOnboardingPrompt() {
  const { session, loading } = useSession();
  const apiBase = API_BASE;
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [likes, setLikes] = useState("");
  const [interests, setInterests] = useState("");
  const [favoriteBook, setFavoriteBook] = useState("");
  const [favoriteMovie, setFavoriteMovie] = useState("");
  const [profileSettings, setProfileSettings] = useState<ProfileSettings | undefined>(undefined);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      setVisible(false);
      setProfileSettings(undefined);
      return;
    }

    let active = true;
    fetch(`${apiBase}/profile/me`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }
        return (await response.json()) as ProfileResponse;
      })
      .then((data) => {
        if (!active || !data?.profile) return;
        const settings = data.profile.appPreferences?.profileSettings;
        setProfileSettings(settings);
        setLikes(data.profile.likes?.join(", ") ?? "");
        setInterests(data.profile.interests?.join(", ") ?? "");
        setFavoriteBook(data.profile.favoriteBook ?? "");
        setFavoriteMovie(data.profile.favoriteMovie ?? "");
        setVisible(shouldDisplayPrompt(settings));
      })
      .catch(() => {
        if (!active) return;
        setVisible(false);
      });

    return () => {
      active = false;
    };
  }, [apiBase, loading, session]);

  const handleSavePreferences = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session || busy) return;
    setError(null);
    setBusy(true);
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
          likes: parseList(likes),
          interests: parseList(interests),
          favoriteBook,
          favoriteMovie,
          appPreferences: {
            profileSettings: {
              ...profileSettings,
              preferenceOnboardingStatus: "completed",
              promptedAt: profileSettings?.promptedAt ?? markedAt,
              completedAt: markedAt,
            },
          },
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Unable to save preferences.");
      }

      setVisible(false);
    } catch (saveError) {
      setError(getApiErrorMessage(saveError, "Unable to save preferences."));
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    if (!session || busy) return;
    setError(null);
    setBusy(true);
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
          appPreferences: {
            profileSettings: {
              ...profileSettings,
              preferenceOnboardingStatus: "declined",
              promptedAt: profileSettings?.promptedAt ?? markedAt,
              declinedAt: markedAt,
            },
          },
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Unable to skip this step.");
      }

      setVisible(false);
    } catch (declineError) {
      setError(getApiErrorMessage(declineError, "Unable to skip this step."));
    } finally {
      setBusy(false);
    }
  };

  if (!session || !visible) {
    return null;
  }

  return (
    <div className="profile-preferences-onboarding-overlay" role="dialog" aria-modal="true">
      <div className="profile-preferences-onboarding-card glass">
        <h3>Set up your profile preferences</h3>
        <p className="profile-subtitle">
          Add favorites, likes, and interests now. You can skip this and edit later in Profile
          settings.
        </p>
        {error && <p className="profile-preferences-onboarding-error">{error}</p>}
        <form className="profile-form" onSubmit={handleSavePreferences}>
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
            <input
              type="text"
              value={likes}
              onChange={(event) => setLikes(event.target.value)}
            />
          </label>
          <label className="profile-field">
            Interests (comma separated)
            <input
              type="text"
              value={interests}
              onChange={(event) => setInterests(event.target.value)}
            />
          </label>
          <div className="profile-actions">
            <button className="button" type="submit" disabled={busy}>
              {busy ? "Saving..." : "Save preferences"}
            </button>
            <button className="button" type="button" onClick={() => void handleDecline()} disabled={busy}>
              Decline for now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
