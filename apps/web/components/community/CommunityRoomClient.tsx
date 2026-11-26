"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import Link from "next/link";
import PostCard from "@/components/community/PostCard";
import { Badge } from "@/components/ui/Badge";
import { buttonClassName } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { GuestPrompt } from "@/components/ui/GuestPrompt";
import { isCampusLifeRoom } from "@/lib/communityShared";
import type { RelatedQuestion } from "@/lib/communityShared";
import { playCoinSound } from "@/lib/sounds";
import type { CommunityComment, CommunityPost, CommunityReactionType, CommunityRoomView } from "@/lib/communityShared";
import styles from "@/app/community/rooms/[moduleCode]/page.module.css";

type QuestionFilter = "all" | "unanswered" | "my-modules" | "recent";

function filterPosts(posts: CommunityPost[], filter: QuestionFilter, roomCode: string) {
  const campusLifeRoom = isCampusLifeRoom(roomCode);

  switch (filter) {
    case "all":
      return campusLifeRoom ? posts : posts.filter((post) => post.postType === "question");
    case "unanswered":
      return posts.filter((post) => post.postType === "question" && !post.acceptedAnswerId);
    case "my-modules":
      return posts;
    case "recent":
      return [...posts].sort(
        (left, right) =>
          new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime()
      );
    default:
      return posts;
  }
}

function formatExamCountdown(days: number) {
  if (days <= 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

type CommunityRoomClientProps = {
  room: CommunityRoomView;
  currentUserId: string | null;
};

export default function CommunityRoomClient({ room, currentUserId }: CommunityRoomClientProps) {
  const [filter, setFilter] = useState<QuestionFilter>("all");
  const { isIdle } = useSession();
  const [posts, setPosts] = useState(room.posts);
  const [error, setError] = useState<string | null>(null);
  const [acceptingCommentId, setAcceptingCommentId] = useState<string | null>(null);
  const [submittingCommentPostId, setSubmittingCommentPostId] = useState<string | null>(null);
  const [pendingReactionKey, setPendingReactionKey] = useState<string | null>(null);
  const [resharingPostId, setResharingPostId] = useState<string | null>(null);
  const draftKey = currentUserId ? `community_draft:${room.moduleCode}:${currentUserId}` : null;

  function readDraft(): string {
    if (!draftKey) return "";
    try { return localStorage.getItem(draftKey) ?? ""; } catch { return ""; }
  }

  const [composerValue, setComposerValue] = useState(() => readDraft());
  const [composerType, setComposerType] = useState<CommunityPost["postType"]>("question");
  const [composerAnonymous, setComposerAnonymous] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [hasDraft, setHasDraft] = useState(() => readDraft().trim().length > 0);
  const [followedPageCodes, setFollowedPageCodes] = useState<string[]>([]);
  const [roomSearch, setRoomSearch] = useState("");
  const [newRoomPostsCount, setNewRoomPostsCount] = useState(0);
  const [incomingRoomPosts, setIncomingRoomPosts] = useState<CommunityPost[]>([]);
  const newestRoomTimestamp = useRef<string | null>(
    room.posts.length > 0 ? room.posts[0]?.createdAt ?? null : null
  );

  const [relatedQuestions, setRelatedQuestions] = useState<RelatedQuestion[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const insertMarkdown = useCallback((syntax: { wrap?: [string, string]; prefix?: string }) => {
    const el = composerRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    setComposerValue((value) => {
      const selected = value.slice(start, end);
      if (syntax.wrap) {
        const [before, after] = syntax.wrap;
        const placeholder = selected || "text";
        const newValue = value.slice(0, start) + before + placeholder + after + value.slice(end);
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(start + before.length, start + before.length + placeholder.length);
        });
        return newValue;
      }
      if (syntax.prefix) {
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const newValue = value.slice(0, lineStart) + syntax.prefix + value.slice(lineStart);
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(start + syntax.prefix!.length, start + syntax.prefix!.length);
        });
        return newValue;
      }
      return value;
    });
  }, []);

  const normalizedRoomCode = room.moduleCode.trim().toUpperCase();
  const isFollowingRoom = followedPageCodes.includes(normalizedRoomCode);

  useEffect(() => {
    if (!currentUserId) {
      setFollowedPageCodes([]);
      return;
    }

    let active = true;
    fetch("/api/community/pages/follow", {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json().catch(() => null)) as { followedPageCodes?: string[] } | null;
      })
      .then((payload) => {
        if (!active || !Array.isArray(payload?.followedPageCodes)) return;
        setFollowedPageCodes(payload.followedPageCodes);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [currentUserId]);

  useEffect(() => {
    fetch(`/api/community/related?moduleCode=${encodeURIComponent(room.moduleCode)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d: { questions?: RelatedQuestion[] }) => { if (d.questions?.length) setRelatedQuestions(d.questions); })
      .catch(() => undefined);
  }, [room.moduleCode]);

  // Poll for new room posts every 45s — pauses when idle
  useEffect(() => {
    if (isIdle) return;
    const interval = setInterval(async () => {
      const since = newestRoomTimestamp.current;
      if (!since) return;
      try {
        const url = `/api/community/questions?since=${encodeURIComponent(since)}&limit=20`;
        const res = await fetch(url, { credentials: "include", cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { posts?: CommunityPost[] };
        const fresh = (data.posts ?? []).filter((p) => p.moduleCode.toUpperCase() === room.moduleCode.toUpperCase());
        if (fresh.length > 0) {
          setIncomingRoomPosts(fresh);
          setNewRoomPostsCount(fresh.length);
        }
      } catch { /* silent */ }
    }, 45_000);
    return () => clearInterval(interval);
  }, [isIdle, room.moduleCode]);

  useEffect(() => {
    if (!draftKey) return;
    const timer = setTimeout(() => {
      try {
        if (composerValue.trim()) {
          localStorage.setItem(draftKey, composerValue);
          setHasDraft(true);
        } else {
          localStorage.removeItem(draftKey);
          setHasDraft(false);
        }
      } catch { /* storage unavailable */ }
    }, 2000);
    return () => clearTimeout(timer);
  }, [composerValue, draftKey]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Escape") {
        setShowShortcuts(false);
        setRoomSearch("");
        return;
      }
      if (event.key === "?") {
        if (!isTyping) { event.preventDefault(); setShowShortcuts((v) => !v); }
        return;
      }
      if (isTyping) return;
      if (event.key === "n") {
        event.preventDefault();
        composerRef.current?.focus();
        composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const campusLifeRoom = isCampusLifeRoom(room.moduleCode);
  const filteredPosts = useMemo(() => {
    const base = filterPosts(posts, filter, room.moduleCode);
    if (!roomSearch.trim()) return base;
    const q = roomSearch.toLowerCase();
    return base.filter((p) => p.content.toLowerCase().includes(q));
  }, [filter, posts, room.moduleCode, roomSearch]);

  const tabCounts = useMemo(
    () => ({
      all: posts.filter((post) => post.postType === "question").length,
      unanswered: posts.filter((post) => post.postType === "question" && !post.acceptedAnswerId).length,
      "my-modules": posts.length,
      recent: posts.length,
    }),
    [posts]
  );

  const handleAcceptAnswer = async (post: CommunityPost, comment: CommunityComment) => {
    setError(null);
    setAcceptingCommentId(comment.id);

    try {
      const response = await fetch("/api/community/comments/accept", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          postId: post.id,
          commentId: comment.id,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        alreadyAwarded?: boolean;
        creditsAwarded?: number;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Unable to accept this answer.");
      }

      setPosts((current) =>
        current.map((currentPost) =>
          currentPost.id !== post.id
            ? currentPost
            : {
                ...currentPost,
                acceptedAnswerId: comment.id,
                comments: currentPost.comments.map((entry) => ({
                  ...entry,
                  isAccepted: entry.id === comment.id,
                })),
              }
        )
      );
      playCoinSound();
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "Unable to accept this answer.");
    } finally {
      setAcceptingCommentId(null);
    }
  };

  const handleCreatePost = async () => {
    if (!currentUserId) {
      setError("Sign in to create a post in this room.");
      return;
    }

    const content = composerValue.trim();
    if (!content) {
      setError("Write something before posting.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/community/posts", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          moduleCode: room.moduleCode,
          moduleName: room.moduleName,
          content,
          postType: composerType,
          isAnonymous: composerAnonymous,
          ...(composerType === "poll" ? { pollOptions: pollOptions.map((o) => o.trim()).filter(Boolean) } : {}),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        post?: CommunityPost;
      };

      if (!response.ok || !payload.post) {
        throw new Error(payload.error || "Unable to create this post.");
      }

      setPosts((current) => [payload.post!, ...current]);
      setComposerValue("");
      setHasDraft(false);
      if (draftKey) { try { localStorage.removeItem(draftKey); } catch { /* ignore */ } }
      if (payload.post.postType !== "question" && filter === "all") {
        setFilter("recent");
      }
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create this post.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateComment = async (post: CommunityPost, content: string) => {
    if (!currentUserId) {
      setError("Sign in to reply in this room.");
      return;
    }

    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    setError(null);
    setSubmittingCommentPostId(post.id);

    try {
      const response = await fetch("/api/community/comments", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          postId: post.id,
          content: trimmed,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        comment?: CommunityComment;
      };

      if (!response.ok || !payload.comment) {
        throw new Error(payload.error || "Unable to post this reply.");
      }

      setPosts((current) =>
        current.map((entry) =>
          entry.id !== post.id
            ? entry
            : {
                ...entry,
                comments: [...entry.comments, payload.comment!],
                commentCount: entry.commentCount + 1,
                updatedAt: payload.comment!.createdAt,
              }
        )
      );
    } catch (commentError) {
      setError(commentError instanceof Error ? commentError.message : "Unable to post this reply.");
      throw commentError;
    } finally {
      setSubmittingCommentPostId(null);
    }
  };

  const handleToggleReaction = async (post: CommunityPost, reactionType: CommunityReactionType) => {
    if (!currentUserId) {
      setError("Sign in to react inside this room.");
      return;
    }

    setError(null);
    const reactionKey = `${post.id}:${reactionType}`;
    setPendingReactionKey(reactionKey);

    try {
      const response = await fetch("/api/community/reactions", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          postId: post.id,
          reactionType,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        active?: boolean;
      };

      if (!response.ok || typeof payload.active !== "boolean") {
        throw new Error(payload.error || "Unable to update this reaction.");
      }

      setPosts((current) =>
        current.map((entry) => {
          if (entry.id !== post.id) {
            return entry;
          }

          const nextCount = Math.max(
            0,
            (entry.reactionCounts[reactionType] ?? 0) + (payload.active ? 1 : -1)
          );
          const nextActiveReactions = payload.active
            ? Array.from(new Set([...entry.activeReactions, reactionType]))
            : entry.activeReactions.filter((value) => value !== reactionType);

          return {
            ...entry,
            reactionCounts: {
              ...entry.reactionCounts,
              [reactionType]: nextCount,
            },
            activeReactions: nextActiveReactions,
            sameQuestionCount:
              reactionType === "same_question" ? nextCount : entry.sameQuestionCount,
          };
        })
      );
    } catch (reactionError) {
      setError(reactionError instanceof Error ? reactionError.message : "Unable to update this reaction.");
    } finally {
      setPendingReactionKey(null);
    }
  };

  const handleReshare = async (post: CommunityPost) => {
    if (!currentUserId) {
      setError("Sign in to reshare posts.");
      return;
    }

    setError(null);
    setResharingPostId(post.id);

    try {
      const response = await fetch("/api/community/posts/reshare", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          moduleCode: post.moduleCode,
          moduleName: room.moduleName,
          content: post.content,
          sourceAuthor: post.authorName,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        post?: CommunityPost;
      };
      if (!response.ok || !payload.post) {
        throw new Error(payload.error || "Unable to reshare this post.");
      }
      setPosts((current) => [payload.post!, ...current]);
    } catch (reshareError) {
      setError(reshareError instanceof Error ? reshareError.message : "Unable to reshare this post.");
    } finally {
      setResharingPostId(null);
    }
  };

  const handleToggleFollow = async () => {
    if (!currentUserId) {
      setError("Sign in to follow community pages.");
      return;
    }

    setError(null);
    try {
      const response = await fetch("/api/community/pages/follow", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pageCode: normalizedRoomCode }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        followedPageCodes?: string[];
      };
      if (!response.ok || !Array.isArray(payload.followedPageCodes)) {
        throw new Error(payload.error || "Unable to update followed pages.");
      }
      setFollowedPageCodes(payload.followedPageCodes);
    } catch (followError) {
      setError(followError instanceof Error ? followError.message : "Unable to update followed pages.");
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <span className="eyebrow">Community Room</span>
          <div className={styles.headerTitle}>
            <h1>{room.moduleCode}</h1>
            <span className="institution-pill">{room.moduleName}</span>
          </div>
          <p className="assistant-helper">
            {campusLifeRoom
              ? "Post varsity life updates, student events, freshers moments, and campus discussion in one place."
              : "Ask the campus, share resources, and keep module-specific discussion in one place."}
          </p>
          <div className={styles.roomTagRow}>
            {room.institutionShortName || room.institutionName ? (
              <span className="institution-pill">{room.institutionShortName || room.institutionName}</span>
            ) : null}
            {room.faculty ? <Badge variant="neutral" className="skeu-badge">{room.faculty}</Badge> : null}
          </div>
        </div>

        <div className={styles.roomTagRow}>
          <Link className={buttonClassName({ variant: "outline", size: "sm", className: "skeu-btn-ghost" })} href="/community">
            Community hub
          </Link>
          <Link className={buttonClassName({ variant: "outline", size: "sm", className: "skeu-btn-ghost" })} href="/community/questions">
            Ask the Campus
          </Link>
          <button
            type="button"
            className={buttonClassName({ variant: "outline", size: "sm", className: "skeu-btn-ghost" })}
            onClick={() => void handleToggleFollow()}
          >
            {isFollowingRoom ? "Following page" : "Follow page"}
          </button>
          <Link className="button skeu-btn" href="/tutor">
            Launch AI Assistant
          </Link>
          <Link className={buttonClassName({ variant: "outline", size: "sm", className: "skeu-btn-ghost" })} href="/profile/learning">
            Your learning
          </Link>
        </div>
      </header>

      {error ? <div className="assistant-error">{error}</div> : null}

      {room.examCountdown && room.examCountdown.daysRemaining <= 14 ? (
        <div style={{ background: "color-mix(in srgb, #ef4444 8%, transparent)", border: "1px solid color-mix(in srgb, #ef4444 30%, transparent)", borderRadius: "var(--r-md)", padding: "10px 16px", display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", color: "var(--text-1)" }}>
          <span style={{ fontWeight: 700, color: "#ef4444" }}>⚡ Exam Mode</span>
          <span>{room.examCountdown.subject} in {room.examCountdown.daysRemaining === 0 ? "today" : `${room.examCountdown.daysRemaining} day${room.examCountdown.daysRemaining === 1 ? "" : "s"}`} — accepted answers earn <strong>2× Scholar Credits</strong> this week.</span>
        </div>
      ) : null}

      <div className={styles.layout}>
        <section className={styles.feed}>
          {!currentUserId && (
            <GuestPrompt reason="post in this room" />
          )}
          <Card className={styles.composerWrap}>
            <CardHeader>
              <CardTitle>Start a Post</CardTitle>
            </CardHeader>
            <CardBody>
              <div className={styles.composerTypeRow}>
                {([
                  ["question", "Ask a question"],
                  ["resource", "Share a resource"],
                  ["general", "General note"],
                  ["poll", "Poll"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.composerTypeButton} ${composerType === value ? styles.composerTypeButtonActive : ""}`}
                    onClick={() => setComposerType(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "4px" }}>
                {[
                  { label: "B", title: "Bold", wrap: ["**", "**"] as [string, string] },
                  { label: "I", title: "Italic", wrap: ["*", "*"] as [string, string] },
                  { label: "`", title: "Inline code", wrap: ["`", "`"] as [string, string] },
                  { label: "```", title: "Code block", wrap: ["```\n", "\n```"] as [string, string] },
                  { label: "—", title: "Bullet list", prefix: "- " },
                  { label: "1.", title: "Numbered list", prefix: "1. " },
                ].map((btn) => (
                  <button
                    key={btn.label}
                    type="button"
                    title={btn.title}
                    disabled={!currentUserId}
                    onClick={() => insertMarkdown("wrap" in btn ? { wrap: btn.wrap } : { prefix: btn.prefix })}
                    style={{
                      minWidth: btn.label === "```" ? 36 : 28,
                      height: 28,
                      padding: "0 6px",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--r-sm, 4px)",
                      background: "var(--surface-2)",
                      color: "var(--text-2)",
                      fontFamily: "var(--font-mono)",
                      fontSize: btn.label === "B" || btn.label === "I" ? "12px" : "10px",
                      fontWeight: btn.label === "B" ? 700 : 400,
                      fontStyle: btn.label === "I" ? "italic" : "normal",
                      cursor: "pointer",
                    }}
                  >
                    {btn.label}
                  </button>
                ))}
                <span style={{ fontSize: "10px", color: "var(--text-3)", fontFamily: "var(--font-mono)", alignSelf: "center", marginLeft: 4 }}>
                  Markdown supported
                </span>
              </div>

              {hasDraft && !composerValue.trim() ? (
                <div style={{ fontSize: "12px", color: "var(--text-3)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>Draft saved — continue where you left off?</span>
                  <button type="button" style={{ fontSize: "11px", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", color: "var(--inst-primary)" }}
                    onClick={() => { const saved = readDraft(); if (saved) setComposerValue(saved); }}>
                    Restore
                  </button>
                </div>
              ) : null}

              <textarea
                ref={composerRef}
                className={`${styles.composerInput} skeu-input`}
                value={composerValue}
                onChange={(event) => setComposerValue(event.target.value)}
                placeholder={
                  composerType === "question"
                    ? "Ask the campus something specific about this module..."
                    : composerType === "resource"
                      ? "Share the resource and explain why it helps..."
                      : campusLifeRoom
                        ? "Share a varsity life update, event, or student experience..."
                        : "Share an academic note, exam tip, or clarification..."
                }
                rows={5}
                disabled={!currentUserId || submitting}
              />

              {composerType === "poll" ? (
                <div style={{ display: "grid", gap: "6px", marginTop: "8px" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-3)" }}>Poll options (2–4):</span>
                  {pollOptions.map((opt, i) => (
                    <div key={i} style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <input
                        className="skeu-input"
                        style={{ flex: 1, padding: "6px 10px", fontSize: "13px" }}
                        placeholder={`Option ${i + 1}`}
                        value={opt}
                        onChange={(e) => setPollOptions((prev) => { const next = [...prev]; next[i] = e.target.value; return next; })}
                        disabled={!currentUserId || submitting}
                      />
                      {pollOptions.length > 2 ? (
                        <button type="button" style={{ color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", fontSize: "16px" }}
                          onClick={() => setPollOptions((prev) => prev.filter((_, j) => j !== i))}>×</button>
                      ) : null}
                    </div>
                  ))}
                  {pollOptions.length < 4 ? (
                    <button type="button" style={{ fontSize: "12px", color: "var(--inst-primary)", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                      onClick={() => setPollOptions((prev) => [...prev, ""])}>+ Add option</button>
                  ) : null}
                </div>
              ) : null}

              <div className={styles.composerActions}>
                <span className={styles.sidebarSubtle}>
                  {currentUserId
                    ? `${composerValue.trim().length}/4000 characters`
                    : "Sign in to create a post in this room."}
                </span>
                <label
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "12px", color: "var(--text-3)", userSelect: "none" }}
                  title="Your name will appear as 'Anonymous Student' to others. Scholar Credits still awarded."
                >
                  <input
                    type="checkbox"
                    checked={composerAnonymous}
                    onChange={(e) => setComposerAnonymous(e.target.checked)}
                    disabled={!currentUserId}
                    style={{ accentColor: "var(--inst-primary)" }}
                  />
                  Post anonymously
                </label>
                <button
                  type="button"
                  className="button skeu-btn"
                  onClick={() => void handleCreatePost()}
                  disabled={!currentUserId || submitting}
                >
                  {submitting ? "Posting..." : "Post to room"}
                </button>
              </div>
            </CardBody>
          </Card>

          <Card className={styles.pinnedWrap}>
            <CardHeader>
              <CardTitle>Pinned Post</CardTitle>
            </CardHeader>
            <CardBody>
              {room.pinnedPost ? (
                <PostCard post={room.pinnedPost} currentUserId={currentUserId} />
              ) : (
                <div className={styles.emptyFeed}>
                  <strong className={styles.emptyFeedTitle}>No pinned post yet</strong>
                  <p>
                    Once module discussions start, a lecturer note, resource share, or guide post can live here.
                  </p>
                </div>
              )}
            </CardBody>
          </Card>

          <Card className={styles.feedWrap}>
            <CardHeader>
              <CardTitle>Ask the Campus</CardTitle>
            </CardHeader>
            <CardBody>
              {newRoomPostsCount > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    const existingIds = new Set(posts.map((p) => p.id));
                    const genuinelyNew = incomingRoomPosts.filter((p) => !existingIds.has(p.id));
                    if (genuinelyNew.length > 0) {
                      newestRoomTimestamp.current = genuinelyNew[0]?.createdAt ?? newestRoomTimestamp.current;
                      setPosts((current) => [...genuinelyNew, ...current]);
                    }
                    setIncomingRoomPosts([]);
                    setNewRoomPostsCount(0);
                  }}
                  style={{ width: "100%", background: "var(--inst-primary)", color: "#0a0a0a", border: "none", borderRadius: "var(--r-md)", padding: "9px 14px", fontSize: "13px", fontWeight: 600, cursor: "pointer", marginBottom: "10px" }}
                >
                  ↑ {newRoomPostsCount} new {newRoomPostsCount === 1 ? "post" : "posts"} — tap to see
                </button>
              ) : null}

              <div className={styles.tabRow}>
                {([
                  ["all", "All Questions"],
                  ["unanswered", "Unanswered"],
                  ["my-modules", "My Modules"],
                  ["recent", "Recently Active"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`${styles.tabButton} ${filter === key ? styles.tabButtonActive : ""}`}
                    onClick={() => setFilter(key)}
                  >
                    <span>{key === "all" && campusLifeRoom ? "All Posts" : label}</span>
                    <span className={styles.tabCount}>{tabCounts[key]}</span>
                  </button>
                ))}
              </div>

              <div style={{ marginTop: "8px" }}>
                <input
                  ref={searchRef}
                  type="search"
                  placeholder="Search posts in this room… (press / to focus)"
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  className="skeu-input"
                  style={{ width: "100%", padding: "7px 12px", fontSize: "13px" }}
                />
              </div>

              {filteredPosts.length === 0 ? (
                <div className={styles.emptyFeed}>
                  <strong className={styles.emptyFeedTitle}>{`No posts in ${room.moduleCode} yet.`}</strong>
                  <p>
                    {campusLifeRoom
                      ? "Share the first campus update, student event, or varsity life moment in this page."
                      : "Ask a question or share a resource. This room is ready even before the first discussion arrives."}
                  </p>
                </div>
              ) : (
                <div className={styles.feed}>
                  {filteredPosts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      currentUserId={currentUserId}
                      onToggleReaction={(currentPost, reactionType) => handleToggleReaction(currentPost, reactionType)}
                      pendingReactionKey={pendingReactionKey}
                      acceptingCommentId={acceptingCommentId}
                      onAcceptAnswer={(comment) => handleAcceptAnswer(post, comment)}
                      onCreateComment={(currentPost, content) => handleCreateComment(currentPost, content)}
                      submittingCommentPostId={submittingCommentPostId}
                      onReshare={(currentPost) => handleReshare(currentPost)}
                      resharingPostId={resharingPostId}
                    />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </section>

        <aside className={styles.sidebar}>
          <Card className={styles.sidebarCard}>
            <CardHeader>
              <CardTitle>Room Snapshot</CardTitle>
            </CardHeader>
            <CardBody>
              <div className={styles.metricsGrid}>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Member count</span>
                  <strong className={styles.metricValue}>
                    {typeof room.memberCount === "number" ? room.memberCount : "--"}
                  </strong>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Shared resources</span>
                  <strong className={styles.metricValue}>
                    {typeof room.sharedResourceCount === "number" ? room.sharedResourceCount : "--"}
                  </strong>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Exam countdown</span>
                  <strong className={`${styles.metricValue} ${styles.metricValueAccent}`}>
                    {room.examCountdown ? formatExamCountdown(room.examCountdown.daysRemaining) : "--"}
                  </strong>
                  <span className={styles.sidebarSubtle}>
                    {room.examCountdown
                      ? `${room.examCountdown.subject} | ${room.examCountdown.date}`
                      : "No exam date linked to this room yet."}
                  </span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Questions answered</span>
                  <strong className={styles.metricValue}>
                    {room.answerRate !== null ? `${room.answerRate}%` : "--"}
                  </strong>
                  <span className={styles.sidebarSubtle}>
                    {room.answerRate !== null
                      ? room.answerRate >= 70
                        ? "This room is very active."
                        : room.answerRate >= 40
                          ? "Still open questions — answer one!"
                          : "This room needs helpers."
                      : "No questions yet."}
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className={styles.sidebarCard}>
            <CardHeader>
              <CardTitle>How This Room Works</CardTitle>
            </CardHeader>
            <CardBody>
              <div className={styles.resourceList}>
                <div className={styles.resourceItem}>
                  <strong>Questions stay open to everyone</strong>
                  <p className={styles.sidebarSubtle}>
                    No mastery gating. Anyone in the module can respond, react, and follow the thread.
                  </p>
                </div>
                <div className={styles.resourceItem}>
                  <strong>Accepted answers are visible</strong>
                  <p className={styles.sidebarSubtle}>
                    The question author can mark one reply as accepted. If wallet tables are live, the answerer earns Scholar Credits.
                  </p>
                </div>
                <div className={styles.resourceItem}>
                  <strong>Keep it academic</strong>
                  <p className={styles.sidebarSubtle}>
                    Report spam, misinformation, harassment, and off-topic posts. The moderation model stays lightweight in this phase.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          {relatedQuestions.length > 0 ? (
            <Card className={styles.sidebarCard}>
              <CardHeader>
                <CardTitle>Related in {room.moduleCode}</CardTitle>
              </CardHeader>
              <CardBody>
                <div className={styles.resourceList}>
                  {relatedQuestions.map((q) => (
                    <div key={q.id} className={styles.resourceItem}>
                      <p style={{ fontSize: "13px", color: "var(--text-2)", margin: "0 0 4px", lineHeight: 1.4 }}>
                        {q.content}{q.content.length >= 120 ? "…" : ""}
                      </p>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-3)" }}>
                        {q.sameQuestionCount > 0 ? `${q.sameQuestionCount} students · ` : ""}
                        {q.commentCount} {q.commentCount === 1 ? "reply" : "replies"}
                        {q.acceptedAnswerId ? " · ✓ Resolved" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          ) : null}
        </aside>
      </div>

      {showShortcuts ? (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowShortcuts(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
        >
          <div
            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "24px 28px", minWidth: "280px", maxWidth: "380px", width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 16px", fontSize: "14px", fontWeight: 700, color: "var(--text-1)" }}>Keyboard shortcuts</h3>
            <div style={{ display: "grid", gap: "10px" }}>
              {[
                ["n", "Focus post composer"],
                ["/", "Focus search"],
                ["?", "Show / hide shortcuts"],
                ["Esc", "Close search / overlay"],
              ].map(([key, label]) => (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "13px", color: "var(--text-2)" }}>{label}</span>
                  <kbd style={{ fontFamily: "var(--font-mono)", fontSize: "11px", padding: "2px 7px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--surface-2)", color: "var(--text-1)" }}>{key}</kbd>
                </div>
              ))}
            </div>
            <button
              type="button"
              style={{ marginTop: "20px", width: "100%", padding: "8px", borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-2)", cursor: "pointer", fontSize: "12px" }}
              onClick={() => setShowShortcuts(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
