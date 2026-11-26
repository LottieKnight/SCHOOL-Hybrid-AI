"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { NextBestActionCard } from "@/components/NextBestActionCard";
import { ReadinessEvidenceCard } from "@/components/ReadinessEvidenceCard";
import { PerformanceSampleBeacon } from "@/components/PerformanceSampleBeacon";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import { buildLearnWeekHrefFromLessonKey } from "@/lib/nextBestAction";
import { useSession } from "@/components/SessionProvider";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { StateCard } from "@/components/ui/StateCard";

type ScoreRow = { lesson_key: string; score_percent: number; created_at: string };
type EngagementRow = { lesson_key: string; time_spent_seconds: number; created_at: string };
type Recommendation = {
  lessonKey: string;
  subject: string;
  grade: number;
  avgScore: number;
  attempts: number;
  reason: string;
};
type DueReview = {
  id: string;
  lesson_key: string;
  subject: string;
  grade: number;
  next_review_at: string;
  score_percent: number;
  status: "pending" | "done" | "dismissed";
};
type InteractedUser = {
  userId: string;
  username: string | null;
  name: string;
  messageCount: number;
  lastInteractionAt: string | null;
};
type FollowSuggestion = {
  userId: string;
  username: string | null;
  name: string;
  relevanceScore: number;
  sharedLikes: number;
  sharedInterests: number;
  mutualFollows: number;
};
type TutorSession = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  price: number;
};
type AdminSubjectSummary = {
  subject: string;
  grade: number;
  avgScore: number;
  attempts: number;
};
type AdminLessonSummary = {
  lessonKey: string;
  opens: number;
  avgTimeSeconds: number;
};
type DashboardCard = {
  id: string;
  title: string;
  value: string;
  detail: string;
  tone: "neutral" | "good" | "warn" | "info";
  href: string | null;
};
type DashboardQuickAction = {
  id: string;
  label: string;
  href: string;
};
type DashboardSummary = {
  role: "learner" | "tutor" | "admin";
  week: {
    startsAt: string;
    endsAt: string;
    label: string;
  };
  cards: DashboardCard[];
  highlights: string[];
  quickActions: DashboardQuickAction[];
  meta: {
    unreadMentions: number;
    unreadAssignmentReminders: number;
  };
  activity: {
    dueReviews?: DueReview[];
    recommendations?: Recommendation[];
    scores?: ScoreRow[];
    engagement?: EngagementRow[];
    interactedUsers?: InteractedUser[];
    followSuggestions?: FollowSuggestion[];
    pendingSessions?: TutorSession[];
    upcomingSessions?: TutorSession[];
    topSubjects?: AdminSubjectSummary[];
    topLessons?: AdminLessonSummary[];
  };
};
type DashboardSummaryMeta = {
  cached: boolean;
  generatedAt: string | null;
  ttlMs: number;
};
type Notice = { type: "success" | "error" | "info"; message: string };

type LearnerNextAction = {
  title: string;
  description: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  footnote: string | null;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "n/a";
  return date.toLocaleString();
}

function buildLearnerNextAction(summary: DashboardSummary): LearnerNextAction {
  const fallback: LearnerNextAction = {
    title: "Continue your learning loop",
    description: "Open Learn to keep momentum, then attempt a linked past paper.",
    primaryLabel: "Open learn",
    primaryHref: "/learn",
    secondaryLabel: "Open past papers",
    secondaryHref: "/classes/demo-class/past-papers",
    footnote: "No direct lesson mapping found in recommendations yet.",
  };

  const recommendation = summary.activity.recommendations?.[0];
  if (!recommendation) return fallback;

  const lessonHref = buildLearnWeekHrefFromLessonKey(recommendation.lessonKey);
  if (!lessonHref) return fallback;

  return {
    title: "Continue weak area practice",
    description: `${recommendation.reason} Focus ${recommendation.subject} (grade ${recommendation.grade}) before your next paper.`,
    primaryLabel: "Continue weak area lesson",
    primaryHref: lessonHref,
    secondaryLabel: "Attempt past papers",
    secondaryHref: "/classes/demo-class/past-papers",
    footnote: `Mapped from recommendation ${recommendation.lessonKey}.`,
  };
}

export default function ProgressDashboardPage() {
  const { session } = useSession();
  const apiBase = API_BASE;
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryMeta, setSummaryMeta] = useState<DashboardSummaryMeta | null>(null);
  const [reviewActionId, setReviewActionId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(
    async (forceRefresh = false) => {
      if (!session) return;
      setLoading(true);
      try {
        const query = forceRefresh ? "?refresh=true" : "";
        const response = await fetch(`${apiBase}/analytics/dashboard-summary${query}`, {
          credentials: "include",
        });
        if (!response.ok) throw new Error("Unable to load dashboard summary.");
        const data = (await response.json()) as {
          summary?: DashboardSummary;
          meta?: { cached?: boolean; generatedAt?: string; ttlMs?: number };
        };
        setSummary(data.summary ?? null);
        setSummaryMeta({
          cached: Boolean(data.meta?.cached),
          generatedAt: data.meta?.generatedAt ?? null,
          ttlMs: Number(data.meta?.ttlMs ?? 0),
        });
      } catch (error) {
        setSummary(null);
        setSummaryMeta(null);
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to load dashboard summary.") });
      } finally {
        setLoading(false);
      }
    },
    [apiBase, session]
  );

  useEffect(() => {
    if (!session) {
      setSummary(null);
      setSummaryMeta(null);
      setLoading(false);
      return;
    }
    void loadDashboard(false);
  }, [loadDashboard, session]);

  useEffect(() => {
    if (!session) return;
    if (!summaryMeta?.cached) return;
    const delayMs = Math.max(1_500, Math.min((summaryMeta.ttlMs || 0) + 250, 60_000));
    const timeout = window.setTimeout(() => {
      void loadDashboard(false);
    }, delayMs);
    return () => window.clearTimeout(timeout);
  }, [loadDashboard, session, summaryMeta?.cached, summaryMeta?.ttlMs]);

  const handleReviewAction = async (reviewId: string, action: "done" | "dismiss") => {
    if (!session) return;
    setReviewActionId(reviewId);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/analytics/spaced-reviews/${reviewId}/${action}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Unable to update spaced review.");
      }
      setSummary((prev) => {
        if (!prev) return prev;
        const dueReviews = prev.activity.dueReviews ?? [];
        const nextDueReviews = dueReviews.filter((review) => review.id !== reviewId);
        const nextCards = prev.cards.map((card) =>
          card.id === "due-reviews" ? { ...card, value: String(nextDueReviews.length) } : card
        );
        return {
          ...prev,
          cards: nextCards,
          activity: {
            ...prev.activity,
            dueReviews: nextDueReviews,
          },
        };
      });
      setNotice({
        type: "success",
        message: action === "done" ? "Review marked done." : "Review dismissed.",
      });
      void loadDashboard(true);
    } catch (error) {
      setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to update spaced review.") });
    } finally {
      setReviewActionId(null);
    }
  };

  if (!session) {
    return <StateCard title="Progress dashboard" description="Sign in to view your learning progress." />;
  }

  const learnerNextAction = summary && summary.role === "learner" ? buildLearnerNextAction(summary) : null;

  return (
    <div className="glass card card-with-back">
      <PerformanceSampleBeacon routeTag="/dashboard/progress" />
      <RouteHeader
        eyebrow="Progress"
        title="Progress dashboard"
        description={summary ? `${summary.role[0].toUpperCase()}${summary.role.slice(1)} weekly snapshot.` : "Role-based weekly snapshot and actions."}
        size={76}
      >
        <div className="outline-actions">
          <Link href="/dashboard/weaknesses" className="button button--ghost" prefetch={false}>
            Open weakness map
          </Link>
          <button type="button" onClick={() => void loadDashboard(true)} disabled={loading}>
            Refresh snapshot
          </button>
        </div>
      </RouteHeader>
      {notice && <div className="badge">{notice.message}</div>}
      {loading ? (
        <StateCard title="Loading dashboard" description="SCHOOL is assembling your latest role-based snapshot and next actions." />
      ) : !summary ? (
        <StateCard title="No dashboard summary available" description="There isn’t a usable weekly snapshot right now. Refresh again in a moment." />
      ) : (
        <>
          {learnerNextAction ? (
            <NextBestActionCard
              heading="Golden path: Progress -> Next action"
              title={learnerNextAction.title}
              description={learnerNextAction.description}
              primaryAction={{
                label: learnerNextAction.primaryLabel,
                href: learnerNextAction.primaryHref,
              }}
              secondaryAction={{
                label: learnerNextAction.secondaryLabel,
                href: learnerNextAction.secondaryHref,
              }}
              footnote={learnerNextAction.footnote}
            />
          ) : null}
          {summary.role === "learner" ? (
            <ReadinessEvidenceCard
              compact
              scores={summary.activity.scores}
              dueReviews={summary.activity.dueReviews}
              recommendations={summary.activity.recommendations}
            />
          ) : null}
          <div className="badge">Week window: {summary.week.label}</div>
          <div className="badge">
            Snapshot: {summaryMeta?.cached ? "cached" : "fresh"} | generated {formatDateTime(summaryMeta?.generatedAt)}
          </div>
          <div className="badge">
            Unread mentions: {summary.meta.unreadMentions} | Unread assignment reminders:{" "}
            {summary.meta.unreadAssignmentReminders}
          </div>

          <h3>Snapshot</h3>
          <div className="grid">
            {summary.cards.map((card) => (
              <div className="list-item" key={card.id}>
                <strong>{card.title}</strong>
                <p className="subtitle">{card.value}</p>
                <p className="badge">{card.detail}</p>
                {card.href ? <Link href={card.href}>Open</Link> : null}
              </div>
            ))}
          </div>

          <div className="spacer" />
          <h3>Highlights</h3>
          {summary.highlights.length === 0 ? (
            <p className="subtitle">No highlights yet.</p>
          ) : (
            <div className="list">
              {summary.highlights.map((line) => (
                <div className="list-item" key={line}>
                  <p className="subtitle">{line}</p>
                </div>
              ))}
            </div>
          )}

          <div className="spacer" />
          <h3>Quick actions</h3>
          <div className="outline-actions">
            {summary.quickActions.map((action) => (
              <Link className="button" key={action.id} href={action.href}>
                {action.label}
              </Link>
            ))}
          </div>

          {summary.role === "learner" && (
            <>
              <div className="spacer" />
              <h3>Due spaced reviews</h3>
              {(summary.activity.dueReviews ?? []).length === 0 ? (
                <p className="subtitle">No spaced reviews due.</p>
              ) : (
                <div className="grid">
                  {(summary.activity.dueReviews ?? []).map((review) => (
                    <div className="list-item" key={review.id}>
                      <strong>{review.lesson_key}</strong>
                      <p className="subtitle">
                        Score {Number(review.score_percent).toFixed(0)}% | due{" "}
                        {new Date(review.next_review_at).toLocaleString()}
                      </p>
                      <div className="outline-actions">
                        <button
                          type="button"
                          onClick={() => void handleReviewAction(review.id, "done")}
                          disabled={reviewActionId === review.id}
                        >
                          Done
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleReviewAction(review.id, "dismiss")}
                          disabled={reviewActionId === review.id}
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="spacer" />
              <h3>Recommended reinforcement</h3>
              {(summary.activity.recommendations ?? []).length === 0 ? (
                <p className="subtitle">No reinforcement recommendations yet.</p>
              ) : (
                <div className="grid">
                  {(summary.activity.recommendations ?? []).map((row) => (
                    <div className="list-item" key={row.lessonKey}>
                      <strong>{row.lessonKey}</strong>
                      <p className="subtitle">
                        {row.reason} | avg {row.avgScore.toFixed(0)}% | attempts {row.attempts}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="spacer" />
              <h3>Recent interactions</h3>
              {(summary.activity.interactedUsers ?? []).length === 0 ? (
                <p className="subtitle">No recent interactions.</p>
              ) : (
                <div className="grid">
                  {(summary.activity.interactedUsers ?? []).map((row) => (
                    <div className="list-item" key={row.userId}>
                      <strong>{row.username ? `@${row.username}` : row.name}</strong>
                      <p className="subtitle">
                        Messages: {row.messageCount} | Last: {formatDateTime(row.lastInteractionAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="spacer" />
              <h3>People you may want to follow</h3>
              {(summary.activity.followSuggestions ?? []).length === 0 ? (
                <p className="subtitle">No follow suggestions yet.</p>
              ) : (
                <div className="grid">
                  {(summary.activity.followSuggestions ?? []).map((row) => (
                    <div className="list-item" key={row.userId}>
                      <strong>{row.username ? `@${row.username}` : row.name}</strong>
                      <p className="subtitle">
                        Relevance {row.relevanceScore} | shared likes {row.sharedLikes} | mutual follows {row.mutualFollows}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="spacer" />
              <h3>Quiz scores</h3>
              {(summary.activity.scores ?? []).length === 0 ? (
                <p className="subtitle">No quiz scores yet.</p>
              ) : (
                <div className="grid">
                  {(summary.activity.scores ?? []).map((row) => (
                    <div className="list-item" key={`${row.lesson_key}-${row.created_at}`}>
                      <strong>{row.lesson_key}</strong>
                      <p className="subtitle">Score: {Number(row.score_percent).toFixed(0)}%</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="spacer" />
              <h3>Time on lesson</h3>
              {(summary.activity.engagement ?? []).length === 0 ? (
                <p className="subtitle">No lesson engagement yet.</p>
              ) : (
                <div className="grid">
                  {(summary.activity.engagement ?? []).map((row) => (
                    <div className="list-item" key={`${row.lesson_key}-${row.created_at}`}>
                      <strong>{row.lesson_key}</strong>
                      <p className="subtitle">Time: {Number(row.time_spent_seconds).toFixed(0)}s</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {summary.role === "tutor" && (
            <>
              <div className="spacer" />
              <h3>Pending requests</h3>
              {(summary.activity.pendingSessions ?? []).length === 0 ? (
                <p className="subtitle">No pending requests.</p>
              ) : (
                <div className="grid">
                  {(summary.activity.pendingSessions ?? []).map((sessionRow) => (
                    <div className="list-item" key={sessionRow.id}>
                      <strong>Session {sessionRow.id.slice(0, 8)}</strong>
                      <p className="subtitle">
                        {formatDateTime(sessionRow.startsAt)} | {sessionRow.status} | R
                        {Number(sessionRow.price).toFixed(0)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="spacer" />
              <h3>Upcoming sessions</h3>
              {(summary.activity.upcomingSessions ?? []).length === 0 ? (
                <p className="subtitle">No upcoming sessions.</p>
              ) : (
                <div className="grid">
                  {(summary.activity.upcomingSessions ?? []).map((sessionRow) => (
                    <div className="list-item" key={sessionRow.id}>
                      <strong>Session {sessionRow.id.slice(0, 8)}</strong>
                      <p className="subtitle">
                        {formatDateTime(sessionRow.startsAt)} | {sessionRow.status} | R
                        {Number(sessionRow.price).toFixed(0)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="spacer" />
              <h3>Learner conversation activity</h3>
              {(summary.activity.interactedUsers ?? []).length === 0 ? (
                <p className="subtitle">No recent learner interactions.</p>
              ) : (
                <div className="grid">
                  {(summary.activity.interactedUsers ?? []).map((row) => (
                    <div className="list-item" key={row.userId}>
                      <strong>{row.username ? `@${row.username}` : row.name}</strong>
                      <p className="subtitle">
                        Messages: {row.messageCount} | Last: {formatDateTime(row.lastInteractionAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {summary.role === "admin" && (
            <>
              <div className="spacer" />
              <h3>Top subject performance segments</h3>
              {(summary.activity.topSubjects ?? []).length === 0 ? (
                <p className="subtitle">No subject analytics available.</p>
              ) : (
                <div className="grid">
                  {(summary.activity.topSubjects ?? []).map((row) => (
                    <div className="list-item" key={`${row.subject}-${row.grade}`}>
                      <strong>
                        Grade {row.grade} {row.subject}
                      </strong>
                      <p className="subtitle">
                        Avg {row.avgScore.toFixed(1)}% | attempts {row.attempts}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="spacer" />
              <h3>Most engaged lessons</h3>
              {(summary.activity.topLessons ?? []).length === 0 ? (
                <p className="subtitle">No lesson engagement analytics available.</p>
              ) : (
                <div className="grid">
                  {(summary.activity.topLessons ?? []).map((row) => (
                    <div className="list-item" key={row.lessonKey}>
                      <strong>{row.lessonKey}</strong>
                      <p className="subtitle">
                        Opens {row.opens} | Avg time {row.avgTimeSeconds.toFixed(0)}s
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
