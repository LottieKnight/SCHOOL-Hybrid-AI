"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import { useSession } from "@/components/SessionProvider";

type Author = { username: string | null; avatar?: unknown };
type Post = {
  id: string;
  content: string;
  post_type: string;
  created_at: string;
  author: Author;
  comment_count: number;
  reaction_count: number;
  viewer_reacted: boolean;
};
type Comment = { id: string; content: string; created_at: string; author: Author };

function timeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function handleOf(a: Author): string {
  return a.username ? `@${a.username}` : "@member";
}
function initial(a: Author): string {
  return (a.username?.[0] ?? "m").toUpperCase();
}
function AuthorLink({ author }: { author: Author }) {
  const label = handleOf(author);
  if (author.username) {
    return (
      <Link href={`/profile/${author.username}`} style={{ color: "inherit", textDecoration: "none" }}>
        {label}
      </Link>
    );
  }
  return <strong>{label}</strong>;
}

export function CampusFeed() {
  const { session } = useSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [canPost, setCanPost] = useState(false);
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState<Record<string, Comment[] | null>>({});
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});

  const headers = useCallback(
    (json = true): HeadersInit => ({
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(session ? { "x-csrf-token": session.csrfToken } : {}),
    }),
    [session]
  );

  useEffect(() => {
    if (!session) return;
    let active = true;
    Promise.all([
      fetch(`${API_BASE}/community/me`, { credentials: "include" }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API_BASE}/community/feed?limit=20`, { credentials: "include" }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([me, feed]) => {
        if (!active) return;
        setCanPost(Boolean(me?.canPost));
        setPosts(Array.isArray(feed?.posts) ? feed.posts : []);
      })
      .catch(() => active && setError("Could not load the feed."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [session]);

  const submitPost = async () => {
    const body = content.trim();
    if (!body || posting) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/community/posts`, {
        method: "POST",
        credentials: "include",
        headers: headers(),
        body: JSON.stringify({ content: body, postType: "general" }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 403) {
        setError("Claim a public handle to post — look for the prompt, or set one in Settings.");
        return;
      }
      if (!res.ok || !data?.post) throw new Error(data?.error || "Could not post.");
      setPosts((prev) => [data.post as Post, ...prev]);
      setContent("");
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not post."));
    } finally {
      setPosting(false);
    }
  };

  const react = async (post: Post) => {
    // optimistic
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, viewer_reacted: !p.viewer_reacted, reaction_count: p.reaction_count + (p.viewer_reacted ? -1 : 1) }
          : p
      )
    );
    try {
      const res = await fetch(`${API_BASE}/community/posts/${post.id}/reactions`, {
        method: "POST",
        credentials: "include",
        headers: headers(),
        body: JSON.stringify({ reactionType: "got_it" }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setPosts((prev) =>
          prev.map((p) => (p.id === post.id ? { ...p, viewer_reacted: data.reacted, reaction_count: data.count } : p))
        );
      } else if (res.status === 403) {
        setError("Claim a public handle to react.");
      }
    } catch {
      /* leave optimistic state */
    }
  };

  const toggleComments = async (post: Post) => {
    if (openComments[post.id] !== undefined) {
      setOpenComments((prev) => {
        const next = { ...prev };
        delete next[post.id];
        return next;
      });
      return;
    }
    setOpenComments((prev) => ({ ...prev, [post.id]: null }));
    try {
      const res = await fetch(`${API_BASE}/community/posts/${post.id}`, { credentials: "include" });
      const data = await res.json().catch(() => null);
      setOpenComments((prev) => ({ ...prev, [post.id]: Array.isArray(data?.comments) ? data.comments : [] }));
    } catch {
      setOpenComments((prev) => ({ ...prev, [post.id]: [] }));
    }
  };

  const submitComment = async (post: Post) => {
    const body = (commentDraft[post.id] ?? "").trim();
    if (!body) return;
    try {
      const res = await fetch(`${API_BASE}/community/posts/${post.id}/comments`, {
        method: "POST",
        credentials: "include",
        headers: headers(),
        body: JSON.stringify({ content: body }),
      });
      if (res.status === 403) {
        setError("Claim a public handle to reply.");
        return;
      }
      if (!res.ok) return;
      setCommentDraft((prev) => ({ ...prev, [post.id]: "" }));
      // reload that post's comments + bump count
      const detail = await fetch(`${API_BASE}/community/posts/${post.id}`, { credentials: "include" }).then((r) =>
        r.ok ? r.json() : null
      );
      setOpenComments((prev) => ({ ...prev, [post.id]: Array.isArray(detail?.comments) ? detail.comments : [] }));
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, comment_count: p.comment_count + 1 } : p)));
    } catch {
      /* ignore */
    }
  };

  const avatarStyle: React.CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "var(--brand-primary, #e8c15a)",
    color: "#0a0a0a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 600,
    flexShrink: 0,
  };

  return (
    <div className="skeu-card" style={{ padding: 18, borderRadius: 14 }}>
      <h3 style={{ margin: "0 0 4px" }}>Campus Feed</h3>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--text-2)" }}>
        Post to the whole campus. You appear only as your public handle — your email and contact details stay private.
      </p>

      {!canPost && (
        <div style={{ background: "var(--surface-2, #161616)", border: "1px solid var(--border, #333)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "var(--text-2)", marginBottom: 12 }}>
          Claim a public handle to post and reply. Look for the prompt, or set one in <a href="/settings" style={{ color: "var(--brand-primary,#e8c15a)" }}>Settings</a>.
        </div>
      )}

      {canPost && (
        <div style={{ marginBottom: 16 }}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share something with the campus…"
            rows={3}
            maxLength={5000}
            style={{ width: "100%", borderRadius: 10, padding: 12, resize: "vertical", fontFamily: "inherit", fontSize: 14 }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button className="button skeu-btn" onClick={submitPost} disabled={posting || !content.trim()}>
              {posting ? "Posting…" : "Post to campus"}
            </button>
          </div>
        </div>
      )}

      {error && <p style={{ color: "#e07a5f", fontSize: 13, margin: "0 0 12px" }}>{error}</p>}

      {loading ? (
        <p style={{ fontSize: 13, color: "var(--text-3)" }}>Loading the feed…</p>
      ) : posts.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-3)" }}>No posts yet — be the first to start the conversation.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {posts.map((post) => {
            const comments = openComments[post.id];
            return (
              <article key={post.id} style={{ border: "1px solid var(--border, #2a2a3a)", borderRadius: 12, padding: 14 }}>
                <header style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={avatarStyle} aria-hidden="true">{initial(post.author)}</span>
                  <div>
                    <strong style={{ fontSize: 14 }}><AuthorLink author={post.author} /></strong>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>{timeAgo(post.created_at)}</div>
                  </div>
                </header>
                <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{post.content}</p>
                <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                  <button
                    type="button"
                    onClick={() => react(post)}
                    style={{ background: "none", border: 0, cursor: "pointer", color: post.viewer_reacted ? "var(--brand-primary,#e8c15a)" : "var(--text-2)", fontWeight: post.viewer_reacted ? 600 : 400 }}
                  >
                    ▲ Got it · {post.reaction_count}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleComments(post)}
                    style={{ background: "none", border: 0, cursor: "pointer", color: "var(--text-2)" }}
                  >
                    💬 {post.comment_count} {post.comment_count === 1 ? "reply" : "replies"}
                  </button>
                </div>

                {comments !== undefined && (
                  <div style={{ marginTop: 12, borderTop: "1px solid var(--border,#2a2a3a)", paddingTop: 12 }}>
                    {comments === null ? (
                      <p style={{ fontSize: 12, color: "var(--text-3)" }}>Loading replies…</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {comments.map((c) => (
                          <div key={c.id} style={{ display: "flex", gap: 8 }}>
                            <span style={{ ...avatarStyle, width: 28, height: 28, fontSize: 12 }} aria-hidden="true">{initial(c.author)}</span>
                            <div>
                              <div style={{ fontSize: 12 }}>
                                <strong><AuthorLink author={c.author} /></strong>{" "}
                                <span style={{ color: "var(--text-3)" }}>· {timeAgo(c.created_at)}</span>
                              </div>
                              <p style={{ margin: "2px 0 0", fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.content}</p>
                            </div>
                          </div>
                        ))}
                        {canPost && (
                          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                            <input
                              type="text"
                              value={commentDraft[post.id] ?? ""}
                              onChange={(e) => setCommentDraft((prev) => ({ ...prev, [post.id]: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === "Enter") void submitComment(post); }}
                              placeholder="Write a reply…"
                              maxLength={2000}
                              style={{ flex: 1, borderRadius: 8, padding: "6px 10px", fontSize: 13 }}
                            />
                            <button className="button" onClick={() => void submitComment(post)} disabled={!(commentDraft[post.id] ?? "").trim()}>
                              Reply
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
