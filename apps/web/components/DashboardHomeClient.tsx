"use client";

// Module-level in-memory cache: avoids redundant fetches within a single browser session.
const _summaryCache = new Map<string, { data: unknown; at: number }>();
const SUMMARY_CACHE_MS = 30_000;

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { formatZar } from "@/lib/formatZar";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import DailyQuizCard from "@/components/DailyQuizCard";
import { useSession } from "@/components/SessionProvider";
import { Badge } from "@/components/ui/Badge";
import { buttonClassName } from "@/components/ui/Button";
import { Card, CardAction, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { WidgetErrorBoundary } from "@/components/ui/WidgetErrorBoundary";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { StatCard } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { WeeklyLeaderboard } from "@/components/WeeklyLeaderboard";
import { DailyBriefingCard } from "@/components/DailyBriefingCard";
import { ExamCountdownWidget } from "@/components/ExamCountdownWidget";
import { MoodCheckIn } from "@/components/MoodCheckIn";
import { PomodoroTimer } from "@/components/PomodoroTimer";
import { SpotifyProfileCard } from "@/components/SpotifyProfileCard";
import { MentorMatchCard } from "@/components/MentorMatchCard";
import { QuestsWidget } from "@/components/QuestsWidget";
import { InstitutionalLeaderboard } from "@/components/InstitutionalLeaderboard";
import MessagingDashboardWidget from "@/components/messages/MessagingDashboardWidget";
import { EquationScanner } from "@/components/EquationScanner";
import { ReferralDashboard } from "@/components/ReferralDashboard";
import { LoadsheddingTracker } from "@/components/LoadsheddingTracker";
import { GradeCalculator } from "@/components/GradeCalculator";
import { ReadinessEvidenceCard } from "@/components/ReadinessEvidenceCard";
import { InstitutionInsightCard } from "@/components/InstitutionInsightCard";
import { useMinimalProfile } from "@/components/profile/useMinimalProfile";
import { getCurrentPeriod, type CalendarFormat } from "@/lib/academicPeriod";
import { topbarIdentity } from "@/lib/minimalProfile";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import { derivePhaseFromGrade } from "@/lib/nextBestAction";
import type { AcademicState } from "@/lib/server/userProfileState";

type ScoreRow = { lesson_key: string; score_percent: number; created_at: string };
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
type InteractedUser = {
  userId: string;
  username: string | null;
  name: string;
  messageCount: number;
  lastInteractionAt: string | null;
};
type DashboardCard = {
  id: string;
  title: string;
  value: string;
  detail: string;
};
type DashboardSummary = {
  role: "learner" | "tutor" | "admin";
  cards: DashboardCard[];
  meta: {
    unreadMentions: number;
    unreadAssignmentReminders: number;
  };
  activity: {
    dueReviews?: DueReview[];
    recommendations?: Recommendation[];
    scores?: ScoreRow[];
    upcomingSessions?: TutorSession[];
    pendingSessions?: TutorSession[];
    topSubjects?: AdminSubjectSummary[];
    interactedUsers?: InteractedUser[];
  };
};

type SubjectProgress = {
  label: string;
  progress: number;
  meta: string;
};

type UpcomingItem = {
  title: string;
  date: string;
  badge: "red" | "amber" | "green" | "neutral";
  badgeLabel: string;
  meta: string;
};

type ActivityItem = {
  id: string;
  title: string;
  time: string;
};

type CommandCenterItem = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  tone: "focus" | "review" | "plan" | "support";
};

type DashboardInstitutionContext = {
  id: string;
  name: string;
  shortName: string | null;
  academicPeriodType: CalendarFormat | null;
  faculty: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
};

type DashboardAcademicContext = Pick<
  AcademicState,
  "studyType" | "grade" | "phase" | "selectedSubjects" | "selectedSubjectLabels" | "course" | "faculty" | "modulePlan" | "examDates"
>;

type MemorySummaryItem = {
  concept_key: string;
  concept_label: string;
  module_code: string | null;
  module_label: string;
  qualitative_band: "Needs Review" | "Developing" | "Confident";
  is_new_concept: boolean;
  last_seen_at: string | null;
  last_practiced_at: string | null;
};

type MemorySummary = {
  struggling_concepts: MemorySummaryItem[];
  recent_concepts: MemorySummaryItem[];
  confident_concepts: MemorySummaryItem[];
  new_concepts: MemorySummaryItem[];
  recommended_review: MemorySummaryItem[];
};

type T = ReturnType<typeof useTranslations<"dashboard">>;

function getFirstName(user: Record<string, unknown> | undefined) {
  const firstName = typeof user?.firstName === "string" ? user.firstName.trim() : "";
  if (firstName) return firstName;

  const email = typeof user?.email === "string" ? user.email.trim() : "";
  if (email) return email.split("@")[0] || "";

  return "";
}

function greetingTime() {
  // Pin to South Africa local time so the SSR (UTC) and client render agree.
  // Using the visitor's own timezone here makes the greeting text differ between
  // server and client for most of the day, which triggers React hydration errors.
  let hour = Number(
    new Intl.DateTimeFormat("en-ZA", {
      hour: "numeric",
      hour12: false,
      timeZone: "Africa/Johannesburg",
    }).format(new Date())
  );
  if (hour === 24) hour = 0;
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function safeDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateLabel(date: Date) {
  return {
    day: new Intl.DateTimeFormat("en-ZA", { day: "2-digit" }).format(date),
    month: new Intl.DateTimeFormat("en-ZA", { month: "short" }).format(date).toUpperCase(),
  };
}

function timeAgo(value: string | null | undefined, t: T) {
  const date = safeDate(value);
  if (!date) return t("activityNoTimestamp");

  const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function averageScore(scores: ScoreRow[] | undefined) {
  if (!scores || scores.length === 0) return null;
  const total = scores.reduce((sum, item) => sum + Number(item.score_percent || 0), 0);
  return total / scores.length;
}

function findCardValue(summary: DashboardSummary | null, keywords: string[]) {
  if (!summary) return null;
  const card = summary.cards.find((item) => {
    const haystack = `${item.id} ${item.title}`.toLowerCase();
    return keywords.some((keyword) => haystack.includes(keyword));
  });
  return card?.value ?? null;
}

function deriveSubjectProgress(summary: DashboardSummary | null, t: T): SubjectProgress[] {
  if (!summary) return [];

  if ((summary.activity.topSubjects ?? []).length > 0) {
    return (summary.activity.topSubjects ?? []).slice(0, 5).map((item) => ({
      label: `${item.subject} (${item.grade})`,
      progress: Math.max(0, Math.min(100, Number(item.avgScore || 0))),
      meta: t("subjectAttempts", { count: item.attempts }),
    }));
  }

  const recommendations = summary.activity.recommendations ?? [];
  const grouped = new Map<string, { total: number; count: number; grade: number }>();

  for (const item of recommendations) {
    const key = `${item.subject}|${item.grade}`;
    const current = grouped.get(key) ?? { total: 0, count: 0, grade: item.grade };
    current.total += item.avgScore;
    current.count += 1;
    grouped.set(key, current);
  }

  return Array.from(grouped.entries())
    .slice(0, 5)
    .map(([key, value]) => {
      const [subject, grade] = key.split("|");
      return {
        label: `${subject} (${grade})`,
        progress: Math.max(0, Math.min(100, value.total / Math.max(1, value.count))),
        meta: t("subjectWeakSignals", { count: value.count }),
      };
    });
}

function deriveUpcoming(summary: DashboardSummary | null, t: T): UpcomingItem[] {
  if (!summary) {
    const placeholderDate = new Date();
    placeholderDate.setDate(placeholderDate.getDate() + 2);
    return [
      {
        title: t("upcomingNoEvents"),
        date: placeholderDate.toISOString(),
        badge: "neutral",
        badgeLabel: t("upcomingBadgeUpcoming"),
        meta: t("upcomingNoEventsMeta"),
      },
    ];
  }

  const items: UpcomingItem[] = [];

  for (const review of summary.activity.dueReviews ?? []) {
    items.push({
      title: t("upcomingSubjectReview", { subject: review.subject }),
      date: review.next_review_at,
      badge: "amber",
      badgeLabel: t("upcomingBadgeDue"),
      meta: t("upcomingLessonMeta", { lessonKey: review.lesson_key }),
    });
  }

  for (const session of summary.activity.upcomingSessions ?? []) {
    items.push({
      title: t("upcomingTutorSession", { id: session.id.slice(0, 6) }),
      date: session.startsAt,
      badge: "green",
      badgeLabel: t("upcomingBadgeBooked"),
      meta: `${session.status} | ${formatZar(Number(session.price), { decimals: false })}`,
    });
  }

  for (const session of summary.activity.pendingSessions ?? []) {
    items.push({
      title: t("upcomingPendingSession", { id: session.id.slice(0, 6) }),
      date: session.startsAt,
      badge: "neutral",
      badgeLabel: t("upcomingBadgeUpcoming"),
      meta: `${session.status} | ${formatZar(Number(session.price), { decimals: false })}`,
    });
  }

  const sorted = items
    .filter((item) => safeDate(item.date))
    .sort((left, right) => safeDate(left.date)!.getTime() - safeDate(right.date)!.getTime())
    .slice(0, 5);

  if (sorted.length > 0) return sorted;

  const fallback = new Date();
  fallback.setDate(fallback.getDate() + 3);
  return [
    {
      title: t("upcomingNoEvents"),
      date: fallback.toISOString(),
      badge: "neutral",
      badgeLabel: t("upcomingBadgeUpcoming"),
      meta: t("upcomingNoEventsMeta"),
    },
  ];
}

function deriveActivity(summary: DashboardSummary | null, t: T): ActivityItem[] {
  if (!summary) return [];

  const items: ActivityItem[] = [];

  for (const score of summary.activity.scores ?? []) {
    items.push({
      id: `${score.lesson_key}-${score.created_at}`,
      title: t("activityScored", { score: Number(score.score_percent).toFixed(0), lessonKey: score.lesson_key }),
      time: timeAgo(score.created_at, t),
    });
  }

  for (const user of summary.activity.interactedUsers ?? []) {
    items.push({
      id: user.userId,
      title: user.username
        ? t("activityMessagedUsername", { username: user.username })
        : t("activityMessagedName", { name: user.name }),
      time: timeAgo(user.lastInteractionAt, t),
    });
  }

  return items.slice(0, 5);
}

function progressTone(value: number) {
  if (value >= 80) return "good";
  if (value >= 60) return "warn";
  return "risk";
}

function communityRoomHref(moduleCode: string | null | undefined) {
  if (!moduleCode) return null;
  return `/community/rooms/${encodeURIComponent(moduleCode)}`;
}

function formatGradeSegment(grade: number | null | undefined) {
  if (!Number.isFinite(grade)) return null;
  return `grade-${String(grade).padStart(2, "0")}`;
}

function buildPersonalizedLearningHref(academicState: DashboardAcademicContext | null | undefined) {
  if (!academicState) return "/learn";

  if (academicState.studyType === "school" && academicState.grade !== null) {
    const phase = academicState.phase?.trim().toLowerCase() || derivePhaseFromGrade(academicState.grade);
    const gradeSegment = formatGradeSegment(academicState.grade);
    if (phase && gradeSegment) {
      return `/learn/${phase}/${gradeSegment}`;
    }
  }

  if (academicState.studyType === "university") {
    return "/university/learning";
  }

  return "/learn";
}

function buildLearningDescription(academicState: DashboardAcademicContext | null | undefined, t: T) {
  if (!academicState) {
    return t("learningDescDefault");
  }

  if (academicState.studyType === "school") {
    const labels = academicState.selectedSubjectLabels.slice(0, 3);
    if (labels.length > 0) {
      const subjectList = `${labels.join(", ")}${academicState.selectedSubjectLabels.length > 3 ? t("learningDescAndMore") : ""}`;
      return t("learningDescSchoolSubjects", { subjectList });
    }
    return t("learningDescSchoolFallback");
  }

  const moduleLabels = academicState.modulePlan.slice(0, 2).map((item) => item.code);
  if (moduleLabels.length > 0) {
    const modules = moduleLabels.join(t("learningDescModuleJoiner"));
    const courseFragment = academicState.course ? t("learningDescCourseFragment", { course: academicState.course }) : "";
    return t("learningDescUniversityModules", { modules, courseFragment });
  }
  return t("learningDescUniversityFallback");
}

function buildCommunityDescription(academicState: DashboardAcademicContext | null | undefined, t: T) {
  if (!academicState) return t("communityDescDefault");
  if (academicState.studyType === "school") {
    return academicState.selectedSubjectLabels.length > 0
      ? t("communityDescSchoolSubjects", { subject: academicState.selectedSubjectLabels[0] })
      : t("communityDescSchoolFallback");
  }
  return academicState.modulePlan.length > 0
    ? t("communityDescUniversityModules", { modules: academicState.modulePlan.slice(0, 2).map((item) => item.code).join(t("learningDescModuleJoiner")) })
    : t("communityDescUniversityFallback");
}

function buildCommandCenterItems(
  summary: DashboardSummary | null,
  memorySummary: MemorySummary | null,
  academicState: DashboardAcademicContext | null | undefined,
  t: T
): CommandCenterItem[] {
  const reviewCount = memorySummary?.recommended_review.length ?? 0;
  const dueCount = (summary?.activity.dueReviews?.length ?? 0) + (summary?.meta.unreadAssignmentReminders ?? 0);
  const lowMomentumSubject = deriveSubjectProgress(summary, t)[0];

  const learningHref = buildPersonalizedLearningHref(academicState);

  return [
    {
      id: "past-papers",
      eyebrow: t("cmdPastPapersEyebrow"),
      title: t("cmdPastPapersTitle"),
      description:
        reviewCount > 0
          ? t("cmdPastPapersDescReview", { count: reviewCount })
          : t("cmdPastPapersDescDefault"),
      href: "/past-papers",
      cta: t("cmdPastPapersCta"),
      tone: "focus",
    },
    {
      id: "memory",
      eyebrow: t("cmdMemoryEyebrow"),
      title: reviewCount > 0 ? t("cmdMemoryTitleResume") : t("cmdMemoryTitleOpen"),
      description:
        reviewCount > 0
          ? t("cmdMemoryDescReview", { count: reviewCount })
          : buildLearningDescription(academicState, t),
      href: reviewCount > 0 ? "/profile/learning" : learningHref,
      cta: reviewCount > 0 ? t("cmdMemoryCtaReview") : t("cmdMemoryCtaOpen"),
      tone: "review",
    },
    {
      id: "planner",
      eyebrow: t("cmdPlannerEyebrow"),
      title: dueCount > 0 ? t("cmdPlannerTitleStabilise") : t("cmdPlannerTitleSet"),
      description:
        dueCount > 0
          ? t("cmdPlannerDescDue", { count: dueCount })
          : t("cmdPlannerDescDefault"),
      href: "/planner",
      cta: t("cmdPlannerCta"),
      tone: "plan",
    },
    {
      id: "support",
      eyebrow: t("cmdSupportEyebrow"),
      title: t("cmdSupportTitle"),
      description: buildCommunityDescription(academicState, t),
      href: academicState?.studyType === "university" ? learningHref : "/community",
      cta: t("cmdSupportCta"),
      tone: "support",
    },
  ];
}

function findUniversityModuleHref(
  academicState: DashboardAcademicContext | null | undefined,
  moduleCode: string
) {
  if (academicState?.studyType !== "university") return null;
  const match = academicState.modulePlan.find((module) => module.code.toUpperCase() === moduleCode.toUpperCase());
  return match ? `/university/modules/${moduleCode.toLowerCase()}` : null;
}

export default function DashboardHomeClient({
  institutionContext = null,
  academicState = null,
}: {
  institutionContext?: DashboardInstitutionContext | null;
  academicState?: DashboardAcademicContext | null;
}) {
  const t = useTranslations("dashboard");
  const { session } = useSession();
  const { profile } = useMinimalProfile();
  const user = (session?.user ?? null) as Record<string, unknown> | null;
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [memorySummary, setMemorySummary] = useState<MemorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summaryRetryNonce, setSummaryRetryNonce] = useState(0);

  useEffect(() => {
    let active = true;

    if (!session) {
      setSummary(null);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    const run = async () => {
      const cacheKey = session.user.id;
      const cached = _summaryCache.get(cacheKey);
      if (cached && Date.now() - cached.at < SUMMARY_CACHE_MS) {
        if (active) {
          setSummary((cached.data as { summary?: DashboardSummary }).summary ?? null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/analytics/dashboard-summary`, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Unable to load dashboard summary.");
        }

        const data = (await response.json()) as { summary?: DashboardSummary };
        _summaryCache.set(cacheKey, { data, at: Date.now() });
        if (active) {
          setSummary(data.summary ?? null);
        }
      } catch (fetchError) {
        if (active) {
          setSummary(null);
          setError(getApiErrorMessage(fetchError, "Unable to load dashboard summary."));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [session, summaryRetryNonce]);

  useEffect(() => {
    let active = true;

    if (!session) {
      setMemorySummary(null);
      return () => {
        active = false;
      };
    }

    const run = async () => {
      try {
        const response = await fetch("/api/memory/summary", {
          credentials: "include",
          cache: "no-store",
        });
        const data = (await response.json().catch(() => null)) as MemorySummary | null;
        if (!response.ok) {
          if (active) setMemorySummary(null);
          return;
        }
        if (active) {
          setMemorySummary(data);
        }
      } catch {
        if (active) {
          setMemorySummary(null);
        }
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [session]);

  const signedIn = Boolean(session);
  const identity = topbarIdentity({ profile, sessionFirstName: getFirstName(user ?? undefined) });
  const firstName = identity.greetingName || "";
  const average = averageScore(summary?.activity.scores);
  const dueCount = summary
    ? (summary.activity.dueReviews?.length ?? 0) + (summary.meta.unreadAssignmentReminders ?? 0)
    : null;
  const aiSessionsValue = findCardValue(summary, ["session", "ai"]);
  const creditsValue = findCardValue(summary, ["credit", "wallet"]);
  const subjectProgress = useMemo(() => deriveSubjectProgress(summary, t), [summary, t]);
  const upcoming = useMemo(() => deriveUpcoming(summary, t), [summary, t]);
  const recentActivity = useMemo(() => deriveActivity(summary, t), [summary, t]);
  const currentInstitutionPeriod = useMemo(
    () => getCurrentPeriod(institutionContext?.academicPeriodType ?? "term"),
    [institutionContext?.academicPeriodType]
  );
  const commandCenterItems = useMemo(
    () => buildCommandCenterItems(summary, memorySummary, academicState, t),
    [summary, memorySummary, academicState, t]
  );
  const personalizedLearningHref = useMemo(() => buildPersonalizedLearningHref(academicState), [academicState]);
  const personalizedLearningDescription = useMemo(() => buildLearningDescription(academicState, t), [academicState, t]);
  const personalizedCommunityDescription = useMemo(() => buildCommunityDescription(academicState, t), [academicState, t]);
  const econ211Href = useMemo(() => findUniversityModuleHref(academicState, "ECON211"), [academicState]);
  const ekip212Href = useMemo(() => findUniversityModuleHref(academicState, "EKIP212"), [academicState]);
  const dashboardStyle = useMemo(
    () =>
      ({
        "--institution-primary": institutionContext?.primaryColor ?? "var(--gold)",
        "--institution-secondary": institutionContext?.secondaryColor ?? "var(--navy)",
      }) as CSSProperties,
    [institutionContext?.primaryColor, institutionContext?.secondaryColor]
  );

  const stats = [
    {
      icon: <span className="font-mono">AVG</span>,
      label: t("statOverallAverage"),
      value: average !== null ? `${Math.round(average)}%` : findCardValue(summary, ["average", "avg"]) ?? "-",
      delta: summary?.activity.scores?.length ? t("statScoresCount", { count: summary.activity.scores.length }) : undefined,
      deltaType: average !== null && average >= 60 ? "up" : "warn",
    },
    {
      icon: <span className="font-mono">AI</span>,
      label: t("statAiSessions"),
      value: aiSessionsValue ?? "-",
      delta: summary?.role ? summary.role : undefined,
      deltaType: "neutral",
    },
    {
      icon: <span className="font-mono">DUE</span>,
      label: t("statDueThisWeek"),
      value: dueCount !== null ? String(dueCount) : "-",
      delta: summary?.meta.unreadAssignmentReminders ? t("statRemindersCount", { count: summary.meta.unreadAssignmentReminders }) : undefined,
      deltaType: dueCount && dueCount > 0 ? "warn" : "neutral",
    },
    {
      icon: <span className="font-mono">R</span>,
      label: t("statCreditsEarned"),
      value: creditsValue ?? "-",
      delta: summary?.meta.unreadMentions ? t("statMentionsCount", { count: summary.meta.unreadMentions }) : undefined,
      deltaType: "neutral",
    },
  ] as const;

  return (
    <div className="dashboard-page" style={dashboardStyle} data-testid="dashboard-open">
      <header className="dashboard-header">
        <div
          className="animate-fade-up"
          style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-4)", flexWrap: "wrap" }}
        >
          {loading ? (
            <Skeleton style={{ width: "88px", height: "88px", borderRadius: "24px" }} />
          ) : (
            <SchoolLogo size={88} />
          )}
          <div className="dashboard-header-copy animate-fade-up">
          <span className="eyebrow">TODAY · {t("studentCommandCenter")}</span>
          <h1 className="dashboard-title">
            {loading ? (
              <Skeleton style={{ width: "240px", height: "40px" }} />
            ) : (
              <>
                {firstName ? (
                  <>
                    {t("greeting", { time: greetingTime() })}{" "}
                    <span className="dashboard-title-accent" style={{ color: "var(--institution-primary)" }}>
                      {firstName}.
                    </span>
                  </>
                ) : (
                  <>Good {greetingTime()}.</>
                )}
              </>
            )}
          </h1>
          <div className="dashboard-intro">
            {loading ? (
              <Skeleton style={{ width: "100%", height: "20px", marginBottom: "8px" }} />
            ) : (
              t("introCopy")
            )}
          </div>
          {academicState?.studyType ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
              <span className="ui-badge ui-badge--gold">
                {academicState.studyType === "school"
                  ? (academicState.grade !== null
                      ? t("schoolProfileGrade", { grade: academicState.grade === 0 ? "R" : String(academicState.grade) })
                      : t("schoolProfile"))
                  : (academicState.course
                      ? t("universityProfileCourse", { course: academicState.course })
                      : t("universityProfile"))}
              </span>
              {academicState.selectedSubjectLabels.slice(0, 3).map((label) => (
                <span key={label} className="ui-badge ui-badge--neutral">{label}</span>
              ))}
              {academicState.modulePlan.slice(0, 2).map((module) => (
                <span key={module.code} className="ui-badge ui-badge--neutral">{module.code}</span>
              ))}
            </div>
          ) : null}
          {institutionContext?.name ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "6px 12px",
                  borderRadius: "999px",
                  border: "1px solid color-mix(in srgb, var(--institution-primary) 35%, var(--border))",
                  background: "color-mix(in srgb, var(--institution-primary) 12%, transparent)",
                  color: "var(--text-1)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                }}
              >
                {institutionContext.shortName || institutionContext.name}
              </span>
              {institutionContext.faculty ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 12px",
                    borderRadius: "999px",
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    color: "var(--text-2)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                  }}
                >
                  {institutionContext.faculty}
                </span>
              ) : null}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "6px 12px",
                  borderRadius: "999px",
                  border: "1px solid color-mix(in srgb, var(--institution-primary) 35%, var(--border))",
                  background: "color-mix(in srgb, var(--institution-primary) 10%, var(--surface-2))",
                  color: "var(--institution-primary)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                }}
              >
                {currentInstitutionPeriod.label}
              </span>
            </div>
          ) : null}
          </div>
        </div>
        <Link className={buttonClassName({ variant: "outline", size: "sm" })} href="/dashboard/progress" prefetch={false}>
          {t("viewFullReport")}
        </Link>
      </header>

      {error ? (
        <div className="assistant-error" role="alert" aria-live="polite">
          <span>{error}</span>
          <button
            type="button"
            className={buttonClassName({ variant: "outline", size: "sm" })}
            onClick={() => setSummaryRetryNonce((value) => value + 1)}
            disabled={loading}
          >
            {loading ? "Retrying…" : "Retry dashboard sync"}
          </button>
        </div>
      ) : null}

      {signedIn ? (
        <div style={{ margin: "24px 0" }}>
          <WidgetErrorBoundary>
            <DailyBriefingCard />
          </WidgetErrorBoundary>
        </div>
      ) : null}

      <div style={{ margin: "24px 0" }}>
        <ExamCountdownWidget exams={academicState?.examDates} enabled={signedIn} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px", margin: "24px 0" }}>
        <WidgetErrorBoundary>
          <MoodCheckIn />
          <PomodoroTimer />
          <LoadsheddingTracker />
          <GradeCalculator />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary>
          {signedIn ? (
            <>
              <QuestsWidget />
              <MessagingDashboardWidget role={summary?.role ?? "learner"} />
            </>
          ) : (
            <Card>
              <CardHeader>
                <span className="eyebrow">{t("guestCtaEyebrow")}</span>
                <CardTitle><span className="dashboard-title-accent">{t("guestCtaTitle")}</span></CardTitle>
              </CardHeader>
              <CardBody>
                <p className="dashboard-intro" style={{ marginTop: 0 }}>{t("guestCtaCopy")}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
                  <Link className={buttonClassName({ variant: "gold" })} href="/learn" prefetch={false}>
                    Continue without an account
                  </Link>
                  <Link className={buttonClassName({ variant: "outline" })} href="/login" prefetch={false}>
                    {t("guestCtaSecondary")}
                  </Link>
                  <Link className={buttonClassName({ variant: "outline" })} href="/signup" prefetch={false}>
                    {t("guestCtaButton")}
                  </Link>
                </div>
              </CardBody>
            </Card>
          )}
        </WidgetErrorBoundary>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px", margin: "24px 0" }}>
        <WidgetErrorBoundary>
          {signedIn ? (
            <>
              <MentorMatchCard />
              <ReferralDashboard />
              <SpotifyProfileCard />
            </>
          ) : null}
        </WidgetErrorBoundary>
      </div>

      <div style={{ margin: "24px 0" }}>
        <WidgetErrorBoundary>
          {signedIn ? <InstitutionalLeaderboard /> : null}
        </WidgetErrorBoundary>
      </div>

      <div style={{ margin: "24px 0" }}>
        <WidgetErrorBoundary>
          {signedIn ? <InstitutionInsightCard /> : null}
        </WidgetErrorBoundary>
      </div>

      <div style={{ margin: "24px 0" }}>
        <WidgetErrorBoundary>
          <EquationScanner />
        </WidgetErrorBoundary>
      </div>

      {signedIn ? <DailyQuizCard /> : null}

      <section className="dashboard-stats">
        {stats.map((stat, index) => (
          <StatCard
            key={stat.label}
            icon={stat.icon}
            label={stat.label}
            value={loading ? "-" : stat.value}
            delta={loading ? undefined : stat.delta}
            deltaType={stat.deltaType}
            animationDelay={index * 70}
          />
        ))}
      </section>

      {signedIn ? (
        <ReadinessEvidenceCard
          scores={summary?.activity.scores}
          dueReviews={summary?.activity.dueReviews}
          recommendations={summary?.activity.recommendations}
        />
      ) : null}

      <div style={{ margin: "24px 0" }}>
        <WidgetErrorBoundary>
          <WeeklyLeaderboard enabled={signedIn} />
        </WidgetErrorBoundary>
      </div>

      <section className="command-center-grid">
        {commandCenterItems.map((item) => (
          <Link className={`command-center-card command-center-card--${item.tone}`} href={item.href} key={item.id} prefetch={false}>
            <span className="command-center-card__eyebrow">{item.eyebrow}</span>
            <strong className="command-center-card__title">{item.title}</strong>
            <p className="command-center-card__description">{item.description}</p>
            <span className="command-center-card__cta">{item.cta} -&gt;</span>
          </Link>
        ))}
      </section>

      {memorySummary &&
      (memorySummary.recent_concepts.length > 0 || memorySummary.recommended_review.length > 0) ? (
        <section className="dashboard-memory-row">
          <Card>
            <CardHeader>
              <CardTitle>{t("whereYouLeftOff")}</CardTitle>
              <CardAction>
                <Link href="/profile/learning" prefetch={false}>
                  {t("yourLearning")}
                </Link>
              </CardAction>
            </CardHeader>
            <CardBody>
              {memorySummary.recent_concepts.length === 0 ? (
                <div className="empty-state">{t("recentConceptsEmpty")}</div>
              ) : (
                <div className="dashboard-memory-list">
                  {memorySummary.recent_concepts.map((item) => (
                    <div className="dashboard-memory-item" key={`recent-${item.concept_key}`}>
                      <strong>{item.concept_label}</strong>
                      <span>{item.module_label}</span>
                      {communityRoomHref(item.module_code) ? (
                        <Link className="dashboard-memory-link" href={communityRoomHref(item.module_code)!} prefetch={false}>
                          {t("openRoom")}
                        </Link>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("topicsToRevisit")}</CardTitle>
              <CardAction>
                <Link href="/tutor" prefetch={false}>
                  {t("openAiTutor")}
                </Link>
              </CardAction>
            </CardHeader>
            <CardBody>
              {memorySummary.recommended_review.length === 0 ? (
                <div className="empty-state">{t("noReviewCues")}</div>
              ) : (
                <div className="dashboard-memory-list">
                  {memorySummary.recommended_review.map((item) => (
                    <div className="dashboard-memory-item" key={`review-${item.concept_key}`}>
                      <strong>{item.concept_label}</strong>
                      <span>{item.module_label}</span>
                      {communityRoomHref(item.module_code) ? (
                        <Link className="dashboard-memory-link" href={communityRoomHref(item.module_code)!} prefetch={false}>
                          {t("openRoom")}
                        </Link>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </section>
      ) : null}

      <section className="dashboard-content">
        <div className="dashboard-main-column">
          <Link className="assistant-launch-card animate-fade-up" href="/tutor" prefetch={false}>
            <span className="assistant-launch-card__eyebrow">{t("aiStudyCoachEyebrow")}</span>
            <h2 className="assistant-launch-card__title">
              {(t.rich("aiStudyCoachTitle", {
                em: (chunks) => <em>{(chunks as unknown) as ReactNode}</em>,
              }) as unknown) as ReactNode}
            </h2>
            <p className="assistant-launch-card__copy">
              {t("aiStudyCoachCopy")}
            </p>
            <div className="assistant-launch-input">
              <span>{t("aiStudyCoachPlaceholder")}</span>
              <span className="assistant-launch-send" aria-hidden="true">
                -&gt;
              </span>
            </div>
            <div className="assistant-mode-row">
              <Badge variant="gold">{t("badgeExplain")}</Badge>
              <Badge variant="neutral">{t("badgeSummarise")}</Badge>
              <Badge variant="neutral">{t("badgeQuizMe")}</Badge>
            </div>
          </Link>

          <Card>
            <CardHeader>
              <CardTitle>{t("subjectProgressTitle")}</CardTitle>
              <CardAction>{subjectProgress.length > 0 ? t("subjectProgressTracked", { count: subjectProgress.length }) : t("subjectProgressAwaiting")}</CardAction>
            </CardHeader>
            <CardBody>
              {loading ? (
                <div className="subject-progress-list">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="subject-progress-item">
                      <Skeleton style={{ width: "60%", height: "16px", marginBottom: "8px" }} />
                      <Skeleton style={{ width: "100%", height: "8px" }} />
                    </div>
                  ))}
                </div>
              ) : subjectProgress.length === 0 ? (
                <div className="empty-state">{t("subjectProgressEmpty")}</div>
              ) : (
                <div className="subject-progress-list">
                  {subjectProgress.map((item) => {
                    const tone = progressTone(item.progress);
                    return (
                      <div className="subject-progress-item" key={item.label}>
                        <div className="subject-progress-item__top">
                          <span className="subject-progress-item__label">{item.label}</span>
                          <span className="subject-progress-item__meta">{Math.round(item.progress)}% - {item.meta}</span>
                        </div>
                        <div className="progress-track">
                          <span className={`progress-fill progress-fill--${tone}`} style={{ width: `${item.progress}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("quickAccessTitle")}</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="quick-access-grid">
                <Link className="quick-access-card" href="/past-papers" prefetch={false}>
                  <strong className="quick-access-card__title">{t("quickAccessPastPaper")}</strong>
                  <span className="quick-access-card__copy">{t("quickAccessPastPaperCopy")}</span>
                </Link>
                {econ211Href ? (
                  <Link className="quick-access-card" href={`${econ211Href}/notes`} prefetch={false}>
                    <strong className="quick-access-card__title">ECON211 notes</strong>
                    <span className="quick-access-card__copy">
                      Jump straight into the chapter notes, flashcards, and revision checkpoints.
                    </span>
                  </Link>
                ) : null}
                {econ211Href ? (
                  <Link className="quick-access-card" href={`${econ211Href}/past-papers`} prefetch={false}>
                    <strong className="quick-access-card__title">ECON211 past papers</strong>
                    <span className="quick-access-card__copy">
                      Jump straight to practice sets and exam prep for ECON211.
                    </span>
                  </Link>
                ) : null}
                {ekip212Href ? (
                  <Link className="quick-access-card" href={ekip212Href} prefetch={false}>
                    <strong className="quick-access-card__title">EKIP212 trade guide</strong>
                    <span className="quick-access-card__copy">
                      Open the curated trade-relations study surface, examples, and schedule.
                    </span>
                  </Link>
                ) : null}
                <Link className="quick-access-card" href={personalizedLearningHref} prefetch={false}>
                  <strong className="quick-access-card__title">{t("quickAccessStudyGuides")}</strong>
                  <span className="quick-access-card__copy">{personalizedLearningDescription}</span>
                </Link>
                <Link className="quick-access-card" href="/tutors" prefetch={false}>
                  <strong className="quick-access-card__title">{t("quickAccessTutorMarketplace")}</strong>
                  <span className="quick-access-card__copy">{t("quickAccessTutorCopy")}</span>
                </Link>
                <Link className="quick-access-card" href="/community" prefetch={false}>
                  <strong className="quick-access-card__title">{t("quickAccessStudentCommunity")}</strong>
                  <span className="quick-access-card__copy">{personalizedCommunityDescription}</span>
                </Link>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="dashboard-side-column">
          <Card>
            <CardHeader>
              <CardTitle>{t("upcomingTitle")}</CardTitle>
              <CardAction>{t("upcomingCount", { count: upcoming.length })}</CardAction>
            </CardHeader>
            <CardBody>
              <div className="upcoming-list">
                {upcoming.map((item) => {
                  const date = safeDate(item.date) ?? new Date();
                  const label = formatDateLabel(date);
                  return (
                    <div className="upcoming-item" key={`${item.title}-${item.date}`}>
                      <div className="upcoming-date">
                        <strong>{label.day}</strong>
                        <span>{label.month}</span>
                      </div>
                      <div className="upcoming-item__copy">
                        <strong className="upcoming-item__title">{item.title}</strong>
                        <div className="dashboard-pill-row">
                          <Badge variant={item.badge}>{item.badgeLabel}</Badge>
                        </div>
                        <span className="upcoming-item__meta">{item.meta}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("recentActivityTitle")}</CardTitle>
              <CardAction>{recentActivity.length > 0 ? t("recentActivityEntries", { count: recentActivity.length }) : t("recentActivityNone")}</CardAction>
            </CardHeader>
            <CardBody>
              {loading ? (
                <div className="recent-activity-list">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="recent-activity-item">
                      <Skeleton style={{ width: "8px", height: "8px", borderRadius: "50%", marginTop: "6px" }} />
                      <div className="recent-activity-copy">
                        <Skeleton style={{ width: "180px", height: "14px", marginBottom: "4px" }} />
                        <Skeleton style={{ width: "60px", height: "10px" }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentActivity.length === 0 ? (
                <div className="empty-state">{t("recentActivityEmpty")}</div>
              ) : (
                <div className="recent-activity-list">
                  {recentActivity.map((item) => (
                    <div className="recent-activity-item" key={item.id}>
                      <span className="activity-dot" aria-hidden="true" />
                      <div className="recent-activity-copy">
                        <span className="recent-activity-title">{item.title}</span>
                        <span className="recent-activity-time">{item.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  );
}
