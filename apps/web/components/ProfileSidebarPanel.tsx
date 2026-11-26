"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import { PLATFORM_INVARIANT } from "@/lib/tutorCopy";
import { useSession } from "./SessionProvider";
import { BadgeWall } from "@/components/BadgeWall";
import { StreakHeatmap } from "@/components/StreakHeatmap";
import { LearningPathTree } from "@/components/LearningPathTree";
import { PdfExportButton } from "@/components/PdfExportButton";

type Session = {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  csrfToken: string;
};

type ProfileUser = Session["user"] & {
  createdAt: string;
};

type AvatarSettings = {
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  topColor: string;
  bottomColor: string;
  accentColor: string;
};

type AppPreferences = {
  language?: "en" | "zu" | "xh" | "af" | "st" | "tn" | "nso" | "ts" | "ss" | "ve" | "nr";
  lessonDifficulty?: "easy" | "balanced" | "challenge";
  notifications?: {
    messaging?: boolean;
    progress?: boolean;
    reminders?: boolean;
  };
  reducedDataMode?: boolean;
  profileSettings?: {
    preferenceOnboardingStatus?: "pending" | "completed" | "declined";
    promptedAt?: string;
    completedAt?: string;
    declinedAt?: string;
    discoverableInSuggestions?: boolean;
    allowFollowers?: boolean;
    allowSearch?: boolean;
    allowMessages?: boolean;
  };
};

type ProfileCompletion = {
  percent: number;
  missing: string[];
};

type ProfileData = {
  username: string | null;
  region: string | null;
  likes: string[];
  interests: string[];
  favoriteBook: string | null;
  favoriteMovie: string | null;
  appPreferences?: AppPreferences;
  avatarUniform: AvatarSettings | null;
  avatarCasual: AvatarSettings | null;
};

type Achievement = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  achieved_on: string | null;
  created_at: string;
};

type FriendSuggestion = {
  user_id: string;
  username: string | null;
  name: string;
  email: string;
  relevance_score: number;
  reason_label?: string;
  same_school: boolean;
  same_city: boolean;
  same_province: boolean;
  same_country: boolean;
  shared_likes: number;
  shared_interests: number;
  shared_subjects?: number;
  mutual_follows: number;
  recent_interactions: number;
  already_following: boolean;
};

type Stats = {
  followingCount: number;
  followersCount: number;
};

type RelationshipRow = {
  user_id: string;
  username: string | null;
  name: string;
  email: string;
  relationship_type: "blocked" | "muted";
  created_at: string;
};

type Notice = {
  type: "success" | "error" | "info";
  message: string;
};

type SessionRow = {
  id: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
};

type SecurityAlert = {
  id: string;
  risk_level: "info" | "warn" | "high";
  reason: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  read_at: string | null;
};

type ColorOption = {
  value: string;
  label: string;
};

const DEFAULT_AVATAR: AvatarSettings = {
  skinTone: "rgb(217 169 143)",
  hairStyle: "short",
  hairColor: "rgb(74 49 40)",
  topColor: "rgb(45 59 111)",
  bottomColor: "rgb(47 47 47)",
  accentColor: "rgb(245 192 79)",
};

const PALETTE = [
  "rgb(45 59 111)",
  "rgb(79 111 217)",
  "rgb(47 47 47)",
  "rgb(245 192 79)",
  "rgb(47 111 79)",
  "rgb(180 91 79)",
];
const SKIN_TONES = [
  "rgb(243 199 166)",
  "rgb(228 176 143)",
  "rgb(217 169 143)",
  "rgb(195 140 106)",
  "rgb(141 90 59)",
];
const HAIR_STYLES = ["short", "curly", "braids", "fade"];
const HAIR_COLORS = [
  "rgb(43 36 22)",
  "rgb(74 49 40)",
  "rgb(138 90 59)",
  "rgb(31 31 31)",
  "rgb(92 74 56)",
];

const SCHOOL_START_MIN = 7 * 60 + 30;
const SCHOOL_END_MIN = 15 * 60;
const SCHOOL_DAYS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

const parseList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const formatJoinDate = (value?: string) => {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, { month: "long", year: "numeric" });
};

const getCurrentOutfit = (region?: string | null) => {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: region || undefined,
    });
    const parts = formatter.formatToParts(new Date());
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
    const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
    const minutes = hour * 60 + minute;
    const inSchool = SCHOOL_DAYS.has(weekday) && minutes >= SCHOOL_START_MIN && minutes <= SCHOOL_END_MIN;
    return inSchool ? "uniform" : "casual";
  } catch {
    return "casual";
  }
};

function AvatarFigure({
  settings,
  variant,
}: {
  settings: AvatarSettings;
  variant: "badge" | "full";
}) {
  return (
    <div
      className={`avatar avatar--${variant}`}
      data-hair={settings.hairStyle}
      style={{
        ["--skin" as any]: settings.skinTone,
        ["--hair" as any]: settings.hairColor,
        ["--top" as any]: settings.topColor,
        ["--bottom" as any]: settings.bottomColor,
        ["--accent" as any]: settings.accentColor,
      }}
    >
      <div className="avatar-head">
        <div className="avatar-hair" />
        <div className="avatar-face" />
      </div>
      <div className="avatar-body">
        <div className="avatar-shirt" />
        <div className="avatar-pants" />
      </div>
    </div>
  );
}

function ColorSwatchPicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ColorOption[];
  onChange: (next: string) => void;
}) {
  return (
    <div className="profile-field">
      <span>{label}</span>
      <div className="profile-swatch-grid" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`profile-swatch${option.value === value ? " is-selected" : ""}`}
            style={{ backgroundColor: option.value }}
            onClick={() => onChange(option.value)}
            role="radio"
            aria-checked={option.value === value}
            aria-label={option.label}
            title={option.label}
          />
        ))}
      </div>
    </div>
  );
}

export function ProfileSidebarPanel({ onClose }: { onClose: () => void }): ReactNode {
  const router = useRouter();
  const apiBase = API_BASE;
  const { session, loading: sessionLoading, refresh } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<Stats>({ followingCount: 0, followersCount: 0 });
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [friendSuggestions, setFriendSuggestions] = useState<FriendSuggestion[]>([]);
  const [blockedRelationships, setBlockedRelationships] = useState<RelationshipRow[]>([]);
  const [mutedRelationships, setMutedRelationships] = useState<RelationshipRow[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(false);
  const [joinDate, setJoinDate] = useState("");
  const [mounted, setMounted] = useState(false);
  const [showTutorModal, setShowTutorModal] = useState(false);
  const [tutorSearchQuery, setTutorSearchQuery] = useState("");
  const [tutorGradeFilter, setTutorGradeFilter] = useState("");
  const [suggestionFilterQuery, setSuggestionFilterQuery] = useState("");
  const [suggestionSortMode, setSuggestionSortMode] = useState<"relevance" | "name" | "recent">("relevance");
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsHasMore, setSuggestionsHasMore] = useState(false);
  const [suggestionsNextCursor, setSuggestionsNextCursor] = useState<string | null>(null);
  const [relationshipsLoading, setRelationshipsLoading] = useState(false);
  const [followingUserId, setFollowingUserId] = useState<string | null>(null);
  const [mutingUserId, setMutingUserId] = useState<string | null>(null);
  const [blockingUserId, setBlockingUserId] = useState<string | null>(null);
  const [relationshipActionUserId, setRelationshipActionUserId] = useState<string | null>(null);
  const [profileCompletion, setProfileCompletion] = useState<ProfileCompletion>({
    percent: 0,
    missing: [],
  });
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [username, setUsername] = useState("");
  const [region, setRegion] = useState("");
  const [likes, setLikes] = useState("");
  const [interests, setInterests] = useState("");
  const [favoriteBook, setFavoriteBook] = useState("");
  const [favoriteMovie, setFavoriteMovie] = useState("");
  const [appLanguage, setAppLanguage] = useState<AppPreferences["language"]>("en");
  const [appLessonDifficulty, setAppLessonDifficulty] =
    useState<AppPreferences["lessonDifficulty"]>("balanced");
  const [notifyMessaging, setNotifyMessaging] = useState(true);
  const [notifyProgress, setNotifyProgress] = useState(true);
  const [notifyReminders, setNotifyReminders] = useState(true);
  const [reducedDataMode, setReducedDataMode] = useState(false);
  const [avatarUniform, setAvatarUniform] = useState<AvatarSettings>(DEFAULT_AVATAR);
  const [avatarCasual, setAvatarCasual] = useState<AvatarSettings>({
    ...DEFAULT_AVATAR,
    topColor: "rgb(79 111 217)",
    accentColor: "rgb(47 111 79)",
  });

  const [achievementTitle, setAchievementTitle] = useState("");
  const [achievementCategory, setAchievementCategory] = useState<"academic" | "extracurricular">(
    "academic"
  );
  const [achievementDate, setAchievementDate] = useState("");
  const [achievementDescription, setAchievementDescription] = useState("");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [revokeSessionsBusy, setRevokeSessionsBusy] = useState(false);
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
  const [loadingSecurityAlerts, setLoadingSecurityAlerts] = useState(false);
  const [markingSecurityAlertsRead, setMarkingSecurityAlertsRead] = useState(false);
  const [securityRiskFilter, setSecurityRiskFilter] = useState<"all" | "high" | "warn" | "info" | "unread">("all");

  const outfit = useMemo(() => getCurrentOutfit(profile?.region), [profile?.region]);
  const badgeSettings = outfit === "uniform" ? avatarUniform : avatarCasual;
  const likesTokens = useMemo(() => parseList(likes), [likes]);
  const interestTokens = useMemo(() => parseList(interests), [interests]);
  const preferredTutorQuery = useMemo(
    () => interestTokens[0] || likesTokens[0] || "",
    [interestTokens, likesTokens]
  );
  const visibleFriendSuggestions = useMemo(() => {
    const dismissed = new Set(dismissedSuggestionIds);
    const query = suggestionFilterQuery.trim().toLowerCase();
    const filtered = friendSuggestions.filter((suggestion) => {
      if (dismissed.has(suggestion.user_id)) return false;
      if (!query) return true;
      const haystack = `${suggestion.name} ${suggestion.username || ""} ${suggestion.email}`.toLowerCase();
      return haystack.includes(query);
    });
    const sorted = [...filtered];
    if (suggestionSortMode === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (suggestionSortMode === "recent") {
      sorted.sort((a, b) => Number(b.recent_interactions || 0) - Number(a.recent_interactions || 0));
    } else {
      sorted.sort((a, b) => Number(b.relevance_score || 0) - Number(a.relevance_score || 0));
    }
    return sorted;
  }, [dismissedSuggestionIds, friendSuggestions, suggestionFilterQuery, suggestionSortMode]);
  const topSuggestionToFollow = useMemo(
    () => visibleFriendSuggestions.find((suggestion) => !suggestion.already_following) || null,
    [visibleFriendSuggestions]
  );
  const unreadSecurityAlertCount = useMemo(
    () => securityAlerts.filter((alert) => !alert.read_at).length,
    [securityAlerts]
  );
  const highRiskSecurityAlertCount = useMemo(
    () => securityAlerts.filter((alert) => alert.risk_level === "high").length,
    [securityAlerts]
  );
  const visibleSecurityAlerts = useMemo(() => {
    if (securityRiskFilter === "all") return securityAlerts;
    if (securityRiskFilter === "unread") return securityAlerts.filter((alert) => !alert.read_at);
    return securityAlerts.filter((alert) => alert.risk_level === securityRiskFilter);
  }, [securityAlerts, securityRiskFilter]);

  const loadProfile = useCallback(async () => {
    const response = await fetch(`${apiBase}/profile/me`, { credentials: "include" });
    if (!response.ok) {
      throw new Error("Unable to load profile.");
    }
    const data = (await response.json()) as {
      profile: ProfileData;
      completion?: ProfileCompletion;
      stats: Stats;
      achievements: Achievement[];
      user: ProfileUser;
    };
    setProfile(data.profile);
    setStats(data.stats);
    setAchievements(data.achievements);
    setUsername(data.profile.username ?? "");
    setRegion(data.profile.region ?? "");
    setLikes(data.profile.likes?.join(", ") ?? "");
    setInterests(data.profile.interests?.join(", ") ?? "");
    setFavoriteBook(data.profile.favoriteBook ?? "");
    setFavoriteMovie(data.profile.favoriteMovie ?? "");
    setAppLanguage(data.profile.appPreferences?.language ?? "en");
    setAppLessonDifficulty(data.profile.appPreferences?.lessonDifficulty ?? "balanced");
    setNotifyMessaging(data.profile.appPreferences?.notifications?.messaging ?? true);
    setNotifyProgress(data.profile.appPreferences?.notifications?.progress ?? true);
    setNotifyReminders(data.profile.appPreferences?.notifications?.reminders ?? true);
    setReducedDataMode(Boolean(data.profile.appPreferences?.reducedDataMode));
    setProfileCompletion({
      percent: Number(data.completion?.percent ?? 0),
      missing: Array.isArray(data.completion?.missing) ? data.completion?.missing : [],
    });
    setAvatarUniform(data.profile.avatarUniform ?? DEFAULT_AVATAR);
    setAvatarCasual(data.profile.avatarCasual ?? DEFAULT_AVATAR);
    setJoinDate(data.user.createdAt);
  }, [apiBase]);

  const loadFriendSuggestions = useCallback(
    async (options?: { cursor?: string | null; reset?: boolean }) => {
      const reset = options?.reset ?? false;
      const params = new URLSearchParams({ limit: "8" });
      if (options?.cursor) {
        params.set("cursor", options.cursor);
      }
      setSuggestionsLoading(true);
      try {
        const response = await fetch(`${apiBase}/profile/following/suggestions?${params.toString()}`, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Unable to load follow suggestions.");
        }
        const data = (await response.json()) as {
          suggestions: FriendSuggestion[];
          nextCursor?: string | null;
          hasMore?: boolean;
        };
        const incoming = data.suggestions || [];
        if (reset) setDismissedSuggestionIds([]);
        setFriendSuggestions((prev) => (reset ? incoming : [...prev, ...incoming]));
        setSuggestionsNextCursor(data.nextCursor ?? null);
        setSuggestionsHasMore(Boolean(data.hasMore));
      } finally {
        setSuggestionsLoading(false);
      }
    },
    [apiBase]
  );

  const loadRelationships = useCallback(async () => {
    setRelationshipsLoading(true);
    try {
      const response = await fetch(`${apiBase}/profile/users/relationships?limit=40`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Unable to load blocked and muted users.");
      }
      const data = (await response.json()) as {
        blocked: RelationshipRow[];
        muted: RelationshipRow[];
      };
      setBlockedRelationships(data.blocked || []);
      setMutedRelationships(data.muted || []);
    } finally {
      setRelationshipsLoading(false);
    }
  }, [apiBase]);

  const loadSessions = useCallback(async () => {
    if (!session) return;
    setLoadingSessions(true);
    try {
      const response = await fetch(`${apiBase}/auth/sessions`, { credentials: "include" });
      if (!response.ok) {
        throw new Error("Unable to load active sessions.");
      }
      const data = (await response.json()) as { sessions: SessionRow[] };
      setSessions(data.sessions || []);
    } finally {
      setLoadingSessions(false);
    }
  }, [apiBase, session]);

  const loadSecurityAlerts = useCallback(async () => {
    if (!session) return;
    setLoadingSecurityAlerts(true);
    try {
      const response = await fetch(`${apiBase}/auth/security-alerts?limit=15`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Unable to load security alerts.");
      }
      const data = (await response.json()) as { alerts?: SecurityAlert[] };
      setSecurityAlerts(data.alerts || []);
    } finally {
      setLoadingSecurityAlerts(false);
    }
  }, [apiBase, session]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (session) return;
    setLoading(false);
    setLoadingSessions(false);
    setSuggestionsLoading(false);
    setRelationshipsLoading(false);
    setFollowingUserId(null);
    setMutingUserId(null);
    setBlockingUserId(null);
    setRelationshipActionUserId(null);
    setProfile(null);
    setStats({ followingCount: 0, followersCount: 0 });
    setAchievements([]);
    setFriendSuggestions([]);
    setSuggestionsNextCursor(null);
    setSuggestionsHasMore(false);
    setBlockedRelationships([]);
    setMutedRelationships([]);
    setSuggestionFilterQuery("");
    setSuggestionSortMode("relevance");
    setDismissedSuggestionIds([]);
    setSessions([]);
    setSecurityAlerts([]);
    setSecurityRiskFilter("all");
    setProfileCompletion({ percent: 0, missing: [] });
  }, [session]);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    Promise.all([
      loadProfile(),
      loadFriendSuggestions({ reset: true }),
      loadRelationships(),
      loadSessions(),
      loadSecurityAlerts(),
    ])
      .catch((error) => {
        setNotice({
          type: "error",
          message: getApiErrorMessage(error, "Unable to load profile."),
        });
      })
      .finally(() => setLoading(false));
  }, [
    session,
    loadFriendSuggestions,
    loadProfile,
    loadRelationships,
    loadSecurityAlerts,
    loadSessions,
  ]);

  useEffect(() => {
    if (!showTutorModal) return;
    if (!tutorSearchQuery.trim() && preferredTutorQuery) {
      setTutorSearchQuery(preferredTutorQuery);
    }
  }, [preferredTutorQuery, showTutorModal, tutorSearchQuery]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loginSubmitting) return;
    setNotice(null);
    setLoginSubmitting(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Login failed.");
      }
      await refresh();
      setLoginPassword("");
      setNotice({ type: "success", message: "Signed in successfully." });
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === "AbortError"
          ? "Login request timed out. Please try again."
          : getApiErrorMessage(error, "Login failed.");
      setNotice({
        type: "error",
        message,
      });
    } finally {
      clearTimeout(timeout);
      setLoginSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Logout failed.");
      }
      await refresh();
      setProfile(null);
      setNotice({ type: "info", message: "Signed out." });
      handleClose();
      router.push("/");
    } catch (error) {
      setNotice({
        type: "error",
        message: getApiErrorMessage(error, "Logout failed."),
      });
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!session || revokeSessionsBusy) return;
    setNotice(null);
    setRevokeSessionsBusy(true);
    try {
      const response = await fetch(`${apiBase}/auth/sessions/revoke-all`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Unable to revoke sessions.");
      }
      setSessions([]);
      setNotice({ type: "info", message: "All sessions were revoked. Please sign in again." });
      await refresh();
      handleClose();
      router.push("/");
    } catch (error) {
      setNotice({
        type: "error",
        message: getApiErrorMessage(error, "Unable to revoke sessions."),
      });
    } finally {
      setRevokeSessionsBusy(false);
    }
  };

  const handleMarkSecurityAlertsRead = async () => {
    if (!session || markingSecurityAlertsRead) return;
    setMarkingSecurityAlertsRead(true);
    try {
      const response = await fetch(`${apiBase}/auth/security-alerts/read-all`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Unable to mark alerts as read.");
      }
      setSecurityAlerts((prev) =>
        prev.map((alert) =>
          alert.read_at ? alert : { ...alert, read_at: new Date().toISOString() }
        )
      );
    } catch (error) {
      setNotice({
        type: "error",
        message: getApiErrorMessage(error, "Unable to mark alerts as read."),
      });
    } finally {
      setMarkingSecurityAlertsRead(false);
    }
  };

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session) return;
    const normalizedUsername = username.trim();
    if (normalizedUsername && !USERNAME_REGEX.test(normalizedUsername)) {
      setNotice({
        type: "error",
        message: "Username must be 3-20 characters: lowercase letters, numbers, or underscores.",
      });
      return;
    }
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/profile/me`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({
          username: normalizedUsername,
          region: region.trim(),
          appPreferences: {
            language: appLanguage,
            lessonDifficulty: appLessonDifficulty,
            notifications: {
              messaging: notifyMessaging,
              progress: notifyProgress,
              reminders: notifyReminders,
            },
            reducedDataMode,
          },
          avatarUniform,
          avatarCasual,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Profile update failed.");
      }
      setProfile((prev) => (prev ? { ...prev, ...data.profile } : prev));
      setNotice({ type: "success", message: "Profile saved." });
    } catch (error) {
      setNotice({
        type: "error",
        message: getApiErrorMessage(error, "Profile update failed."),
      });
    }
  };

  const markUserAsFollowing = (targetUserId: string) => {
    setFriendSuggestions((prev) =>
      prev.map((item) =>
        item.user_id === targetUserId ? { ...item, already_following: true } : item
      )
    );
  };

  const handleFollowUser = async (targetUserId: string) => {
    if (!session || followingUserId) return;
    setNotice(null);
    setFollowingUserId(targetUserId);
    try {
      const response = await fetch(`${apiBase}/profile/following`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({ userId: targetUserId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Unable to follow user.");
      }
      setStats((prev) => data?.stats ?? prev);
      markUserAsFollowing(targetUserId);
      setNotice({
        type: "success",
        message: "Now following this user.",
      });
      await loadFriendSuggestions({ reset: true });
    } catch (error) {
      setNotice({
        type: "error",
        message: getApiErrorMessage(error, "Unable to follow user."),
      });
    } finally {
      setFollowingUserId(null);
    }
  };

  const handleFollowTopSuggestion = async () => {
    if (!topSuggestionToFollow) return;
    await handleFollowUser(topSuggestionToFollow.user_id);
  };

  const removeUserFromDiscoveryViews = (targetUserId: string) => {
    setFriendSuggestions((prev) => prev.filter((item) => item.user_id !== targetUserId));
    setDismissedSuggestionIds((prev) => prev.filter((id) => id !== targetUserId));
  };

  const handleDismissSuggestion = (targetUserId: string) => {
    setDismissedSuggestionIds((prev) => (prev.includes(targetUserId) ? prev : [...prev, targetUserId]));
  };

  const handleMuteUser = async (targetUserId: string) => {
    if (!session || mutingUserId || targetUserId === session.user.id) return;
    setNotice(null);
    setMutingUserId(targetUserId);
    try {
      const response = await fetch(`${apiBase}/profile/users/mute`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({ userId: targetUserId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Unable to mute user.");
      }
      removeUserFromDiscoveryViews(targetUserId);
      await loadRelationships();
      setNotice({ type: "info", message: "User muted." });
    } catch (error) {
      setNotice({
        type: "error",
        message: getApiErrorMessage(error, "Unable to mute user."),
      });
    } finally {
      setMutingUserId(null);
    }
  };

  const handleBlockUser = async (targetUserId: string) => {
    if (!session || blockingUserId || targetUserId === session.user.id) return;
    setNotice(null);
    setBlockingUserId(targetUserId);
    try {
      const response = await fetch(`${apiBase}/profile/users/block`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({ userId: targetUserId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Unable to block user.");
      }
      setStats((prev) => data?.stats ?? prev);
      removeUserFromDiscoveryViews(targetUserId);
      await loadRelationships();
      setNotice({ type: "info", message: "User blocked." });
    } catch (error) {
      setNotice({
        type: "error",
        message: getApiErrorMessage(error, "Unable to block user."),
      });
    } finally {
      setBlockingUserId(null);
    }
  };

  const handleRemoveRelationship = async (targetUserId: string, type: "blocked" | "muted") => {
    if (!session || relationshipActionUserId) return;
    setNotice(null);
    setRelationshipActionUserId(targetUserId);
    try {
      const route = type === "blocked" ? "block" : "mute";
      const response = await fetch(`${apiBase}/profile/users/${route}/${targetUserId}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Unable to update relationship.");
      }
      await Promise.all([loadRelationships(), loadFriendSuggestions({ reset: true })]);
      if (type === "blocked") {
        setNotice({ type: "success", message: "User unblocked." });
      } else {
        setNotice({ type: "success", message: "User unmuted." });
      }
    } catch (error) {
      setNotice({
        type: "error",
        message: getApiErrorMessage(error, "Unable to update relationship."),
      });
    } finally {
      setRelationshipActionUserId(null);
    }
  };

  const handleAddAchievement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session) return;
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/profile/achievements`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({
          title: achievementTitle,
          category: achievementCategory,
          description: achievementDescription || undefined,
          achievedOn: achievementDate || undefined,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Unable to add achievement.");
      }
      setAchievements((prev) => [data.achievement, ...prev]);
      setAchievementTitle("");
      setAchievementDate("");
      setAchievementDescription("");
      setNotice({ type: "success", message: "Achievement posted." });
    } catch (error) {
      setNotice({
        type: "error",
        message: getApiErrorMessage(error, "Unable to add achievement."),
      });
    }
  };

  const colorLabels = useMemo(() => {
    return {
      skin: SKIN_TONES.map((tone, index) => ({ value: tone, label: `Skin ${index + 1}` })),
      hair: HAIR_COLORS.map((color, index) => ({ value: color, label: `Hair ${index + 1}` })),
      palette: PALETTE.map((color, index) => ({ value: color, label: `Color ${index + 1}` })),
    };
  }, []);

  const handleClose = () => {
    setShowTutorModal(false);
    onClose();
  };

  const openTutorDirectory = () => {
    setShowTutorModal(false);
    const params = new URLSearchParams();
    if (tutorSearchQuery.trim()) params.set("q", tutorSearchQuery.trim());
    if (tutorGradeFilter.trim()) params.set("grade", tutorGradeFilter.trim());
    const suffix = params.toString();
    router.push(suffix ? `/tutors?${suffix}` : "/tutors");
  };

  if (!mounted) return null;

  return createPortal(
    <>
      <button className="profile-panel-overlay" type="button" onClick={handleClose} />
      <div className="profile-panel glass">
        <div className="profile-panel-header">
          <AvatarFigure settings={badgeSettings} variant="full" />
          <div>
            <h2>Profile</h2>
            <p className="profile-subtitle">
              {session ? `Joined ${formatJoinDate(joinDate)}` : "Sign in to begin"}
            </p>
            <div className="profile-stats">
              <div>
                <strong>{stats.followersCount}</strong>
                <span>Followers</span>
              </div>
              <div>
                <strong>{stats.followingCount}</strong>
                <span>Following</span>
              </div>
            </div>
          </div>
          <div className="profile-actions">
            <button
              className="button"
              type="button"
              onClick={() => {
                handleClose();
                router.push("/messages");
              }}
            >
              Messaging hub
            </button>
            <button className="button" type="button" onClick={() => setShowTutorModal(true)}>
              Find a tutor
            </button>
            <button
              className="button"
              type="button"
              onClick={() => {
                handleClose();
                router.push("/profile/learning");
              }}
            >
              Your learning
            </button>
            <button className="profile-close" type="button" onClick={handleClose}>
              Close
            </button>
          </div>
        </div>

        {notice && (
          <div className={`profile-notice profile-notice--${notice.type}`}>{notice.message}</div>
        )}

        {!session && (
          <form className="profile-form" onSubmit={handleLogin}>
            {sessionLoading && <p className="profile-subtitle">Checking session...</p>}
            <label className="profile-field">
              Email
              <input
                type="email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                disabled={loginSubmitting}
                required
                autoComplete="email"
              />
            </label>
            <label className="profile-field">
              Password
              <input
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                disabled={loginSubmitting}
                required
                autoComplete="current-password"
              />
            </label>
            <div className="profile-actions">
              <button className="button" type="submit" disabled={loginSubmitting}>
                {loginSubmitting ? "Signing in..." : "Sign in"}
              </button>
              <button
                className="button"
                type="button"
                onClick={() => {
                  handleClose();
                  router.push("/");
                }}
              >
                Create account
              </button>
            </div>
          </form>
        )}

        {session && (
          <>
            {loading ? (
              <p className="profile-subtitle">Loading profile...</p>
            ) : (
              <form className="profile-form" onSubmit={handleSaveProfile}>
                    <div className="profile-section">
                      <h3>About</h3>
                      <label className="profile-field">
                        Username
                        <input
                          type="text"
                          value={username}
                          onChange={(event) => setUsername(event.target.value)}
                          placeholder="Choose a username"
                        />
                      </label>
                      <label className="profile-field">
                        Timezone / Region
                        <input
                          type="text"
                          value={region}
                          onChange={(event) => setRegion(event.target.value)}
                          placeholder="e.g. Africa/Johannesburg"
                        />
                      </label>
                    </div>

                    <div className="profile-section">
                      <h3>App preferences</h3>
                      <label className="profile-field">
                        Language
                        <select
                          value={appLanguage}
                          onChange={(event) =>
                            setAppLanguage(event.target.value as AppPreferences["language"])
                          }
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
                      <label className="profile-field">
                        Lesson difficulty
                        <select
                          value={appLessonDifficulty}
                          onChange={(event) =>
                            setAppLessonDifficulty(
                              event.target.value as AppPreferences["lessonDifficulty"]
                            )
                          }
                        >
                          <option value="easy">Easy</option>
                          <option value="balanced">Balanced</option>
                          <option value="challenge">Challenge</option>
                        </select>
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={notifyMessaging}
                          onChange={(event) => setNotifyMessaging(event.target.checked)}
                        />
                        {" "}Messaging notifications
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={notifyProgress}
                          onChange={(event) => setNotifyProgress(event.target.checked)}
                        />
                        {" "}Progress notifications
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={notifyReminders}
                          onChange={(event) => setNotifyReminders(event.target.checked)}
                        />
                        {" "}Study reminders
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={reducedDataMode}
                          onChange={(event) => setReducedDataMode(event.target.checked)}
                        />
                        {" "}Reduced data mode
                      </label>
                    </div>

                    <div className="profile-section">
                      <h3>Uniform avatar</h3>
                      <div className="profile-grid">
                        <ColorSwatchPicker
                          label="Skin tone"
                          value={avatarUniform.skinTone}
                          options={colorLabels.skin}
                          onChange={(next) =>
                            setAvatarUniform({ ...avatarUniform, skinTone: next })
                          }
                        />
                        <label className="profile-field">
                          Hair style
                          <select
                            value={avatarUniform.hairStyle}
                            onChange={(event) =>
                              setAvatarUniform({ ...avatarUniform, hairStyle: event.target.value })
                            }
                          >
                            {HAIR_STYLES.map((style) => (
                              <option key={style} value={style}>
                                {style}
                              </option>
                            ))}
                          </select>
                        </label>
                        <ColorSwatchPicker
                          label="Hair color"
                          value={avatarUniform.hairColor}
                          options={colorLabels.hair}
                          onChange={(next) =>
                            setAvatarUniform({ ...avatarUniform, hairColor: next })
                          }
                        />
                        <ColorSwatchPicker
                          label="Uniform top"
                          value={avatarUniform.topColor}
                          options={colorLabels.palette}
                          onChange={(next) =>
                            setAvatarUniform({ ...avatarUniform, topColor: next })
                          }
                        />
                        <ColorSwatchPicker
                          label="Uniform bottom"
                          value={avatarUniform.bottomColor}
                          options={colorLabels.palette}
                          onChange={(next) =>
                            setAvatarUniform({ ...avatarUniform, bottomColor: next })
                          }
                        />
                        <ColorSwatchPicker
                          label="Accent"
                          value={avatarUniform.accentColor}
                          options={colorLabels.palette}
                          onChange={(next) =>
                            setAvatarUniform({ ...avatarUniform, accentColor: next })
                          }
                        />
                      </div>
                    </div>

                    <div className="profile-section">
                      <h3>Casual avatar</h3>
                      <div className="profile-grid">
                        <ColorSwatchPicker
                          label="Skin tone"
                          value={avatarCasual.skinTone}
                          options={colorLabels.skin}
                          onChange={(next) => setAvatarCasual({ ...avatarCasual, skinTone: next })}
                        />
                        <label className="profile-field">
                          Hair style
                          <select
                            value={avatarCasual.hairStyle}
                            onChange={(event) =>
                              setAvatarCasual({ ...avatarCasual, hairStyle: event.target.value })
                            }
                          >
                            {HAIR_STYLES.map((style) => (
                              <option key={style} value={style}>
                                {style}
                              </option>
                            ))}
                          </select>
                        </label>
                        <ColorSwatchPicker
                          label="Hair color"
                          value={avatarCasual.hairColor}
                          options={colorLabels.hair}
                          onChange={(next) => setAvatarCasual({ ...avatarCasual, hairColor: next })}
                        />
                        <ColorSwatchPicker
                          label="Casual top"
                          value={avatarCasual.topColor}
                          options={colorLabels.palette}
                          onChange={(next) => setAvatarCasual({ ...avatarCasual, topColor: next })}
                        />
                        <ColorSwatchPicker
                          label="Casual bottom"
                          value={avatarCasual.bottomColor}
                          options={colorLabels.palette}
                          onChange={(next) =>
                            setAvatarCasual({ ...avatarCasual, bottomColor: next })
                          }
                        />
                        <ColorSwatchPicker
                          label="Accent"
                          value={avatarCasual.accentColor}
                          options={colorLabels.palette}
                          onChange={(next) =>
                            setAvatarCasual({ ...avatarCasual, accentColor: next })
                          }
                        />
                      </div>
                    </div>

                    <div className="profile-actions">
                      <button className="button" type="submit">
                        Save profile
                      </button>
                      <button className="button" type="button" onClick={handleLogout}>
                        Sign out
                      </button>
                    </div>
                  </form>
                )}

                <div className="profile-section">
                  <h3>Session security</h3>
                  <div className="profile-status-row">
                    <span className="badge">Unread alerts: {unreadSecurityAlertCount}</span>
                    <span className="badge">High risk: {highRiskSecurityAlertCount}</span>
                  </div>
                  <div className="profile-actions">
                    <button
                      className="button"
                      type="button"
                      onClick={() => void loadSessions()}
                      disabled={loadingSessions}
                    >
                      {loadingSessions ? "Refreshing..." : "Refresh sessions"}
                    </button>
                    <button
                      className="button"
                      type="button"
                      onClick={handleRevokeAllSessions}
                      disabled={revokeSessionsBusy}
                    >
                      {revokeSessionsBusy ? "Revoking..." : "Revoke all sessions"}
                    </button>
                    <button
                      className="button"
                      type="button"
                      onClick={() => void loadSecurityAlerts()}
                      disabled={loadingSecurityAlerts}
                    >
                      {loadingSecurityAlerts ? "Refreshing alerts..." : "Refresh alerts"}
                    </button>
                    <button
                      className="button"
                      type="button"
                      onClick={() => void handleMarkSecurityAlertsRead()}
                      disabled={markingSecurityAlertsRead || securityAlerts.length === 0}
                    >
                      {markingSecurityAlertsRead ? "Marking..." : "Mark alerts read"}
                    </button>
                    {highRiskSecurityAlertCount > 0 ? (
                      <button
                        className="button"
                        type="button"
                        onClick={handleRevokeAllSessions}
                        disabled={revokeSessionsBusy}
                      >
                        {revokeSessionsBusy ? "Revoking..." : "Revoke all now (high risk)"}
                      </button>
                    ) : null}
                  </div>
                  <div className="profile-actions">
                    <label className="profile-inline-field">
                      Alerts
                      <select
                        value={securityRiskFilter}
                        onChange={(event) =>
                          setSecurityRiskFilter(
                            event.target.value as "all" | "high" | "warn" | "info" | "unread"
                          )
                        }
                      >
                        <option value="all">All</option>
                        <option value="unread">Unread</option>
                        <option value="high">High risk</option>
                        <option value="warn">Warn</option>
                        <option value="info">Info</option>
                      </select>
                    </label>
                  </div>
                  <div className="profile-achievements">
                    {sessions.length === 0 && <p>No active sessions.</p>}
                    {sessions.map((activeSession) => (
                      <div key={activeSession.id} className="profile-achievement">
                        <strong>{activeSession.user_agent || "Unknown device"}</strong>
                        <p>IP: {activeSession.ip_address || "Unknown"}</p>
                        <small>Started {new Date(activeSession.created_at).toLocaleString()}</small>
                      </div>
                    ))}
                  </div>
                  <div className="profile-achievements">
                    {visibleSecurityAlerts.length === 0 && <p>No security alerts in this view.</p>}
                    {visibleSecurityAlerts.map((alert) => (
                      <div key={alert.id} className="profile-achievement">
                        <strong>
                          {alert.reason}
                          {alert.read_at ? " (read)" : " (new)"}
                        </strong>
                        <p>
                          Risk: {alert.risk_level.toUpperCase()} | IP: {alert.ip_address || "Unknown"}
                        </p>
                        <small>{new Date(alert.created_at).toLocaleString()}</small>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="profile-section">
                  <h3>Profile settings</h3>
                  <p className="profile-subtitle">
                    Favorites, likes, interests, and privacy controls were moved to Settings.
                  </p>
                  <p className="profile-subtitle">
                    Profile completion: {profileCompletion.percent}%{" "}
                    {profileCompletion.missing.length > 0
                      ? `(Missing: ${profileCompletion.missing.join(", ")})`
                      : "(Complete)"}
                  </p>
                  <p className="profile-subtitle">
                    Current summary: {favoriteBook ? `Book: ${favoriteBook}` : "No book set"} |{" "}
                    {favoriteMovie ? `Movie: ${favoriteMovie}` : "No movie set"} | Likes {likesTokens.length} | Interests{" "}
                    {interestTokens.length}
                  </p>
                  <div className="profile-actions">
                    <button
                      className="button"
                      type="button"
                      onClick={() => {
                        handleClose();
                        router.push("/settings");
                      }}
                    >
                      Open Settings
                    </button>
                  </div>
                </div>

                <div className="profile-section">
                  <h3>People to follow</h3>
                  <p className="profile-subtitle">
                    Ranked by shared school, location, and overlap in likes or interests.
                  </p>
                  <div className="profile-actions">
                    <button
                      className="button"
                      type="button"
                      onClick={() => {
                        void loadFriendSuggestions({ reset: true }).catch((error) =>
                          setNotice({
                            type: "error",
                            message: getApiErrorMessage(error, "Unable to refresh suggestions."),
                          })
                        );
                      }}
                      disabled={suggestionsLoading}
                    >
                      {suggestionsLoading ? "Refreshing..." : "Refresh suggestions"}
                    </button>
                    <button
                      className="button"
                      type="button"
                      onClick={() => void handleFollowTopSuggestion()}
                      disabled={!topSuggestionToFollow || Boolean(followingUserId)}
                    >
                      {followingUserId && topSuggestionToFollow?.user_id === followingUserId
                        ? "Following..."
                        : "Follow top match"}
                    </button>
                    <button
                      className="button"
                      type="button"
                      onClick={() => setDismissedSuggestionIds([])}
                      disabled={dismissedSuggestionIds.length === 0}
                    >
                      Restore dismissed ({dismissedSuggestionIds.length})
                    </button>
                  </div>
                  <div className="profile-actions">
                    <input
                      type="search"
                      value={suggestionFilterQuery}
                      onChange={(event) => setSuggestionFilterQuery(event.target.value)}
                      placeholder="Filter suggestions"
                    />
                    <label className="profile-inline-field">
                      Sort
                      <select
                        value={suggestionSortMode}
                        onChange={(event) =>
                          setSuggestionSortMode(event.target.value as "relevance" | "name" | "recent")
                        }
                      >
                        <option value="relevance">Relevance</option>
                        <option value="name">Name A-Z</option>
                        <option value="recent">Recent interactions</option>
                      </select>
                    </label>
                  </div>
                  <div className="profile-search-results">
                    <p className="profile-subtitle">
                      Showing {visibleFriendSuggestions.length} suggestion
                      {visibleFriendSuggestions.length === 1 ? "" : "s"}.
                    </p>
                    {!suggestionsLoading && visibleFriendSuggestions.length === 0 && (
                      <p>
                        {suggestionFilterQuery.trim() || dismissedSuggestionIds.length > 0
                          ? "No suggestions match your current filters."
                          : "No suggestions yet. Use Messaging to find people by username."}
                      </p>
                    )}
                    {visibleFriendSuggestions.map((suggestion) => (
                      <div key={suggestion.user_id} className="profile-suggestion">
                        <div>
                          <strong>{suggestion.name}</strong>
                          <span>{suggestion.username ? `@${suggestion.username}` : suggestion.email}</span>
                          <small className="profile-suggestion-meta">
                            {suggestion.reason_label ? `${suggestion.reason_label} | ` : ""}
                            Score {suggestion.relevance_score}
                            {suggestion.same_school ? " | Same school" : ""}
                            {suggestion.same_city ? " | Same city" : ""}
                            {suggestion.same_province ? " | Same province" : ""}
                            {Number(suggestion.shared_subjects || 0) > 0
                              ? ` | ${Number(suggestion.shared_subjects || 0)} shared subjects`
                              : ""}
                            {suggestion.shared_likes > 0
                              ? ` | ${suggestion.shared_likes} shared likes`
                              : ""}
                            {suggestion.shared_interests > 0
                              ? ` | ${suggestion.shared_interests} shared interests`
                              : ""}
                            {suggestion.mutual_follows > 0
                              ? ` | ${suggestion.mutual_follows} mutual follows`
                              : ""}
                            {suggestion.recent_interactions > 0
                              ? ` | ${suggestion.recent_interactions} recent interactions`
                              : ""}
                          </small>
                        </div>
                        <div className="profile-suggestion-actions">
                          <button
                            className="button"
                            type="button"
                            disabled={
                              suggestion.already_following || followingUserId === suggestion.user_id
                            }
                            onClick={() => void handleFollowUser(suggestion.user_id)}
                          >
                            {suggestion.already_following
                              ? "Following"
                              : followingUserId === suggestion.user_id
                                ? "Following..."
                                : "Follow"}
                          </button>
                          <button
                            className="button"
                            type="button"
                            disabled={mutingUserId === suggestion.user_id}
                            onClick={() => void handleMuteUser(suggestion.user_id)}
                          >
                            {mutingUserId === suggestion.user_id ? "Muting..." : "Mute"}
                          </button>
                          <button
                            className="button"
                            type="button"
                            disabled={blockingUserId === suggestion.user_id}
                            onClick={() => void handleBlockUser(suggestion.user_id)}
                          >
                            {blockingUserId === suggestion.user_id ? "Blocking..." : "Block"}
                          </button>
                          <button
                            className="button"
                            type="button"
                            onClick={() => handleDismissSuggestion(suggestion.user_id)}
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ))}
                    {suggestionsHasMore && (
                      <button
                        className="button"
                        type="button"
                        onClick={() => {
                          void loadFriendSuggestions({
                            cursor: suggestionsNextCursor,
                            reset: false,
                          }).catch((error) =>
                            setNotice({
                              type: "error",
                              message: getApiErrorMessage(error, "Unable to load more suggestions."),
                            })
                          );
                        }}
                        disabled={suggestionsLoading}
                      >
                        {suggestionsLoading ? "Loading..." : "Load more"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="profile-section">
                  <h3>Muted and blocked users</h3>
                  <div className="profile-actions">
                    <button
                      className="button"
                      type="button"
                      onClick={() => {
                        void loadRelationships().catch((error) =>
                          setNotice({
                            type: "error",
                            message: getApiErrorMessage(error, "Unable to refresh relationships."),
                          })
                        );
                      }}
                      disabled={relationshipsLoading}
                    >
                      {relationshipsLoading ? "Refreshing..." : "Refresh lists"}
                    </button>
                  </div>
                  <div className="profile-relationships-grid">
                    <div>
                      <h4>Blocked</h4>
                      {blockedRelationships.length === 0 && <p>No blocked users.</p>}
                      {blockedRelationships.map((row) => (
                        <div key={row.user_id} className="profile-suggestion">
                          <div>
                            <strong>{row.name}</strong>
                            <span>{row.username ? `@${row.username}` : row.email}</span>
                          </div>
                          <button
                            className="button"
                            type="button"
                            disabled={relationshipActionUserId === row.user_id}
                            onClick={() => void handleRemoveRelationship(row.user_id, "blocked")}
                          >
                            {relationshipActionUserId === row.user_id ? "Updating..." : "Unblock"}
                          </button>
                        </div>
                      ))}
                    </div>
                    <div>
                      <h4>Muted</h4>
                      {mutedRelationships.length === 0 && <p>No muted users.</p>}
                      {mutedRelationships.map((row) => (
                        <div key={row.user_id} className="profile-suggestion">
                          <div>
                            <strong>{row.name}</strong>
                            <span>{row.username ? `@${row.username}` : row.email}</span>
                          </div>
                          <button
                            className="button"
                            type="button"
                            disabled={relationshipActionUserId === row.user_id}
                            onClick={() => void handleRemoveRelationship(row.user_id, "muted")}
                          >
                            {relationshipActionUserId === row.user_id ? "Updating..." : "Unmute"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="profile-section">
                  <StreakHeatmap />
                </div>

                <div className="profile-section">
                  <BadgeWall />
                </div>

                <div className="profile-section">
                  <LearningPathTree />
                </div>

                <div className="profile-section">
                  <PdfExportButton />
                </div>

                <div className="profile-section">
                  <h3>Achievements</h3>
                  <form className="profile-form" onSubmit={handleAddAchievement}>
                    <label className="profile-field">
                      Title
                      <input
                        type="text"
                        value={achievementTitle}
                        onChange={(event) => setAchievementTitle(event.target.value)}
                        required
                      />
                    </label>
                    <label className="profile-field">
                      Category
                      <select
                        value={achievementCategory}
                        onChange={(event) =>
                          setAchievementCategory(event.target.value as "academic" | "extracurricular")
                        }
                      >
                        <option value="academic">Academic</option>
                        <option value="extracurricular">Extracurricular</option>
                      </select>
                    </label>
                    <label className="profile-field">
                      Date achieved
                      <input
                        type="date"
                        value={achievementDate}
                        onChange={(event) => setAchievementDate(event.target.value)}
                      />
                    </label>
                    <label className="profile-field">
                      Description
                      <textarea
                        value={achievementDescription}
                        onChange={(event) => setAchievementDescription(event.target.value)}
                      />
                    </label>
                    <button className="button" type="submit">
                      Post achievement
                    </button>
                  </form>

                  <div className="profile-achievements">
                    {achievements.length === 0 && <p>No achievements yet.</p>}
                    {achievements.map((achievement) => (
                      <div key={achievement.id} className="profile-achievement">
                        <div>
                          <strong>{achievement.title}</strong>
                          <span>{achievement.category}</span>
                        </div>
                        <p>{achievement.description || "No description yet."}</p>
                        <small>
                          {achievement.achieved_on
                            ? `Achieved on ${achievement.achieved_on}`
                            : "Date not set"}
                        </small>
                      </div>
                    ))}
                  </div>
                </div>
              </>
              )}
            </div>
            {showTutorModal && (
              <>
                <button
                  className="tutor-modal-overlay"
                  type="button"
                  onClick={() => setShowTutorModal(false)}
                />
                <div className="tutor-modal glass">
                  <h3>Find a Tutor</h3>
                  <p className="profile-subtitle">
                    Browse verified tutors, request sessions, and manage bookings inside the tutor
                    marketplace.
                  </p>
                  <div className="profile-form">
                    <label className="profile-field">
                      Subject or topic
                      <input
                        type="search"
                        value={tutorSearchQuery}
                        onChange={(event) => setTutorSearchQuery(event.target.value)}
                        placeholder={preferredTutorQuery ? `Try ${preferredTutorQuery}` : "e.g. Algebra"}
                      />
                    </label>
                    <label className="profile-field">
                      Grade (optional)
                      <input
                        type="text"
                        value={tutorGradeFilter}
                        onChange={(event) => setTutorGradeFilter(event.target.value)}
                        placeholder="e.g. 10"
                      />
                    </label>
                    <button
                      className="button"
                      type="button"
                      onClick={openTutorDirectory}
                    >
                      Browse tutors
                    </button>
                    <button
                      className="button"
                      type="button"
                      onClick={() => {
                        setShowTutorModal(false);
                        router.push("/tutors/onboarding");
                      }}
                    >
                      Become a tutor
                    </button>
                  </div>
                  <p className="profile-subtitle">{PLATFORM_INVARIANT}</p>
                </div>
              </>
            )}
    </>,
    document.body
  ) as unknown as ReactNode;
}
