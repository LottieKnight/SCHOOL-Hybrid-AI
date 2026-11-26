"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import { useSession } from "@/components/SessionProvider";
import { StateCard } from "@/components/ui/StateCard";
import { MusicProfilePanel } from "@/components/MusicProfilePanel";
import { MusicProfileEditor } from "@/components/MusicProfileEditor";
import { PressPublications } from "@/components/press/PressPublications";
import type { MusicProfileData } from "@/lib/musicConstants";
import styles from "./page.module.css";

type AvatarSettings = {
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  topColor: string;
  bottomColor: string;
  accentColor: string;
};

type Achievement = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  achieved_on: string | null;
};

type TopGame = {
  game_type: string;
  score: number;
  played_at: string;
};

type PublicProfile = {
  username: string;
  city: string | null;
  province: string | null;
  country: string | null;
  schoolName: string | null;
  avatarUniform: AvatarSettings | null;
  interests: string[];
  likes: string[];
  achievements: Achievement[];
  topGames: TopGame[];
  followingCount: number | null;
  followerCount: number | null;
  isSelf: boolean;
  isFollowing: boolean;
  followsYou: boolean;
  mutualConnections: { id: string; username: string | null; avatar_uniform: unknown }[];
  joinedAt: string;
  userId?: string;
};

const gameLabels: Record<string, string> = {
  exam_dash: "Exam Dash",
  memory: "Memory",
  quiz_rush: "Quiz Rush",
  budget_block: "Budget Block",
  citation_sprint: "Citation Sprint",
  sars_tax_dash: "SARS Tax Dash",
  source_sorter: "Source Sorter",
  lease_trap: "Lease Trap",
  cv_optimizer: "CV Optimizer",
  graph_lie_detector: "Graph Lie Detector",
  email_etiquette: "Email Etiquette",
  debate_clock: "Debate Clock",
  plain_language: "Plain Language",
  interview_survival: "Interview Survival",
};

function AvatarFigure({ settings }: { settings: AvatarSettings }) {
  return (
    <div
      className={`avatar avatar--full ${styles.avatarFigure}`}
      data-hair={settings.hairStyle}
      style={{
        ["--skin" as string]: settings.skinTone,
        ["--hair" as string]: settings.hairColor,
        ["--top" as string]: settings.topColor,
        ["--bottom" as string]: settings.bottomColor,
        ["--accent" as string]: settings.accentColor,
      } as React.CSSProperties}
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

const DEFAULT_AVATAR: AvatarSettings = {
  skinTone: "#d9a98f",
  hairStyle: "short",
  hairColor: "#4a3128",
  topColor: "#2d3b6f",
  bottomColor: "#2f2f2f",
  accentColor: "#f5c04f",
};

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { session } = useSession();
  const apiBase = API_BASE;
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [messagingOpen, setMessagingOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [endorsements, setEndorsements] = useState<{ skill_label: string; count: string; has_endorsed_by_me: boolean }[]>([]);
  const [endorseSkill, setEndorseSkill] = useState("");
  const [musicProfile, setMusicProfile] = useState<MusicProfileData | null>(null);
  const [musicLoading, setMusicLoading] = useState(true);
  const [editingMusic, setEditingMusic] = useState(false);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  type ActivityItem = {
    id: string;
    kind: "post" | "comment";
    content: string;
    moduleCode: string | null;
    createdAt: string;
  };

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const response = await fetch(`${apiBase}/profile/users/${encodeURIComponent(username)}`, {
        credentials: "include",
      });
      if (response.status === 404) {
        setNotFound(true);
        return;
      }
      if (!response.ok) throw new Error("Failed to load profile.");
      const data = (await response.json()) as PublicProfile;
      setProfile(data);
      setFollowing(data.isFollowing);
    } catch (error) {
      setNotice(getApiErrorMessage(error, "Could not load this profile."));
    } finally {
      setLoading(false);
    }
  }, [apiBase, username]);

  useEffect(() => {
    if (session !== undefined) loadProfile();
  }, [loadProfile, session]);

  const toggleFollow = async () => {
    if (!session || !profile || followLoading) return;
    setFollowLoading(true);
    setNotice(null);
    try {
      if (following) {
        const response = await fetch(`${apiBase}/profile/following/${profile.userId ?? ""}`, {
          method: "DELETE",
          credentials: "include",
          headers: { "x-csrf-token": session.csrfToken },
        });
        if (!response.ok) throw new Error("Could not unfollow.");
        setFollowing(false);
      } else {
        const response = await fetch(`${apiBase}/profile/following`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", "x-csrf-token": session.csrfToken },
          body: JSON.stringify({ userId: profile.userId }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error((data as Record<string, string>).error || "Could not follow.");
        }
        setFollowing(true);
      }
    } catch (error) {
      setNotice(getApiErrorMessage(error, "Action failed. Please try again."));
    } finally {
      setFollowLoading(false);
    }
  };

  const openDirectMessage = async (targetUserId: string) => {
    if (!session || !targetUserId) return;
    setMessagingOpen(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/messages/conversations/direct/${targetUserId}`, {
        method: "POST",
        credentials: "include",
        headers: { "x-csrf-token": session.csrfToken },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error((data as Record<string, string>)?.error || "Could not open messages.");
      }
      window.location.href = `/messages?conversationId=${encodeURIComponent((data as { conversation?: { id?: string } })?.conversation?.id ?? "")}`;
    } catch (error) {
      setNotice(getApiErrorMessage(error, "Could not open messages."));
    } finally {
      setMessagingOpen(false);
    }
  };

  const loadEndorsements = useCallback(async (uid: string) => {
    const res = await fetch(`/api/profile/endorsements?userId=${uid}`, { credentials: "include" });
    if (res.ok) {
      const data = (await res.json()) as { endorsements: typeof endorsements };
      setEndorsements(data.endorsements ?? []);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (profile?.userId) loadEndorsements(profile.userId);
  }, [profile?.userId, loadEndorsements]);

  useEffect(() => {
    if (!profile) return;
    const url = profile.isSelf
      ? `${API_BASE}/profile/music/me`
      : profile.userId
      ? `${API_BASE}/profile/music/${profile.userId}`
      : null;
    if (!url) { setMusicLoading(false); return; }
    fetch(url, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: MusicProfileData | null) => setMusicProfile(data))
      .catch(() => setMusicProfile(null))
      .finally(() => setMusicLoading(false));
  }, [profile]);

  useEffect(() => {
    if (!profile?.userId) { setActivityLoading(false); return; }
    fetch(`/api/profile/activity?userId=${encodeURIComponent(profile.userId)}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { activity?: ActivityItem[] } | null) => setActivity(data?.activity ?? []))
      .catch(() => setActivity([]))
      .finally(() => setActivityLoading(false));
  }, [profile?.userId]);

  const sendEndorsement = async (skill: string) => {
    if (!profile?.userId || !skill.trim()) return;
    const res = await fetch("/api/profile/endorsements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ endorseeId: profile.userId, skill: skill.trim() }),
    });
    if (res.ok && profile.userId) {
      setEndorseSkill("");
      await loadEndorsements(profile.userId);
    } else {
      const err = (await res.json()) as { error?: string };
      setNotice(err.error ?? "Could not send endorsement.");
    }
  };

  if (loading) {
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <StateCard title="Loading profile" description="Fetching this student's public profile." />
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <StateCard
            title="Profile not found"
            description="This student's profile is private, doesn't exist, or has been removed."
          />
        </div>
      </div>
    );
  }

  const avatar = (profile.avatarUniform as AvatarSettings | null) ?? DEFAULT_AVATAR;
  const location = [profile.city, profile.province].filter(Boolean).join(", ");

  return (
    <div className="route-lock-dock">
      <div className="route-lock-frame glass card">
        <div className={styles.backRow}>
          <Link className="button" href="/community">
            ← Community
          </Link>
        </div>

        {notice && <p className={`${styles.notice} ${styles.error}`}>{notice}</p>}

        <div className={styles.hero}>
          <div className={styles.avatarWrap}>
            <AvatarFigure settings={avatar} />
          </div>
          <div className={styles.heroInfo}>
            <h1 className={styles.displayName}>@{profile.username}</h1>
            {(location || profile.schoolName) && (
              <p className="subtitle">
                {[location, profile.schoolName].filter(Boolean).join(" · ")}
              </p>
            )}
            <p className={styles.joined}>
              Member since {new Date(profile.joinedAt).toLocaleDateString("en-ZA", { month: "long", year: "numeric" })}
            </p>
            {!profile.isSelf && session && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <button
                  className={`button ${following ? styles.followingBtn : ""}`}
                  onClick={toggleFollow}
                  disabled={followLoading}
                >
                  {followLoading ? "..." : following ? "Following" : "Follow"}
                </button>
                <button
                  className="button"
                  type="button"
                  onClick={() => void openDirectMessage(profile.userId ?? "")}
                  disabled={!profile.userId || messagingOpen}
                >
                  {messagingOpen ? "Opening..." : "Message"}
                </button>
                {profile.followsYou && (
                  <span className={styles.mutualBadge} title="This user follows you back">
                    🤝 You follow each other
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {(profile.followerCount !== null || profile.followingCount !== null) && (
          <div className={styles.socialRow}>
            {profile.followerCount !== null && (
              <Link href={`/profile/${profile.username}/followers`}>
                <strong>{profile.followerCount}</strong> followers
              </Link>
            )}
            {profile.followingCount !== null && (
              <Link href={`/profile/${profile.username}/following`}>
                <strong>{profile.followingCount}</strong> following
              </Link>
            )}
          </div>
        )}

        {profile.isSelf && (() => {
          const pct = Math.min(100,
            (profile.avatarUniform ? 20 : 0) +
            ((profile.interests.length > 0 || profile.likes.length > 0) ? 15 : 0) +
            (profile.schoolName ? 15 : 0) +
            (profile.topGames.length > 0 ? 10 : 0) +
            ((profile.followerCount ?? 0) > 0 ? 10 : 0) +
            (profile.achievements.length > 0 ? 15 : 0) +
            ((profile.followingCount ?? 0) >= 5 ? 15 : 0)
          );
          const label = pct >= 90 ? "Complete" : pct >= 60 ? "Academic Profile" : pct >= 35 ? "Building Up" : "Getting Started";
          const grad = `conic-gradient(#e8c15a ${pct * 3.6}deg, rgba(54,45,30,0.1) 0deg)`;
          return (
            <div className={styles.section} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: grad, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--surface-1, #fff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700 }}>
                  {pct}%
                </div>
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "0.88rem" }}>Profile Strength: {label}</p>
                <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--muted)" }}>
                  {pct < 100 ? "Complete your profile to reach 100%." : "Your profile is fully complete!"}
                </p>
              </div>
            </div>
          );
        })()}

        {profile.mutualConnections.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Mutual connections</h2>
            <div className={styles.mutualRow}>
              {profile.mutualConnections.map((m) => (
                <Link
                  key={m.id}
                  href={`/profile/${m.username ?? ""}`}
                  className={styles.mutualLink}
                  style={{ textDecoration: "none" }}
                >
                  {m.username ? `@${m.username}` : "Student"}
                </Link>
              ))}
            </div>
          </div>
        )}

        {(profile.interests.length > 0 || profile.likes.length > 0) && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Interests</h2>
            <div className={styles.tagRow}>
              {[...profile.interests, ...profile.likes].slice(0, 12).map((tag) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {profile.topGames.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Games</h2>
            <div className={styles.gameGrid}>
              {profile.topGames.map((game) => (
                <div key={game.game_type} className={styles.gameCard}>
                  <span className={styles.gameLabel}>{gameLabels[game.game_type] ?? game.game_type}</span>
                  <span className={styles.gameScore}>{game.score.toLocaleString()} pts</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {profile.achievements.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Achievements</h2>
            <div className={styles.achievementList}>
              {profile.achievements.map((a) => (
                <div key={a.id} className={styles.achievement}>
                  <strong>{a.title}</strong>
                  {a.description && <p className="subtitle">{a.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {profile.topGames.length === 0 && profile.achievements.length === 0 && (
          <p className={styles.empty}>This student hasn&apos;t played any games or earned achievements yet.</p>
        )}

        {!activityLoading && activity.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Recent community activity</h2>
            <div className={styles.activityList}>
              {activity.map((item) => (
                <div key={item.id} className={styles.activityItem}>
                  <span className={styles.activityKind}>{item.kind === "post" ? "📝 post" : "💬 reply"}</span>
                  <div className={styles.activityBody}>
                    <p className={styles.activityContent}>{item.content.slice(0, 160)}{item.content.length > 160 ? "..." : ""}</p>
                    <span className={styles.activityMeta}>
                      {item.moduleCode ? `in ${item.moduleCode} · ` : ""}
                      {new Date(item.createdAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(endorsements.length > 0 || (!profile.isSelf && session)) && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Endorsements</h2>
            <div className={styles.tagRow} style={{ marginBottom: 10 }}>
              {endorsements.map((e) => (
                <span key={e.skill_label} className={styles.tag} title={`${e.count} endorsement${parseInt(e.count, 10) !== 1 ? "s" : ""}`}>
                  {e.skill_label} · {e.count}
                  {e.has_endorsed_by_me && " ✓"}
                </span>
              ))}
              {endorsements.length === 0 && <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>No endorsements yet.</span>}
            </div>
            {!profile.isSelf && session && (
              <form onSubmit={(e) => { e.preventDefault(); void sendEndorsement(endorseSkill); }} style={{ display: "flex", gap: 8 }}>
                <input
                  className="input"
                  placeholder="Endorse a skill (e.g. Research Skills)"
                  value={endorseSkill}
                  onChange={(ev) => setEndorseSkill(ev.target.value)}
                  maxLength={60}
                  style={{ flex: 1, fontSize: "0.82rem" }}
                />
                <button className="button" type="submit" style={{ fontSize: "0.82rem" }} disabled={!endorseSkill.trim()}>
                  Endorse
                </button>
              </form>
            )}
          </div>
        )}

        <PressPublications username={profile.username} isSelf={profile.isSelf} />

        {!musicLoading && (
          <>
            {editingMusic ? (
              <MusicProfileEditor
                initial={musicProfile}
                onSave={(updated) => {
                  setMusicProfile(updated);
                  setEditingMusic(false);
                }}
                onCancel={() => setEditingMusic(false)}
              />
            ) : musicProfile ? (
              <MusicProfilePanel
                profile={musicProfile}
                isSelf={profile.isSelf}
                onEdit={() => setEditingMusic(true)}
              />
            ) : profile.isSelf ? (
              <button
                type="button"
                onClick={() => setEditingMusic(true)}
                className={styles.addMusicBtn}
              >
                + Add your music identity
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
