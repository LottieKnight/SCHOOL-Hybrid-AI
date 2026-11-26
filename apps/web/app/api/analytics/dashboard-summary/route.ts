import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifyToken, type JwtPayload } from "@/lib/server/cookieAuth";
import { queryPlannerDb } from "@/lib/server/plannerDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Types ───────────────────────────────────────────────────────────────────

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

type DashboardSummary = {
  role: DashboardRole;
  week: { startsAt: string; endsAt: string; label: string };
  cards: DashboardCard[];
  highlights: string[];
  quickActions: { id: string; label: string; href: string }[];
  meta: { unreadMentions: number; unreadAssignmentReminders: number };
  activity: Record<string, unknown>;
};

// ─── In-process cache (survives within a warm Vercel function instance) ───────

const CACHE_TTL_MS = 20_000;
const CACHE_MAX = 1_500;

type CacheEntry = { summary: DashboardSummary; generatedAt: string; expiresAt: number };
type CacheGlobal = typeof globalThis & { __dashboardCache?: Map<string, CacheEntry> };

function getCache(): Map<string, CacheEntry> {
  const g = globalThis as CacheGlobal;
  if (!g.__dashboardCache) g.__dashboardCache = new Map();
  return g.__dashboardCache;
}

function pruneCacheEntries(nowMs: number) {
  const cache = getCache();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= nowMs) cache.delete(key);
  }
  while (cache.size > CACHE_MAX) {
    const first = cache.keys().next().value;
    if (!first) break;
    cache.delete(first);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toNum(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function formatMinutes(seconds: number) {
  return `${Math.max(0, Math.round(seconds / 60))} min`;
}

function normalizeRole(payload: JwtPayload): DashboardRole {
  const role = (payload.role ?? "").trim().toLowerCase();
  if (role === "admin") return "admin";
  if (role === "tutor") return "tutor";
  return "learner";
}

function getWeekBounds() {
  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const day = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() - ((day + 6) % 7));
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return { weekStart: start, weekEnd: end };
}

function formatWeekLabel(start: Date, endExclusive: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const endInclusive = new Date(endExclusive);
  endInclusive.setUTCDate(endInclusive.getUTCDate() - 1);
  return `${fmt.format(start)} - ${fmt.format(endInclusive)}`;
}

// ─── Learner dashboard ────────────────────────────────────────────────────────

async function buildLearnerDashboard(
  userId: string,
  week: DashboardSummary["week"]
): Promise<DashboardSummary> {
  const [quizWeekly, studyWeekly, dueCount, scoresAll, engagementAll, statsAll, dueReviews, recommendations, unreadMentions, unreadAssignmentReminders] =
    await Promise.all([
      queryPlannerDb<{ attempts: number; avg_score: number }>(
        `SELECT COUNT(*)::int AS attempts, COALESCE(AVG(score_percent)::float, 0) AS avg_score
         FROM quiz_attempts_v2
         WHERE learner_id = $1 AND created_at >= $2 AND created_at < $3`,
        [userId, week.startsAt, week.endsAt]
      ),
      queryPlannerDb<{ total_seconds: number }>(
        `SELECT COALESCE(SUM(time_spent_seconds), 0)::int AS total_seconds
         FROM lesson_engagements
         WHERE learner_id = $1 AND created_at >= $2 AND created_at < $3`,
        [userId, week.startsAt, week.endsAt]
      ),
      queryPlannerDb<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM learner_spaced_reviews
         WHERE learner_id = $1 AND status = 'pending' AND next_review_at <= NOW()`,
        [userId]
      ),
      queryPlannerDb<{ lesson_key: string; score_percent: number; created_at: string }>(
        `SELECT lesson_key, score_percent, created_at FROM quiz_attempts_v2
         WHERE learner_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [userId]
      ),
      queryPlannerDb<{ lesson_key: string; time_spent_seconds: number; created_at: string }>(
        `SELECT lesson_key, time_spent_seconds, created_at FROM lesson_engagements
         WHERE learner_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [userId]
      ),
      queryPlannerDb<{ avg_score: number; attempts: number }>(
        `SELECT COALESCE(AVG(score_percent)::float, 0) AS avg_score, COUNT(*)::int AS attempts
         FROM quiz_attempts_v2 WHERE learner_id = $1`,
        [userId]
      ),
      queryPlannerDb<{ id: string; lesson_key: string; subject: string; grade: number; next_review_at: string; score_percent: number; status: string; created_at: string; updated_at: string }>(
        `SELECT id, lesson_key, subject, grade, next_review_at, score_percent, status, created_at, updated_at
         FROM learner_spaced_reviews
         WHERE learner_id = $1 AND status = 'pending' AND next_review_at <= NOW()
         ORDER BY next_review_at ASC LIMIT 10`,
        [userId]
      ),
      queryPlannerDb<{ lesson_key: string; subject: string; grade: number; avg_score: number; attempts: number }>(
        `SELECT lesson_key, subject, grade, AVG(score_percent)::float AS avg_score, COUNT(*)::int AS attempts
         FROM quiz_attempts_v2
         WHERE learner_id = $1
         GROUP BY lesson_key, subject, grade
         HAVING AVG(score_percent) < 75
         ORDER BY avg_score ASC LIMIT 6`,
        [userId]
      ),
      queryPlannerDb<{ total: number }>(
        `SELECT COUNT(*)::int AS total
         FROM message_mentions mm
         JOIN messages m ON m.id = mm.message_id
         JOIN conversation_participants cp ON cp.conversation_id = mm.conversation_id AND cp.user_id = $1
         LEFT JOIN message_receipts mr ON mr.message_id = mm.message_id AND mr.recipient_id = $1
         WHERE mm.mentioned_user_id = $1 AND m.sender_id <> $1 AND mr.read_at IS NULL`,
        [userId]
      ),
      queryPlannerDb<{ total: number }>(
        `SELECT COUNT(*)::int AS total
         FROM assignment_reminder_notifications arn
         JOIN conversation_participants cp ON cp.conversation_id = arn.conversation_id AND cp.user_id = $1
         WHERE arn.user_id = $1 AND arn.read_at IS NULL`,
        [userId]
      ),
    ]);

  const attempts = toNum(quizWeekly.rows[0]?.attempts);
  const avgScore = toNum(quizWeekly.rows[0]?.avg_score);
  const studySecs = toNum(studyWeekly.rows[0]?.total_seconds);
  const dueTotal = toNum(dueCount.rows[0]?.total);
  const unreadM = toNum(unreadMentions.rows[0]?.total);
  const unreadA = toNum(unreadAssignmentReminders.rows[0]?.total);

  const recItems = recommendations.rows.map((r) => ({
    lessonKey: r.lesson_key,
    subject: r.subject,
    grade: toNum(r.grade),
    avgScore: toNum(r.avg_score),
    attempts: toNum(r.attempts),
    reason: toNum(r.avg_score) < 55 ? "Low mastery" : "Needs reinforcement",
  }));

  const highlights: string[] = [];
  if (dueTotal > 0) highlights.push(`${dueTotal} spaced review${dueTotal === 1 ? "" : "s"} due now.`);
  if (recItems.length > 0) highlights.push(`${recItems[0].lessonKey} is flagged for reinforcement.`);
  if (studySecs === 0) highlights.push("No lesson engagement logged this week yet.");
  if (!highlights.length) highlights.push("Steady learning momentum this week.");

  return {
    role: "learner",
    week,
    cards: [
      { id: "study-time", title: "Study time", value: formatMinutes(studySecs), detail: "Tracked lesson engagement this week.", tone: studySecs > 0 ? "good" : "info", href: "/learn" },
      { id: "average-score", title: "Average quiz score", value: `${avgScore.toFixed(1)}%`, detail: `${attempts} attempt${attempts === 1 ? "" : "s"} this week.`, tone: avgScore >= 70 ? "good" : avgScore >= 55 ? "info" : "warn", href: "/dashboard/progress" },
      { id: "due-reviews", title: "Due reviews", value: String(dueTotal), detail: "Pending spaced repetition reviews.", tone: dueTotal > 0 ? "warn" : "good", href: "/dashboard/progress" },
      { id: "reinforcement", title: "Reinforcement queue", value: String(recItems.length), detail: "Low-mastery lessons needing follow-up.", tone: recItems.length > 0 ? "info" : "neutral", href: "/dashboard/progress" },
      { id: "mentions", title: "Unread mentions", value: String(unreadM), detail: "New mentions in your conversations.", tone: unreadM > 0 ? "info" : "neutral", href: "/messages" },
      { id: "assignment-reminders", title: "Unread assignment reminders", value: String(unreadA), detail: "Pending reminder notifications.", tone: unreadA > 0 ? "warn" : "neutral", href: "/messages" },
    ],
    highlights,
    quickActions: [
      { id: "continue-learning", label: "Continue learning", href: "/learn" },
      { id: "open-messages", label: "Open message hub", href: "/messages" },
      { id: "find-tutor", label: "Find a tutor", href: "/tutors" },
    ],
    meta: { unreadMentions: unreadM, unreadAssignmentReminders: unreadA },
    activity: {
      dueReviews: dueReviews.rows,
      recommendations: recItems,
      scores: scoresAll.rows,
      engagement: engagementAll.rows,
    },
  };
}

// ─── Tutor dashboard ──────────────────────────────────────────────────────────

async function buildTutorDashboard(
  userId: string,
  week: DashboardSummary["week"]
): Promise<DashboardSummary> {
  const COMMISSION_RATE = Number(process.env.TUTOR_COMMISSION_RATE ?? 0.15);

  const [tutorResult, sessionsResult, unreadMentions, unreadAssignmentReminders] = await Promise.all([
    queryPlannerDb<{ id: string; rating_avg: number | null; rating_count: number }>(
      "SELECT id, rating_avg, rating_count FROM tutors WHERE user_id = $1",
      [userId]
    ),
    queryPlannerDb<{ id: string; tutor_id: string; tutor_user_id: string; learner_id: string; start_time: string; end_time: string; scheduled_start_at: string | null; scheduled_end_at: string | null; price: string; status: string; completed_at: string | null }>(
      `SELECT s.id, s.tutor_id, t.user_id AS tutor_user_id, s.learner_id, s.start_time, s.end_time,
              s.scheduled_start_at, s.scheduled_end_at, s.price, s.status, s.completed_at
       FROM tutor_sessions s JOIN tutors t ON t.id = s.tutor_id
       WHERE s.learner_id = $1 OR t.user_id = $1
       ORDER BY s.start_time DESC`,
      [userId]
    ),
    queryPlannerDb<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM message_mentions mm
       JOIN messages m ON m.id = mm.message_id
       JOIN conversation_participants cp ON cp.conversation_id = mm.conversation_id AND cp.user_id = $1
       LEFT JOIN message_receipts mr ON mr.message_id = mm.message_id AND mr.recipient_id = $1
       WHERE mm.mentioned_user_id = $1 AND m.sender_id <> $1 AND mr.read_at IS NULL`,
      [userId]
    ),
    queryPlannerDb<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM assignment_reminder_notifications arn
       JOIN conversation_participants cp ON cp.conversation_id = arn.conversation_id AND cp.user_id = $1
       WHERE arn.user_id = $1 AND arn.read_at IS NULL`,
      [userId]
    ),
  ]);

  const tutor = tutorResult.rows[0] ?? null;
  const unreadM = toNum(unreadMentions.rows[0]?.total);
  const unreadA = toNum(unreadAssignmentReminders.rows[0]?.total);

  if (!tutor) {
    return {
      role: "tutor",
      week,
      cards: [
        { id: "tutor-onboarding", title: "Tutor onboarding", value: "Incomplete", detail: "Complete your tutor profile to unlock tutor metrics.", tone: "warn", href: "/tutors/onboarding" },
        { id: "mentions", title: "Unread mentions", value: String(unreadM), detail: "New mentions in your conversations.", tone: unreadM > 0 ? "info" : "neutral", href: "/messages" },
      ],
      highlights: ["Finish tutor onboarding to activate session and payout tracking."],
      quickActions: [
        { id: "finish-onboarding", label: "Finish tutor onboarding", href: "/tutors/onboarding" },
        { id: "open-messages", label: "Open message hub", href: "/messages" },
      ],
      meta: { unreadMentions: unreadM, unreadAssignmentReminders: unreadA },
      activity: {},
    };
  }

  const now = new Date();
  const tutorSessions = sessionsResult.rows.filter((s) => s.tutor_user_id === userId);
  const pending = tutorSessions.filter((s) => s.status === "requested");
  const upcoming = tutorSessions.filter((s) => {
    if (!["requested", "confirmed"].includes(s.status)) return false;
    const start = s.scheduled_start_at ? new Date(s.scheduled_start_at) : new Date(s.start_time);
    return start >= now;
  });
  const completedThisWeek = tutorSessions.filter((s) => {
    if (s.status !== "completed" || !s.completed_at) return false;
    const d = new Date(s.completed_at);
    return d >= new Date(week.startsAt) && d < new Date(week.endsAt);
  }).length;

  const [weeklyPayout, pendingPayout] = await Promise.all([
    queryPlannerDb<{ total: string }>(
      `SELECT COALESCE(SUM(price), 0)::text AS total FROM tutor_sessions
       WHERE tutor_id = $1 AND status = 'completed' AND completed_at >= NOW() - INTERVAL '7 days'`,
      [tutor.id]
    ),
    queryPlannerDb<{ total: string }>(
      `SELECT COALESCE(SUM(price), 0)::text AS total FROM tutor_sessions
       WHERE tutor_id = $1 AND status = 'completed' AND paid_out_at IS NULL`,
      [tutor.id]
    ),
  ]);

  const weeklyEarnings = Number((Number(weeklyPayout.rows[0]?.total ?? 0) * (1 - COMMISSION_RATE)).toFixed(2));

  const highlights: string[] = [];
  if (pending.length > 0) highlights.push(`${pending.length} session request${pending.length === 1 ? "" : "s"} awaiting your response.`);
  if (upcoming.length > 0) highlights.push(`${upcoming.length} upcoming session${upcoming.length === 1 ? "" : "s"} in your queue.`);
  if (!highlights.length) highlights.push("No pending tutor actions right now.");

  return {
    role: "tutor",
    week,
    cards: [
      { id: "pending-requests", title: "Pending requests", value: String(pending.length), detail: "Requested sessions awaiting confirmation.", tone: pending.length > 0 ? "warn" : "good", href: "/tutors/dashboard" },
      { id: "upcoming-sessions", title: "Upcoming sessions", value: String(upcoming.length), detail: "Requested and confirmed sessions ahead.", tone: upcoming.length > 0 ? "info" : "neutral", href: "/tutors/dashboard" },
      { id: "weekly-completions", title: "Completed this week", value: String(completedThisWeek), detail: "Sessions marked completed this week.", tone: completedThisWeek > 0 ? "good" : "neutral", href: "/tutors/dashboard" },
      { id: "weekly-earnings", title: "Weekly earnings", value: `R${weeklyEarnings.toFixed(2)}`, detail: "Net earnings estimate after commission.", tone: weeklyEarnings > 0 ? "good" : "neutral", href: "/tutors/dashboard" },
      { id: "avg-rating", title: "Average rating", value: tutor.rating_avg !== null ? Number(tutor.rating_avg).toFixed(2) : "N/A", detail: `${toNum(tutor.rating_count)} rating${toNum(tutor.rating_count) === 1 ? "" : "s"} received.`, tone: tutor.rating_avg !== null && Number(tutor.rating_avg) >= 4 ? "good" : "neutral", href: "/tutors/dashboard" },
      { id: "mentions", title: "Unread mentions", value: String(unreadM), detail: "New mentions in your conversations.", tone: unreadM > 0 ? "info" : "neutral", href: "/messages" },
    ],
    highlights,
    quickActions: [
      { id: "open-tutor-dashboard", label: "Open tutor dashboard", href: "/tutors/dashboard" },
      { id: "open-messages", label: "Open message hub", href: "/messages" },
      { id: "open-marketplace", label: "Tutor marketplace", href: "/tutors" },
    ],
    meta: { unreadMentions: unreadM, unreadAssignmentReminders: unreadA },
    activity: {
      pendingSessions: pending.slice(0, 6).map((s) => ({ id: s.id, startsAt: s.scheduled_start_at ?? s.start_time, endsAt: s.scheduled_end_at ?? s.end_time, status: s.status, price: toNum(s.price) })),
      upcomingSessions: upcoming.slice(0, 6).map((s) => ({ id: s.id, startsAt: s.scheduled_start_at ?? s.start_time, endsAt: s.scheduled_end_at ?? s.end_time, status: s.status, price: toNum(s.price) })),
    },
  };
}

// ─── Admin dashboard ──────────────────────────────────────────────────────────

async function buildAdminDashboard(
  week: DashboardSummary["week"]
): Promise<DashboardSummary> {
  const [scores, engagement, weeklyQuiz, weeklyEngagement, newUsers, openDisputes, messagesThisWeek] =
    await Promise.all([
      queryPlannerDb<{ subject: string; grade: number; avg_score: number; attempts: number }>(
        `SELECT subject, grade, AVG(score_percent)::float AS avg_score, COUNT(*)::int AS attempts
         FROM quiz_attempts_v2 GROUP BY subject, grade ORDER BY grade, subject`
      ),
      queryPlannerDb<{ lesson_key: string; opens: number; avg_time: number }>(
        `SELECT lesson_key, COUNT(*)::int AS opens, AVG(time_spent_seconds)::float AS avg_time
         FROM lesson_engagements GROUP BY lesson_key ORDER BY opens DESC LIMIT 50`
      ),
      queryPlannerDb<{ attempts: number; avg_score: number }>(
        `SELECT COUNT(*)::int AS attempts, COALESCE(AVG(score_percent)::float, 0) AS avg_score
         FROM quiz_attempts_v2 WHERE created_at >= $1 AND created_at < $2`,
        [week.startsAt, week.endsAt]
      ),
      queryPlannerDb<{ opens: number; total_seconds: number }>(
        `SELECT COUNT(*)::int AS opens, COALESCE(SUM(time_spent_seconds), 0)::int AS total_seconds
         FROM lesson_engagements WHERE created_at >= $1 AND created_at < $2`,
        [week.startsAt, week.endsAt]
      ),
      queryPlannerDb<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM users WHERE created_at >= $1 AND created_at < $2`,
        [week.startsAt, week.endsAt]
      ),
      queryPlannerDb<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM disputes WHERE status IN ('open', 'under_review')`
      ),
      queryPlannerDb<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM messages WHERE created_at >= $1 AND created_at < $2`,
        [week.startsAt, week.endsAt]
      ),
    ]);

  const weeklyAttempts = toNum(weeklyQuiz.rows[0]?.attempts);
  const weeklyAvgScore = toNum(weeklyQuiz.rows[0]?.avg_score);
  const weeklyOpens = toNum(weeklyEngagement.rows[0]?.opens);
  const weeklyStudySecs = toNum(weeklyEngagement.rows[0]?.total_seconds);
  const weeklyNewUsers = toNum(newUsers.rows[0]?.total);
  const openDisputesCount = toNum(openDisputes.rows[0]?.total);
  const weeklyMessages = toNum(messagesThisWeek.rows[0]?.total);

  const topSubjects = [...scores.rows]
    .sort((a, b) => toNum(b.attempts) - toNum(a.attempts))
    .slice(0, 6)
    .map((r) => ({ subject: r.subject, grade: toNum(r.grade), avgScore: toNum(r.avg_score), attempts: toNum(r.attempts) }));

  const topLessons = engagement.rows.slice(0, 6).map((r) => ({
    lessonKey: r.lesson_key,
    opens: toNum(r.opens),
    avgTimeSeconds: toNum(r.avg_time),
  }));

  const highlights: string[] = [];
  if (openDisputesCount > 0) highlights.push(`${openDisputesCount} tutor dispute${openDisputesCount === 1 ? "" : "s"} currently open.`);
  if (topLessons[0]) highlights.push(`${topLessons[0].lessonKey} is the most-opened lesson in analytics.`);
  if (!highlights.length) highlights.push("No high-priority admin alerts this week.");

  return {
    role: "admin",
    week,
    cards: [
      { id: "weekly-quiz-attempts", title: "Quiz attempts (week)", value: String(weeklyAttempts), detail: "Attempts recorded this week platform-wide.", tone: weeklyAttempts > 0 ? "info" : "neutral", href: "/admin/learning-analytics" },
      { id: "weekly-average-score", title: "Average score (week)", value: `${weeklyAvgScore.toFixed(1)}%`, detail: "Average quiz score this week.", tone: weeklyAvgScore >= 70 ? "good" : weeklyAvgScore >= 55 ? "info" : "warn", href: "/admin/learning-analytics" },
      { id: "weekly-engagement", title: "Lesson opens (week)", value: String(weeklyOpens), detail: `${formatMinutes(weeklyStudySecs)} total tracked lesson time.`, tone: weeklyOpens > 0 ? "info" : "neutral", href: "/admin/learning-analytics" },
      { id: "weekly-new-users", title: "New users (week)", value: String(weeklyNewUsers), detail: "Accounts created in this weekly window.", tone: weeklyNewUsers > 0 ? "good" : "neutral", href: "/admin" },
      { id: "open-disputes", title: "Open disputes", value: String(openDisputesCount), detail: "Disputes in open or under-review state.", tone: openDisputesCount > 0 ? "warn" : "good", href: "/admin" },
      { id: "messages-week", title: "Messages (week)", value: String(weeklyMessages), detail: "Messages created this week.", tone: weeklyMessages > 0 ? "info" : "neutral", href: "/messages" },
    ],
    highlights,
    quickActions: [
      { id: "open-admin-analytics", label: "Open learning analytics", href: "/admin/learning-analytics" },
      { id: "open-admin-home", label: "Open admin panel", href: "/admin" },
      { id: "open-messages", label: "Open message hub", href: "/messages" },
    ],
    meta: { unreadMentions: 0, unreadAssignmentReminders: 0 },
    activity: { topSubjects, topLessons },
  };
}

// ─── Cached builder ───────────────────────────────────────────────────────────

async function getDashboardCached(
  payload: JwtPayload,
  refresh: boolean
): Promise<{ summary: DashboardSummary; cached: boolean; generatedAt: string; ttlMs: number }> {
  const nowMs = Date.now();
  pruneCacheEntries(nowMs);
  const cacheKey = `${payload.sub}|${payload.role ?? ""}|${payload.email ?? ""}`;
  const cache = getCache();

  if (!refresh) {
    const existing = cache.get(cacheKey);
    if (existing && existing.expiresAt > nowMs) {
      return { summary: existing.summary, cached: true, generatedAt: existing.generatedAt, ttlMs: Math.max(0, existing.expiresAt - nowMs) };
    }
  }

  const role = normalizeRole(payload);
  const { weekStart, weekEnd } = getWeekBounds();
  const week = {
    startsAt: weekStart.toISOString(),
    endsAt: weekEnd.toISOString(),
    label: (() => {
      const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
      const endInclusive = new Date(weekEnd);
      endInclusive.setUTCDate(weekEnd.getUTCDate() - 1);
      return `${fmt.format(weekStart)} - ${fmt.format(endInclusive)}`;
    })(),
  };

  const summary =
    role === "admin"
      ? await buildAdminDashboard(week)
      : role === "tutor"
      ? await buildTutorDashboard(payload.sub, week)
      : await buildLearnerDashboard(payload.sub, week);

  const generatedAt = new Date().toISOString();
  const expiresAt = nowMs + CACHE_TTL_MS;
  cache.set(cacheKey, { summary, generatedAt, expiresAt });

  return { summary, cached: false, generatedAt, ttlMs: CACHE_TTL_MS };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const refresh = request.nextUrl.searchParams.get("refresh") === "true";
    const result = await getDashboardCached(payload, refresh);

    return NextResponse.json(
      { summary: result.summary, meta: { cached: result.cached, generatedAt: result.generatedAt, ttlMs: result.ttlMs } },
      { headers: { "Cache-Control": "private, no-store, max-age=0", "X-Dashboard-Cache": result.cached ? "hit" : "miss" } }
    );
  } catch (error) {
    console.error("[analytics/dashboard-summary]", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
