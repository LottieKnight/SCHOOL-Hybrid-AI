"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import Link from "next/link";
import PostCard from "@/components/community/PostCard";
import { Badge } from "@/components/ui/Badge";
import { buttonClassName } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import type {
  CommunityComment,
  CommunityPost,
  CommunityQuestionFilter,
  CommunityReactionType,
  CommunityRoomListItem,
} from "@/lib/communityShared";
import styles from "@/app/community/questions/page.module.css";

function sortRecentlyActive(posts: CommunityPost[]) {
  return [...posts].sort(
    (left, right) =>
      new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime()
  );
}

function forYouScore(post: CommunityPost, selected: Set<string>): number {
  const isTracked = selected.has(post.moduleCode.trim().toUpperCase());
  const totalReactions = Object.values(post.reactionCounts).reduce((a, b) => a + b, 0);
  const ageHours = (Date.now() - new Date(post.createdAt).getTime()) / 3_600_000;
  return (isTracked ? 500 : 0)
    + post.sameQuestionCount * 10
    + post.commentCount * 3
    + totalReactions * 2
    - (post.acceptedAnswerId ? 80 : 0)
    - Math.min(ageHours * 4, 200);
}

function filterQuestionPosts(
  posts: CommunityPost[],
  filter: CommunityQuestionFilter,
  selectedModules: string[]
) {
  const selected = new Set(selectedModules.map((value) => value.trim().toUpperCase()).filter(Boolean));

  switch (filter) {
    case "unanswered":
      return posts.filter((post) => !post.acceptedAnswerId);
    case "my-modules":
      if (selected.size === 0) return [];
      return posts.filter((post) => selected.has(post.moduleCode.trim().toUpperCase()));
    case "recent":
      return sortRecentlyActive(posts);
    case "for-you":
      return [...posts].sort((a, b) => forYouScore(b, selected) - forYouScore(a, selected));
    case "all":
    default:
      return posts;
  }
}

type CommunityQuestionsClientProps = {
  posts: CommunityPost[];
  currentUserId: string | null;
  selectedModules: string[];
  featuredRooms: CommunityRoomListItem[];
};

export default function CommunityQuestionsClient({
  posts: initialPosts,
  currentUserId,
  selectedModules,
  featuredRooms,
}: CommunityQuestionsClientProps) {
  const [filter, setFilter] = useState<CommunityQuestionFilter>("all");
  const { isIdle } = useSession();
  const [posts, setPosts] = useState(initialPosts);
  const [error, setError] = useState<string | null>(null);
  const [acceptingCommentId, setAcceptingCommentId] = useState<string | null>(null);
  const [submittingCommentPostId, setSubmittingCommentPostId] = useState<string | null>(null);
  const [pendingReactionKey, setPendingReactionKey] = useState<string | null>(null);
  const [resharingPostId, setResharingPostId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialPosts.length >= 20);
  const [newPostsCount, setNewPostsCount] = useState(0);
  const [incomingPosts, setIncomingPosts] = useState<CommunityPost[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const newestTimestamp = useRef<string | null>(
    initialPosts.length > 0 ? initialPosts[0]?.createdAt ?? null : null
  );
  const questionsSearchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "/") {
        event.preventDefault();
        questionsSearchRef.current?.focus();
      } else if (event.key === "Escape") {
        setSearchQuery("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setHasMore(posts.length >= 20);
  }, [filter, posts.length]);

  // Poll for new posts every 45 seconds — pauses when idle
  useEffect(() => {
    if (isIdle) return;
    const interval = setInterval(async () => {
      const since = newestTimestamp.current;
      if (!since) return;
      try {
        const url = `/api/community/questions?since=${encodeURIComponent(since)}&limit=20`;
        const res = await fetch(url, { credentials: "include", cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { posts?: CommunityPost[] };
        const fresh = data.posts ?? [];
        if (fresh.length > 0) {
          setIncomingPosts(fresh);
          setNewPostsCount(fresh.length);
        }
      } catch { /* network failure — silent */ }
    }, 45_000);
    return () => clearInterval(interval);
  }, [isIdle]);

  const filteredPosts = useMemo(() => {
    const base = filterQuestionPosts(posts, filter, selectedModules);
    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase();
    return base.filter(
      (p) => p.content.toLowerCase().includes(q) || p.moduleCode.toLowerCase().includes(q)
    );
  }, [filter, posts, selectedModules, searchQuery]);

  const tabCounts = useMemo(
    () => ({
      all: posts.length,
      unanswered: posts.filter((post) => !post.acceptedAnswerId).length,
      "my-modules":
        selectedModules.length === 0
          ? 0
          : posts.filter((post) =>
              selectedModules.map((value) => value.toUpperCase()).includes(post.moduleCode.toUpperCase())
            ).length,
      recent: posts.length,
      "for-you": posts.length,
    }),
    [posts, selectedModules]
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

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to accept this answer.");
      }

      setPosts((current) =>
        current.map((entry) =>
          entry.id !== post.id
            ? entry
            : {
                ...entry,
                acceptedAnswerId: comment.id,
                comments: entry.comments.map((currentComment) => ({
                  ...currentComment,
                  isAccepted: currentComment.id === comment.id,
                })),
              }
        )
      );
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "Unable to accept this answer.");
    } finally {
      setAcceptingCommentId(null);
    }
  };

  const handleCreateComment = async (post: CommunityPost, content: string) => {
    if (!currentUserId) {
      setError("Sign in to reply to questions.");
      return;
    }

    const trimmed = content.trim();
    if (!trimmed) return;

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
      setError("Sign in to react to questions.");
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
          if (entry.id !== post.id) return entry;

          const nextCount = Math.max(
            0,
            (entry.reactionCounts[reactionType] ?? 0) + (payload.active ? 1 : -1)
          );
          return {
            ...entry,
            reactionCounts: {
              ...entry.reactionCounts,
              [reactionType]: nextCount,
            },
            activeReactions: payload.active
              ? Array.from(new Set([...entry.activeReactions, reactionType]))
              : entry.activeReactions.filter((value) => value !== reactionType),
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
      setError("Sign in to reshare questions.");
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
          moduleName: featuredRooms.find((room) => room.moduleCode === post.moduleCode)?.moduleName ?? post.moduleCode,
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

  const handleLoadMore = async () => {
    setLoadingMore(true);
    setError(null);
    try {
      const oldest = [...posts].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )[0];
      const cursor = oldest?.createdAt ?? null;
      const url = `/api/community/questions?filter=${filter}&limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      const data = (await res.json()) as { posts?: CommunityPost[] };
      const newPosts = data.posts ?? [];
      if (newPosts.length === 0) {
        setHasMore(false);
      } else {
        const existingIds = new Set(posts.map((p) => p.id));
        setPosts((current) => [...current, ...newPosts.filter((p) => !existingIds.has(p.id))]);
        setHasMore(newPosts.length >= 20);
      }
    } catch {
      setError("Unable to load more questions right now.");
    } finally {
      setLoadingMore(false);
    }
  };

  function applyIncomingPosts() {
    if (incomingPosts.length === 0) return;
    const existingIds = new Set(posts.map((p) => p.id));
    const genuinelyNew = incomingPosts.filter((p) => !existingIds.has(p.id));
    if (genuinelyNew.length > 0) {
      newestTimestamp.current = genuinelyNew[0]?.createdAt ?? newestTimestamp.current;
      setPosts((current) => [...genuinelyNew, ...current]);
    }
    setIncomingPosts([]);
    setNewPostsCount(0);
  }

  return (
    <div className={styles.layout}>
      <section className={styles.mainColumn}>
        {newPostsCount > 0 ? (
          <button
            type="button"
            onClick={applyIncomingPosts}
            style={{
              width: "100%",
              background: "var(--inst-primary)",
              color: "#0a0a0a",
              border: "none",
              borderRadius: "var(--r-md)",
              padding: "10px 16px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginBottom: "4px",
            }}
          >
            ↑ {newPostsCount} new {newPostsCount === 1 ? "post" : "posts"} — tap to see
          </button>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Question Filters</CardTitle>
          </CardHeader>
          <CardBody>
            <div className={styles.tabRow}>
              {([
                ["for-you", "For You"],
                ["all", "All Questions"],
                ["unanswered", "Unanswered"],
                ["my-modules", "My Modules"],
                ["recent", "Recently Active"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.tabButton} ${filter === value ? styles.tabButtonActive : ""}`}
                  onClick={() => setFilter(value)}
                >
                  <span>{label}</span>
                  <span className={styles.tabCount}>{tabCounts[value]}</span>
                </button>
              ))}
            </div>
            <div style={{ marginTop: "10px" }}>
              <input
                ref={questionsSearchRef}
                type="search"
                placeholder="Search questions… (press / to focus)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="skeu-input"
                style={{ width: "100%", padding: "7px 12px", fontSize: "13px" }}
              />
            </div>
          </CardBody>
        </Card>

        {error ? <div className="assistant-error">{error}</div> : null}

        <Card>
          <CardHeader>
            <CardTitle>Ask the Campus</CardTitle>
          </CardHeader>
          <CardBody>
            {filteredPosts.length === 0 ? (
              <div className={styles.emptyState}>
                <strong className={styles.emptyTitle}>
                  {filter === "my-modules" && selectedModules.length === 0
                    ? "No tracked modules yet"
                    : "No questions match this filter"}
                </strong>
                <p className={styles.emptyCopy}>
                  {filter === "my-modules" && selectedModules.length === 0
                    ? "Complete onboarding or update your subjects so SCHOOL can surface module-specific questions here."
                    : "Open a module room and ask the first question, or switch filters to broaden the feed."}
                </p>
              </div>
            ) : (
              <div className={styles.feed}>
                {filteredPosts.map((post) => (
                  <div key={post.id} className={styles.postWrap}>
                    <div className={styles.postMetaRow}>
                      <Badge variant="neutral" className="skeu-badge">{post.moduleCode}</Badge>
                      <Link
                        className={buttonClassName({ variant: "ghost", size: "sm", className: "skeu-btn-ghost" })}
                        href={`/community/rooms/${encodeURIComponent(post.moduleCode)}`}
                      >
                        Open room
                      </Link>
                    </div>
                    <PostCard
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
                  </div>
                ))}
                {hasMore ? (
                  <div style={{ textAlign: "center", paddingTop: "8px" }}>
                    <button
                      type="button"
                      className={buttonClassName({ variant: "outline", size: "sm", className: "skeu-btn-ghost" })}
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                    >
                      {loadingMore ? "Loading…" : "Load more questions"}
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </CardBody>
        </Card>
      </section>

      <aside className={styles.sideColumn}>
        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
          </CardHeader>
          <CardBody>
            <div className={styles.quickLinks}>
              <Link className={buttonClassName({ variant: "outline", size: "sm", className: "skeu-btn-ghost" })} href="/community">
                Community hub
              </Link>
              <Link className={buttonClassName({ variant: "outline", size: "sm", className: "skeu-btn-ghost" })} href="/community/saved">
                Saved posts
              </Link>
              <Link className={buttonClassName({ variant: "outline", size: "sm", className: "skeu-btn-ghost" })} href="/tutor">
                Launch AI Assistant
              </Link>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your Module Rooms</CardTitle>
          </CardHeader>
          <CardBody>
            {featuredRooms.length === 0 ? (
              <div className={styles.emptyStateCompact}>No module rooms available yet.</div>
            ) : (
              <div className={styles.roomList}>
                {featuredRooms.map((room) => (
                  <Link
                    key={room.moduleCode}
                    className={styles.roomLink}
                    href={`/community/rooms/${encodeURIComponent(room.moduleCode)}`}
                  >
                    <strong>{room.moduleCode}</strong>
                    <span>{room.moduleName}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </aside>
    </div>
  );
}
