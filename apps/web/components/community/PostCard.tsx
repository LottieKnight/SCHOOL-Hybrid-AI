"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import {
  labelCommunityReaction,
  type CommunityComment,
  type CommunityPost,
  type CommunityReactionType,
} from "@/lib/communityShared";
import { relativeTime } from "@/lib/relativeTime";
import styles from "@/components/community/PostCard.module.css";

function initialsFromName(value: string) {
  return value
    .split(/\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment.charAt(0).toUpperCase())
    .join("");
}

function reactionOrder(): CommunityReactionType[] {
  return ["got_it", "same_question", "great_explanation", "saving_this", "exam_relevant", "kudos"];
}

type PostCardProps = {
  post: CommunityPost;
  loading?: boolean;
  currentUserId?: string | null;
  onToggleReaction?: (post: CommunityPost, reactionType: CommunityReactionType) => Promise<void> | void;
  pendingReactionKey?: string | null;
  onAcceptAnswer?: (comment: CommunityComment) => Promise<void> | void;
  acceptingCommentId?: string | null;
  onCreateComment?: (post: CommunityPost, content: string) => Promise<void> | void;
  submittingCommentPostId?: string | null;
  onReshare?: (post: CommunityPost) => Promise<void> | void;
  resharingPostId?: string | null;
};

export default function PostCard({
  post,
  loading = false,
  currentUserId = null,
  onToggleReaction,
  pendingReactionKey = null,
  onAcceptAnswer,
  acceptingCommentId = null,
  onCreateComment,
  submittingCommentPostId = null,
  onReshare,
  resharingPostId = null,
}: PostCardProps) {
  const [expanded, setExpanded] = useState(post.postType === "question");
  const [showAllContent, setShowAllContent] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [burstReaction, setBurstReaction] = useState<string | null>(null);
  const [pollVoteCounts, setPollVoteCounts] = useState<number[] | null>(post.pollVoteCounts ?? null);
  const [pollUserVote, setPollUserVote] = useState<number | null>(post.pollUserVote ?? null);
  const [pollTotalVotes, setPollTotalVotes] = useState<number>(post.pollTotalVotes ?? 0);
  const [pollVoting, setPollVoting] = useState(false);
  const [commentLikes, setCommentLikes] = useState<Record<string, { count: number; liked: boolean }>>(() =>
    Object.fromEntries(post.comments.map((c) => [c.id, { count: c.likeCount, liked: c.userHasLiked }]))
  );
  const [showReport, setShowReport] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const commentTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const insertCommentMarkdown = useCallback((syntax: { wrap?: [string, string]; prefix?: string }) => {
    const el = commentTextareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    setCommentDraft((value) => {
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

  const handleCommentLike = useCallback(async (commentId: string) => {
    if (!currentUserId) return;
    setCommentLikes((prev) => {
      const cur = prev[commentId] ?? { count: 0, liked: false };
      return { ...prev, [commentId]: { count: cur.liked ? cur.count - 1 : cur.count + 1, liked: !cur.liked } };
    });
    try {
      const res = await fetch("/api/community/comment-likes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });
      const data = (await res.json().catch(() => ({}))) as { liked?: boolean; likeCount?: number };
      if (res.ok && data.likeCount != null) {
        setCommentLikes((prev) => ({ ...prev, [commentId]: { count: data.likeCount!, liked: data.liked ?? false } }));
      }
    } catch { /* leave optimistic state */ }
  }, [currentUserId]);

  const handleReport = useCallback(async (reason: string) => {
    if (!currentUserId || reportSubmitting) return;
    setReportSubmitting(true);
    try {
      await fetch("/api/community/report", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id, reason }),
      });
      setReportSubmitted(true);
      setShowReport(false);
    } catch { /* ignore */ } finally {
      setReportSubmitting(false);
    }
  }, [currentUserId, post.id, reportSubmitting]);

  const handlePollVote = useCallback(async (optionIndex: number) => {
    if (!currentUserId || pollVoting) return;
    setPollVoting(true);
    try {
      const res = await fetch("/api/community/polls", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id, optionIndex }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        results?: { voteCounts?: number[]; userVote?: number | null; totalVotes?: number };
      };
      if (res.ok && data.results) {
        setPollVoteCounts(data.results.voteCounts ?? null);
        setPollUserVote(data.results.userVote ?? null);
        setPollTotalVotes(data.results.totalVotes ?? 0);
      }
    } catch { /* ignore */ } finally {
      setPollVoting(false);
    }
  }, [currentUserId, pollVoting, post.id]);

  function handleReaction(reactionType: CommunityReactionType) {
    setBurstReaction(reactionType);
    setTimeout(() => setBurstReaction(null), 400);
    onToggleReaction?.(post, reactionType);
  }

  const reactionTypes = useMemo(() => reactionOrder(), []);

  const pollQuestion = post.postType === "poll" ? (() => {
    try { return (JSON.parse(post.content) as { question?: string }).question ?? post.content; } catch { return post.content; }
  })() : null;

  const displayContent = post.postType === "poll" ? (pollQuestion ?? post.content) : post.content;
  const isLongContent = displayContent.length > 500;
  const visibleContent =
    isLongContent && !showAllContent ? `${displayContent.slice(0, 500).trimEnd()}...` : displayContent;
  const canAuthorAccept = Boolean(currentUserId && currentUserId === post.userId && post.postType === "question");
  const canReply = Boolean(currentUserId);

  if (loading) {
    return <article className={`${styles.card} ${styles.skeleton}`} aria-hidden="true" />;
  }

  return (
    <article className={`${styles.card} skeu-card`}>
      <header className={styles.header}>
        <div className={styles.meta}>
          <span className={styles.avatar}>{initialsFromName(post.authorName || "SCHOOL")}</span>
          <div className={styles.metaCopy}>
            <div className={styles.metaTitle}>
              {post.authorUsername ? (
                <Link href={`/profile/${post.authorUsername}`} className={styles.name} style={{ color: "inherit", textDecoration: "none" }}>
                  <strong className={styles.name}>{post.authorName}</strong>
                </Link>
              ) : (
                <strong className={styles.name}>{post.authorName}</strong>
              )}
              {post.topContributorRank === 1 ? <span title="Most Helpful This Month">🥇</span>
               : post.topContributorRank === 2 ? <span title="2nd Most Helpful This Month">🥈</span>
               : post.topContributorRank === 3 ? <span title="3rd Most Helpful This Month">🥉</span>
               : null}
              <span className={styles.role}>{post.authorRole}</span>
            </div>
            <div className={styles.metaTags}>
              <span
                className={`${styles.tag} ${
                  post.postType === "question"
                    ? styles.postTypeQuestion
                    : post.postType === "resource"
                      ? styles.postTypeResource
                      : post.postType === "announcement"
                        ? styles.postTypeAnnouncement
                        : ""
                }`}
              >
                {post.postType}
              </span>
              <span className={styles.tag}>{post.moduleCode}</span>
              <span className={styles.tag}>{post.audience}</span>
              {post.isPlaceholder ? <span className={styles.tag}>guide</span> : null}
              {post.isAnonymous ? (
                <span className={styles.anonBadge}>anonymous</span>
              ) : null}
              {post.acceptedAnswerId ? (
                <span className={styles.resolvedBadge}>✓ Resolved</span>
              ) : null}
            </div>
          </div>
        </div>
        <span className={styles.timestamp}>{relativeTime(post.updatedAt || post.createdAt)}</span>
      </header>

      <div className={styles.body}>
        {post.sameQuestionCount > 0 ? (
          <div className={styles.sameQuestion}>
            <span className={styles.sameQuestionCount}>{post.sameQuestionCount}</span>
            {" students have this question"}
          </div>
        ) : null}

        {post.contentHtml ? (
          <div
            className={styles.contentRich}
            dangerouslySetInnerHTML={{ __html: post.contentHtml }}
          />
        ) : (
          <p className={styles.content}>{visibleContent}</p>
        )}

        {isLongContent && !post.contentHtml ? (
          <button className={styles.expandButton} type="button" onClick={() => setShowAllContent((current) => !current)}>
            {showAllContent ? "Show less" : "Read more"}
          </button>
        ) : null}

        {post.postType === "question" && !post.acceptedAnswerId ? (
          <div className={styles.askAiRow}>
            <Link
              className={styles.askAiLink}
              href={`/tutor?q=${encodeURIComponent(displayContent.slice(0, 300))}`}
            >
              ✦ Ask AI about this
            </Link>
          </div>
        ) : null}

        {post.postType === "poll" && Array.isArray(post.pollOptions) && post.pollOptions.length > 0 ? (
          <div style={{ display: "grid", gap: "6px", marginTop: "10px" }}>
            {post.pollOptions.map((option, i) => {
              const votes = pollVoteCounts?.[i] ?? 0;
              const pct = pollTotalVotes > 0 ? Math.round((votes / pollTotalVotes) * 100) : 0;
              const isVoted = pollUserVote === i;
              const hasVoted = pollUserVote != null;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!currentUserId || pollVoting || hasVoted}
                  onClick={() => void handlePollVote(i)}
                  style={{
                    position: "relative",
                    background: hasVoted ? (isVoted ? "color-mix(in srgb, var(--inst-primary, #e8c15a) 15%, transparent)" : "var(--bg-2)") : "var(--bg-2)",
                    border: isVoted ? "1px solid var(--inst-primary, #e8c15a)" : "1px solid var(--border)",
                    borderRadius: "var(--r-sm, 6px)",
                    padding: "8px 12px",
                    textAlign: "left",
                    cursor: hasVoted ? "default" : "pointer",
                    overflow: "hidden",
                    fontSize: "13px",
                    color: "var(--text-1)",
                  }}
                >
                  {hasVoted ? (
                    <span style={{ position: "absolute", inset: 0, background: "var(--inst-primary, #e8c15a)", opacity: 0.08, width: `${pct}%`, transition: "width 0.4s" }} />
                  ) : null}
                  <span style={{ position: "relative", display: "flex", justifyContent: "space-between", gap: "8px" }}>
                    <span>{option}</span>
                    {hasVoted ? <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-3)" }}>{pct}%</span> : null}
                  </span>
                </button>
              );
            })}
            <span style={{ fontSize: "11px", color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
              {pollTotalVotes} {pollTotalVotes === 1 ? "vote" : "votes"}
              {!currentUserId ? " — sign in to vote" : pollUserVote == null ? " — tap to vote" : ""}
            </span>
          </div>
        ) : null}

        {post.imageUrls.length > 0 ? (
          <div className={styles.imageGrid}>
            {post.imageUrls.map((url) => (
              <div key={url} className={styles.imageTile}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" />
              </div>
            ))}
          </div>
        ) : null}

        {post.attachmentUrl ? (
          <a className={styles.attachment} href={post.attachmentUrl} target="_blank" rel="noreferrer">
            Attachment
          </a>
        ) : null}
      </div>

      <footer className={styles.footer}>
        <div className={styles.reactionRow}>
          {reactionTypes.map((reactionType) => (
            <button
              key={reactionType}
              type="button"
              className={`${styles.reactionChip} ${
                post.activeReactions.includes(reactionType) ? styles.reactionChipActive : ""
              } ${burstReaction === reactionType ? styles.reactionBurst : ""}`}
              onClick={() => handleReaction(reactionType)}
              disabled={!currentUserId || pendingReactionKey === `${post.id}:${reactionType}`}
            >
              {labelCommunityReaction(reactionType)}
              <strong className={styles.reactionCount}>{post.reactionCounts[reactionType] ?? 0}</strong>
            </button>
          ))}
        </div>

        <div className={styles.actions}>
          <button className={styles.actionButton} type="button" onClick={() => setExpanded((current) => !current)}>
            {expanded ? "Hide comments" : `${post.commentCount} comments`}
          </button>
          <button
            className={styles.actionButton}
            type="button"
            onClick={() => onReshare?.(post)}
            disabled={!currentUserId || resharingPostId === post.id}
          >
            {resharingPostId === post.id ? "Resharing..." : "Reshare"}
          </button>
          <a
            className={styles.actionButton}
            href={`https://wa.me/?text=${encodeURIComponent(`Check this question on SCHOOL: ${displayContent.slice(0, 80)}${displayContent.length > 80 ? "..." : ""}`)}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            Share
          </a>
          {showReport ? (
            <span className={styles.reportInline}>
              {["Spam", "Misinformation", "Inappropriate", "Plagiarism"].map((reason) => (
                <button
                  key={reason}
                  className={styles.reportReasonBtn}
                  type="button"
                  disabled={reportSubmitting}
                  onClick={() => void handleReport(reason)}
                >
                  {reason}
                </button>
              ))}
              <button className={styles.actionButton} type="button" onClick={() => setShowReport(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button
              className={styles.actionButton}
              type="button"
              onClick={() => !reportSubmitted && setShowReport(true)}
              disabled={reportSubmitted}
            >
              {reportSubmitted ? "Reported" : "Report"}
            </button>
          )}
        </div>
      </footer>

      {expanded ? (
        <section className={styles.commentsWrap}>
          <div className={styles.commentComposer}>
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "4px" }}>
              {[
                { label: "B", title: "Bold", wrap: ["**", "**"] as [string, string] },
                { label: "`", title: "Inline code", wrap: ["`", "`"] as [string, string] },
                { label: "```", title: "Code block", wrap: ["```\n", "\n```"] as [string, string] },
                { label: "—", title: "Bullet", prefix: "- " },
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  title={btn.title}
                  disabled={!canReply}
                  onClick={() => insertCommentMarkdown("wrap" in btn ? { wrap: btn.wrap } : { prefix: btn.prefix })}
                  style={{
                    minWidth: btn.label === "```" ? 36 : 26,
                    height: 26,
                    padding: "0 5px",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-sm, 4px)",
                    background: "var(--surface-2)",
                    color: "var(--text-2)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    fontWeight: btn.label === "B" ? 700 : 400,
                    cursor: "pointer",
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
            <textarea
              ref={commentTextareaRef}
              className={`${styles.commentComposerInput} skeu-input`}
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              placeholder={
                canReply
                  ? post.postType === "question"
                    ? "Write an answer or clarification..."
                    : "Add a reply to this post..."
                  : "Sign in to reply in this room."
              }
              rows={3}
              disabled={!canReply || submittingCommentPostId === post.id}
            />
            <div className={styles.commentComposerActions}>
              <span className={styles.role}>
                {canReply ? `${commentDraft.trim().length}/4000 characters` : "Replies require a signed-in student session."}
              </span>
              <Button
                variant="gold"
                size="sm"
                className="skeu-btn"
                onClick={async () => {
                  const content = commentDraft.trim();
                  if (!content) return;
                  await onCreateComment?.(post, content);
                  setCommentDraft("");
                }}
                disabled={!canReply || !commentDraft.trim() || submittingCommentPostId === post.id}
              >
                {submittingCommentPostId === post.id ? "Posting..." : "Reply"}
              </Button>
            </div>
          </div>

          {post.comments.length === 0 ? (
            <div className={styles.emptyComments}>
              No replies yet. Ask the campus or be the first to answer this question.
            </div>
          ) : (
            <div className={styles.commentList}>
              {post.comments.map((comment) => (
                <article
                  key={comment.id}
                  className={`${styles.commentCard} ${comment.isAccepted ? styles.accepted : ""}`}
                >
                  <div className={styles.commentMeta}>
                    <div className={styles.commentAuthor}>
                      {comment.authorUsername ? (
                        <Link href={`/profile/${comment.authorUsername}`} style={{ color: "inherit", textDecoration: "none" }}>
                          <strong>{comment.authorName}</strong>
                        </Link>
                      ) : (
                        <strong>{comment.authorName}</strong>
                      )}
                      <span className={styles.role}>{comment.authorRole}</span>
                      {comment.isAccepted ? <span className={styles.acceptedBadge}>Accepted answer</span> : null}
                    </div>
                    <span className={styles.timestamp}>{relativeTime(comment.createdAt)}</span>
                  </div>
                  {comment.contentHtml ? (
                    <div
                      className={`${styles.commentText} ${styles.contentRich}`}
                      dangerouslySetInnerHTML={{ __html: comment.contentHtml }}
                    />
                  ) : (
                    <p className={styles.commentText}>{comment.content}</p>
                  )}
                  <div className={styles.commentActions}>
                    <button
                      type="button"
                      className={`${styles.commentLikeBtn} ${commentLikes[comment.id]?.liked ? styles.commentLikeBtnActive : ""}`}
                      onClick={() => void handleCommentLike(comment.id)}
                      disabled={!currentUserId}
                      title={commentLikes[comment.id]?.liked ? "Unlike this answer" : "This helped me"}
                    >
                      ↑ {commentLikes[comment.id]?.count ?? 0}
                    </button>
                  </div>
                  {canAuthorAccept && !comment.isAccepted ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="skeu-btn-ghost"
                      onClick={() => onAcceptAnswer?.(comment)}
                      disabled={acceptingCommentId === comment.id}
                    >
                      {acceptingCommentId === comment.id ? "Saving..." : "Mark as accepted"}
                    </Button>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </article>
  );
}
