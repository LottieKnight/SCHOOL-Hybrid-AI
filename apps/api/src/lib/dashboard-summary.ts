import {
  countUnreadAssignmentReminderNotifications,
  countUnreadMentionNotifications,
  listInteractedUsers,
} from "../db/messages.js";
import { pool } from "../db/pool.js";
import { getAdminAnalyticsSummary, getLearnerProgressSummary } from "../db/policies.js";
import { listFollowSuggestions } from "../db/profile.js";
import { getPayoutSummary, getTutorByUserId, listSessionsForUser } from "../db/tutors.js";
import { isAdminPrincipal } from "./admin-access.js";

type DashboardCardTone = "neutral" | "good" | "warn" | "info";
type DashboardRole = "learner" | "tutor" | "admin";

type DashboardCard = {
  id: string;
  title: string;
  value: string;
  detail: string;
  tone: DashboardCardTone;
  href: string | null;
};

type DashboardQuickAction = {
  id: string;
  label: string;
  href: string;
};

type ScoreRow = {
  lesson_key: string;
  score_percent: number;
  created_at: string;
};

type EngagementRow = {
  lesson_key: string;
  time_spent_seconds: number;
  created_at: string;
};

type RecommendationRow = {
  lessonKey: string;
  subject: string;
  grade: number;
  avgScore: number;
  attempts: number;
  reason: string;
};

type DueReviewRow = {
  id: string;
  lesson_key: string;
  subject: string;
  grade: number;
  next_review_at: string;
  score_percent: number;
  status: "pending" | "done" | "dismissed";
  created_at: string;
  updated_at: string;
};

type LearnerProgressSummary = {
  scores: ScoreRow[];
  engagement: EngagementRow[];
  stats: {
    avgScore: number;
    attempts: number;
  };
  dueReviews: DueReviewRow[];
  recommendations: RecommendationRow[];
};

type InteractedUserSummary = {
  userId: string;
  username: string | null;
  name: string;
  messageCount: number;
  lastInteractionAt: string | null;
};

type FollowSuggestionSummary = {
  userId: string;
  username: string | null;
  name: string;
  relevanceScore: number;
  sharedLikes: number;
  sharedInterests: number;
  mutualFollows: number;
};

type TutorSessionSummary = {
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

type DashboardWeek = {
  startsAt: string;
  endsAt: string;
  label: string;
};

type DashboardActivity = {
  dueReviews?: DueReviewRow[];
  recommendations?: RecommendationRow[];
  scores?: ScoreRow[];
  engagement?: EngagementRow[];
  interactedUsers?: InteractedUserSummary[];
  followSuggestions?: FollowSuggestionSummary[];
  pendingSessions?: TutorSessionSummary[];
  upcomingSessions?: TutorSessionSummary[];
  topSubjects?: AdminSubjectSummary[];
  topLessons?: AdminLessonSummary[];
};

export type DashboardSummary = {
  role: DashboardRole;
  week: DashboardWeek;
  cards: DashboardCard[];
  highlights: string[];
  quickActions: DashboardQuickAction[];
  meta: {
    unreadMentions: number;
    unreadAssignmentReminders: number;
  };
  activity: DashboardActivity;
};

export const DASHBOARD_SUMMARY_CACHE_TTL_MS = 20_000;
const DASHBOARD_SUMMARY_CACHE_MAX_ENTRIES = 1_500;

type BuildDashboardSummaryInput = {
  userId: string;
  role?: string | null;
  email?: string | null;
};

type DashboardSummaryCacheEntry = {
  summary: DashboardSummary;
  generatedAt: string;
  expiresAt: number;
};

const dashboardSummaryCache = new Map<string, DashboardSummaryCacheEntry>();

type CountRow = { total: number };
type LearnerQuizWeeklyRow = { attempts: number; avg_score: number };
type LearnerStudyWeeklyRow = { total_seconds: number };
type AdminWeeklyQuizRow = { attempts: number; avg_score: number };
type AdminWeeklyEngagementRow = { opens: number; total_seconds: number };
type AdminScoreRow = { subject: string; grade: number; avg_score: number; attempts: number };
type AdminEngagementRow = { lesson_key: string; opens: number; avg_time: number };
type TutorSession = Awaited<ReturnType<typeof listSessionsForUser>>[number];

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatMinutes(totalSeconds: number) {
  const minutes = Math.max(0, Math.round(totalSeconds / 60));
  return `${minutes} min`;
}

function formatRand(amount: number) {
  return `R${amount.toFixed(2)}`;
}

function buildDashboardSummaryCacheKey(input: BuildDashboardSummaryInput) {
  const role = (input.role ?? "").trim().toLowerCase();
  const email = (input.email ?? "").trim().toLowerCase();
  return `${input.userId}|${role}|${email}`;
}

function pruneDashboardSummaryCache(nowMs: number) {
  for (const [key, entry] of dashboardSummaryCache.entries()) {
    if (entry.expiresAt <= nowMs) {
      dashboardSummaryCache.delete(key);
    }
  }

  while (dashboardSummaryCache.size > DASHBOARD_SUMMARY_CACHE_MAX_ENTRIES) {
    const oldestKey = dashboardSummaryCache.keys().next().value;
    if (!oldestKey) break;
    dashboardSummaryCache.delete(oldestKey);
  }
}

function normalizeRole(input: BuildDashboardSummaryInput): DashboardRole {
  if (isAdminPrincipal({ role: input.role, email: input.email })) return "admin";
  const role = (input.role ?? "").trim().toLowerCase();
  if (role === "tutor") return "tutor";
  return "learner";
}

function getWeekBounds(reference = new Date()) {
  const weekStart = new Date(reference);
  weekStart.setUTCHours(0, 0, 0, 0);
  const day = weekStart.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  weekStart.setUTCDate(weekStart.getUTCDate() - diffToMonday);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7);
  return { weekStart, weekEnd };
}

function formatWeekLabel(weekStart: Date, weekEndExclusive: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const endInclusive = new Date(weekEndExclusive);
  endInclusive.setUTCDate(endInclusive.getUTCDate() - 1);
  return `${fmt.format(weekStart)} - ${fmt.format(endInclusive)}`;
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function isWithinWindow(value: string | null | undefined, start: Date, end: Date) {
  const parsed = parseDate(value);
  if (!parsed) return false;
  return parsed >= start && parsed < end;
}

function mapTutorSession(item: TutorSession): TutorSessionSummary | null {
  const startsAt = item.scheduledStartAt ?? item.startTime;
  const endsAt = item.scheduledEndAt ?? item.endTime;
  const startDate = parseDate(startsAt);
  const endDate = parseDate(endsAt);
  if (!startDate || !endDate) return null;
  return {
    id: item.id,
    startsAt: startDate.toISOString(),
    endsAt: endDate.toISOString(),
    status: item.status,
    price: toFiniteNumber(item.price),
  };
}

async function buildLearnerDashboard(
  input: BuildDashboardSummaryInput,
  week: DashboardWeek
): Promise<DashboardSummary> {
  const [quizWeekly, studyWeekly, dueReviewsCount, progressRaw, unreadMentions, unreadAssignmentReminders] =
    await Promise.all([
      pool.query<LearnerQuizWeeklyRow>(
        `
          SELECT
            COUNT(*)::int AS attempts,
            COALESCE(AVG(score_percent)::float, 0) AS avg_score
          FROM quiz_attempts_v2
          WHERE learner_id = $1
            AND created_at >= $2
            AND created_at < $3
        `,
        [input.userId, week.startsAt, week.endsAt]
      ),
      pool.query<LearnerStudyWeeklyRow>(
        `
          SELECT COALESCE(SUM(time_spent_seconds), 0)::int AS total_seconds
          FROM lesson_engagements
          WHERE learner_id = $1
            AND created_at >= $2
            AND created_at < $3
        `,
        [input.userId, week.startsAt, week.endsAt]
      ),
      pool.query<CountRow>(
        `
          SELECT COUNT(*)::int AS total
          FROM learner_spaced_reviews
          WHERE learner_id = $1
            AND status = 'pending'
            AND next_review_at <= NOW()
        `,
        [input.userId]
      ),
      getLearnerProgressSummary(input.userId),
      countUnreadMentionNotifications(input.userId),
      countUnreadAssignmentReminderNotifications(input.userId),
    ]);

  const [interactedUsersRaw, followSuggestionsRaw] = await Promise.all([
    listInteractedUsers(input.userId, 8),
    listFollowSuggestions(input.userId, { limit: 6, offset: 0 }),
  ]);

  const progress = progressRaw as LearnerProgressSummary;
  const attemptsThisWeek = toFiniteNumber(quizWeekly.rows[0]?.attempts);
  const averageScoreThisWeek = toFiniteNumber(quizWeekly.rows[0]?.avg_score);
  const totalStudySeconds = toFiniteNumber(studyWeekly.rows[0]?.total_seconds);
  const dueReviewsTotal = toFiniteNumber(dueReviewsCount.rows[0]?.total);
  const recommendationsCount = progress.recommendations?.length ?? 0;

  const interactedUsers: InteractedUserSummary[] = interactedUsersRaw.map((row) => ({
    userId: row.user_id,
    username: row.username,
    name: row.name,
    messageCount: toFiniteNumber(row.message_count),
    lastInteractionAt: parseDate(row.last_interaction_at)?.toISOString() ?? null,
  }));

  const followSuggestions: FollowSuggestionSummary[] = followSuggestionsRaw.map((row) => ({
    userId: row.user_id,
    username: row.username,
    name: row.name,
    relevanceScore: toFiniteNumber(row.relevance_score),
    sharedLikes: toFiniteNumber(row.shared_likes),
    sharedInterests: toFiniteNumber(row.shared_interests),
    mutualFollows: toFiniteNumber(row.mutual_follows),
  }));

  const highlights: string[] = [];
  if (dueReviewsTotal > 0) {
    highlights.push(`${dueReviewsTotal} spaced review${dueReviewsTotal === 1 ? "" : "s"} due now.`);
  }
  if (recommendationsCount > 0) {
    const first = progress.recommendations[0];
    highlights.push(`${first.lessonKey} is flagged for reinforcement.`);
  }
  if (totalStudySeconds === 0) {
    highlights.push("No lesson engagement logged this week yet.");
  }
  if (!highlights.length) {
    highlights.push("Steady learning momentum this week.");
  }

  return {
    role: "learner",
    week,
    cards: [
      {
        id: "study-time",
        title: "Study time",
        value: formatMinutes(totalStudySeconds),
        detail: "Tracked lesson engagement this week.",
        tone: totalStudySeconds > 0 ? "good" : "info",
        href: "/learn",
      },
      {
        id: "average-score",
        title: "Average quiz score",
        value: `${averageScoreThisWeek.toFixed(1)}%`,
        detail: `${attemptsThisWeek} attempt${attemptsThisWeek === 1 ? "" : "s"} this week.`,
        tone: averageScoreThisWeek >= 70 ? "good" : averageScoreThisWeek >= 55 ? "info" : "warn",
        href: "/dashboard/progress",
      },
      {
        id: "due-reviews",
        title: "Due reviews",
        value: String(dueReviewsTotal),
        detail: "Pending spaced repetition reviews.",
        tone: dueReviewsTotal > 0 ? "warn" : "good",
        href: "/dashboard/progress",
      },
      {
        id: "reinforcement",
        title: "Reinforcement queue",
        value: String(recommendationsCount),
        detail: "Low-mastery lessons needing follow-up.",
        tone: recommendationsCount > 0 ? "info" : "neutral",
        href: "/dashboard/progress",
      },
      {
        id: "mentions",
        title: "Unread mentions",
        value: String(unreadMentions),
        detail: "New mentions in your conversations.",
        tone: unreadMentions > 0 ? "info" : "neutral",
        href: "/messages",
      },
      {
        id: "assignment-reminders",
        title: "Unread assignment reminders",
        value: String(unreadAssignmentReminders),
        detail: "Pending reminder notifications.",
        tone: unreadAssignmentReminders > 0 ? "warn" : "neutral",
        href: "/messages",
      },
    ],
    highlights,
    quickActions: [
      { id: "continue-learning", label: "Continue learning", href: "/learn" },
      { id: "open-messages", label: "Open message hub", href: "/messages" },
      { id: "find-tutor", label: "Find a tutor", href: "/tutors" },
    ],
    meta: {
      unreadMentions,
      unreadAssignmentReminders,
    },
    activity: {
      dueReviews: progress.dueReviews ?? [],
      recommendations: progress.recommendations ?? [],
      scores: progress.scores ?? [],
      engagement: progress.engagement ?? [],
      interactedUsers,
      followSuggestions,
    },
  };
}

async function buildTutorDashboard(
  input: BuildDashboardSummaryInput,
  week: DashboardWeek
): Promise<DashboardSummary> {
  const [tutor, sessions, unreadMentions, unreadAssignmentReminders, interactedUsersRaw] = await Promise.all([
    getTutorByUserId(input.userId),
    listSessionsForUser(input.userId),
    countUnreadMentionNotifications(input.userId),
    countUnreadAssignmentReminderNotifications(input.userId),
    listInteractedUsers(input.userId, 8),
  ]);

  const interactedUsers: InteractedUserSummary[] = interactedUsersRaw.map((row) => ({
    userId: row.user_id,
    username: row.username,
    name: row.name,
    messageCount: toFiniteNumber(row.message_count),
    lastInteractionAt: parseDate(row.last_interaction_at)?.toISOString() ?? null,
  }));

  if (!tutor) {
    return {
      role: "tutor",
      week,
      cards: [
        {
          id: "tutor-onboarding",
          title: "Tutor onboarding",
          value: "Incomplete",
          detail: "Complete your tutor profile to unlock tutor metrics.",
          tone: "warn",
          href: "/tutors/onboarding",
        },
        {
          id: "mentions",
          title: "Unread mentions",
          value: String(unreadMentions),
          detail: "New mentions in your conversations.",
          tone: unreadMentions > 0 ? "info" : "neutral",
          href: "/messages",
        },
      ],
      highlights: ["Finish tutor onboarding to activate session and payout tracking."],
      quickActions: [
        { id: "finish-onboarding", label: "Finish tutor onboarding", href: "/tutors/onboarding" },
        { id: "open-messages", label: "Open message hub", href: "/messages" },
      ],
      meta: {
        unreadMentions,
        unreadAssignmentReminders,
      },
      activity: {
        interactedUsers,
      },
    };
  }

  const tutorSessions = sessions.filter((item) => item.role === "tutor");
  const now = new Date();
  const pending = tutorSessions
    .filter((item) => item.status === "requested")
    .sort((a, b) => {
      const aStart = parseDate(a.scheduledStartAt ?? a.startTime)?.getTime() ?? 0;
      const bStart = parseDate(b.scheduledStartAt ?? b.startTime)?.getTime() ?? 0;
      return aStart - bStart;
    });

  const upcoming = tutorSessions
    .filter((item) => {
      if (!["requested", "confirmed"].includes(item.status)) return false;
      const startsAt = parseDate(item.scheduledStartAt ?? item.startTime);
      return Boolean(startsAt && startsAt >= now);
    })
    .sort((a, b) => {
      const aStart = parseDate(a.scheduledStartAt ?? a.startTime)?.getTime() ?? 0;
      const bStart = parseDate(b.scheduledStartAt ?? b.startTime)?.getTime() ?? 0;
      return aStart - bStart;
    });

  const completedThisWeek = tutorSessions.filter(
    (item) =>
      item.status === "completed" &&
      isWithinWindow(item.completedAt ?? item.scheduledEndAt ?? item.endTime, new Date(week.startsAt), new Date(week.endsAt))
  ).length;

  const [payout] = await Promise.all([getPayoutSummary(tutor.id)]);

  const highlights: string[] = [];
  if (pending.length > 0) {
    highlights.push(`${pending.length} session request${pending.length === 1 ? "" : "s"} awaiting your response.`);
  }
  if (upcoming.length > 0) {
    highlights.push(`${upcoming.length} upcoming session${upcoming.length === 1 ? "" : "s"} in your queue.`);
  }
  if (!highlights.length) {
    highlights.push("No pending tutor actions right now.");
  }

  return {
    role: "tutor",
    week,
    cards: [
      {
        id: "pending-requests",
        title: "Pending requests",
        value: String(pending.length),
        detail: "Requested sessions awaiting confirmation.",
        tone: pending.length > 0 ? "warn" : "good",
        href: "/tutors/dashboard",
      },
      {
        id: "upcoming-sessions",
        title: "Upcoming sessions",
        value: String(upcoming.length),
        detail: "Requested and confirmed sessions ahead.",
        tone: upcoming.length > 0 ? "info" : "neutral",
        href: "/tutors/dashboard",
      },
      {
        id: "weekly-completions",
        title: "Completed this week",
        value: String(completedThisWeek),
        detail: "Sessions marked completed this week.",
        tone: completedThisWeek > 0 ? "good" : "neutral",
        href: "/tutors/dashboard",
      },
      {
        id: "weekly-earnings",
        title: "Weekly earnings",
        value: formatRand(toFiniteNumber(payout.weeklyEarnings)),
        detail: "Net earnings estimate after commission.",
        tone: toFiniteNumber(payout.weeklyEarnings) > 0 ? "good" : "neutral",
        href: "/tutors/dashboard",
      },
      {
        id: "avg-rating",
        title: "Average rating",
        value: tutor.ratingAvg !== null ? tutor.ratingAvg.toFixed(2) : "N/A",
        detail: `${toFiniteNumber(tutor.ratingCount)} rating${toFiniteNumber(tutor.ratingCount) === 1 ? "" : "s"} received.`,
        tone: tutor.ratingAvg !== null && tutor.ratingAvg >= 4 ? "good" : "neutral",
        href: "/tutors/dashboard",
      },
      {
        id: "mentions",
        title: "Unread mentions",
        value: String(unreadMentions),
        detail: "New mentions in your conversations.",
        tone: unreadMentions > 0 ? "info" : "neutral",
        href: "/messages",
      },
    ],
    highlights,
    quickActions: [
      { id: "open-tutor-dashboard", label: "Open tutor dashboard", href: "/tutors/dashboard" },
      { id: "open-messages", label: "Open message hub", href: "/messages" },
      { id: "open-marketplace", label: "Tutor marketplace", href: "/tutors" },
    ],
    meta: {
      unreadMentions,
      unreadAssignmentReminders,
    },
    activity: {
      pendingSessions: pending.map(mapTutorSession).filter((item): item is TutorSessionSummary => item !== null).slice(0, 6),
      upcomingSessions: upcoming.map(mapTutorSession).filter((item): item is TutorSessionSummary => item !== null).slice(0, 6),
      interactedUsers,
    },
  };
}

async function buildAdminDashboard(
  input: BuildDashboardSummaryInput,
  week: DashboardWeek
): Promise<DashboardSummary> {
  const [summaryRaw, weeklyQuiz, weeklyEngagement, newUsers, openDisputes, messagesThisWeek] =
    await Promise.all([
      getAdminAnalyticsSummary(),
      pool.query<AdminWeeklyQuizRow>(
        `
          SELECT
            COUNT(*)::int AS attempts,
            COALESCE(AVG(score_percent)::float, 0) AS avg_score
          FROM quiz_attempts_v2
          WHERE created_at >= $1
            AND created_at < $2
        `,
        [week.startsAt, week.endsAt]
      ),
      pool.query<AdminWeeklyEngagementRow>(
        `
          SELECT
            COUNT(*)::int AS opens,
            COALESCE(SUM(time_spent_seconds), 0)::int AS total_seconds
          FROM lesson_engagements
          WHERE created_at >= $1
            AND created_at < $2
        `,
        [week.startsAt, week.endsAt]
      ),
      pool.query<CountRow>(
        `
          SELECT COUNT(*)::int AS total
          FROM users
          WHERE created_at >= $1
            AND created_at < $2
        `,
        [week.startsAt, week.endsAt]
      ),
      pool.query<CountRow>(
        `
          SELECT COUNT(*)::int AS total
          FROM disputes
          WHERE status IN ('open', 'under_review')
        `
      ),
      pool.query<CountRow>(
        `
          SELECT COUNT(*)::int AS total
          FROM messages
          WHERE created_at >= $1
            AND created_at < $2
        `,
        [week.startsAt, week.endsAt]
      ),
    ]);

  const scores = (summaryRaw.scores ?? []) as AdminScoreRow[];
  const engagement = (summaryRaw.engagement ?? []) as AdminEngagementRow[];
  const topSubjects = [...scores]
    .sort((a, b) => toFiniteNumber(b.attempts) - toFiniteNumber(a.attempts))
    .slice(0, 6)
    .map((row) => ({
      subject: row.subject,
      grade: toFiniteNumber(row.grade),
      avgScore: toFiniteNumber(row.avg_score),
      attempts: toFiniteNumber(row.attempts),
    }));

  const topLessons = engagement.slice(0, 6).map((row) => ({
    lessonKey: row.lesson_key,
    opens: toFiniteNumber(row.opens),
    avgTimeSeconds: toFiniteNumber(row.avg_time),
  }));

  const weeklyAttempts = toFiniteNumber(weeklyQuiz.rows[0]?.attempts);
  const weeklyAvgScore = toFiniteNumber(weeklyQuiz.rows[0]?.avg_score);
  const weeklyEngagementOpens = toFiniteNumber(weeklyEngagement.rows[0]?.opens);
  const weeklyEngagementTime = toFiniteNumber(weeklyEngagement.rows[0]?.total_seconds);
  const weeklyNewUsers = toFiniteNumber(newUsers.rows[0]?.total);
  const openDisputesCount = toFiniteNumber(openDisputes.rows[0]?.total);
  const weeklyMessages = toFiniteNumber(messagesThisWeek.rows[0]?.total);

  const highlights: string[] = [];
  if (openDisputesCount > 0) {
    highlights.push(`${openDisputesCount} tutor dispute${openDisputesCount === 1 ? "" : "s"} currently open.`);
  }
  if (topLessons[0]) {
    highlights.push(`${topLessons[0].lessonKey} is the most-opened lesson in analytics.`);
  }
  if (!highlights.length) {
    highlights.push("No high-priority admin alerts this week.");
  }

  return {
    role: "admin",
    week,
    cards: [
      {
        id: "weekly-quiz-attempts",
        title: "Quiz attempts (week)",
        value: String(weeklyAttempts),
        detail: "Attempts recorded this week platform-wide.",
        tone: weeklyAttempts > 0 ? "info" : "neutral",
        href: "/admin/learning-analytics",
      },
      {
        id: "weekly-average-score",
        title: "Average score (week)",
        value: `${weeklyAvgScore.toFixed(1)}%`,
        detail: "Average quiz score this week.",
        tone: weeklyAvgScore >= 70 ? "good" : weeklyAvgScore >= 55 ? "info" : "warn",
        href: "/admin/learning-analytics",
      },
      {
        id: "weekly-engagement",
        title: "Lesson opens (week)",
        value: String(weeklyEngagementOpens),
        detail: `${formatMinutes(weeklyEngagementTime)} total tracked lesson time.`,
        tone: weeklyEngagementOpens > 0 ? "info" : "neutral",
        href: "/admin/learning-analytics",
      },
      {
        id: "weekly-new-users",
        title: "New users (week)",
        value: String(weeklyNewUsers),
        detail: "Accounts created in this weekly window.",
        tone: weeklyNewUsers > 0 ? "good" : "neutral",
        href: "/admin",
      },
      {
        id: "open-disputes",
        title: "Open disputes",
        value: String(openDisputesCount),
        detail: "Disputes in open or under-review state.",
        tone: openDisputesCount > 0 ? "warn" : "good",
        href: "/admin",
      },
      {
        id: "messages-week",
        title: "Messages (week)",
        value: String(weeklyMessages),
        detail: "Messages created this week.",
        tone: weeklyMessages > 0 ? "info" : "neutral",
        href: "/messages",
      },
    ],
    highlights,
    quickActions: [
      { id: "open-admin-analytics", label: "Open learning analytics", href: "/admin/learning-analytics" },
      { id: "open-admin-home", label: "Open admin panel", href: "/admin" },
      { id: "open-messages", label: "Open message hub", href: "/messages" },
    ],
    meta: {
      unreadMentions: 0,
      unreadAssignmentReminders: 0,
    },
    activity: {
      topSubjects,
      topLessons,
    },
  };
}

export async function buildDashboardSummary(input: BuildDashboardSummaryInput): Promise<DashboardSummary> {
  const role = normalizeRole(input);
  const { weekStart, weekEnd } = getWeekBounds();
  const week: DashboardWeek = {
    startsAt: weekStart.toISOString(),
    endsAt: weekEnd.toISOString(),
    label: formatWeekLabel(weekStart, weekEnd),
  };

  if (role === "admin") {
    return buildAdminDashboard(input, week);
  }
  if (role === "tutor") {
    return buildTutorDashboard(input, week);
  }
  return buildLearnerDashboard(input, week);
}

export function clearDashboardSummaryCache(options?: { userId?: string }) {
  if (!options?.userId) {
    dashboardSummaryCache.clear();
    return;
  }
  const prefix = `${options.userId}|`;
  for (const key of dashboardSummaryCache.keys()) {
    if (key.startsWith(prefix)) {
      dashboardSummaryCache.delete(key);
    }
  }
}

export async function getDashboardSummaryCached(
  input: BuildDashboardSummaryInput,
  options?: { refresh?: boolean }
): Promise<{ summary: DashboardSummary; cached: boolean; generatedAt: string; ttlMs: number }> {
  const nowMs = Date.now();
  pruneDashboardSummaryCache(nowMs);
  const cacheKey = buildDashboardSummaryCacheKey(input);
  const refresh = options?.refresh ?? false;

  if (!refresh) {
    const existing = dashboardSummaryCache.get(cacheKey);
    if (existing && existing.expiresAt > nowMs) {
      return {
        summary: existing.summary,
        cached: true,
        generatedAt: existing.generatedAt,
        ttlMs: Math.max(0, existing.expiresAt - nowMs),
      };
    }
  }

  const summary = await buildDashboardSummary(input);
  const generatedAt = new Date().toISOString();
  const expiresAt = nowMs + DASHBOARD_SUMMARY_CACHE_TTL_MS;
  dashboardSummaryCache.set(cacheKey, { summary, generatedAt, expiresAt });
  pruneDashboardSummaryCache(nowMs);

  return {
    summary,
    cached: false,
    generatedAt,
    ttlMs: DASHBOARD_SUMMARY_CACHE_TTL_MS,
  };
}
