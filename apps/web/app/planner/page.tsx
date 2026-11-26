import { headers } from "next/headers";
import { redirect } from "next/navigation";
import PlannerCalendar from "@/components/planner/PlannerCalendar";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { getBackendSessionFromCookieHeader } from "@/lib/server/backendSession";
import {
  getStudentUniversityProfile,
  listPlannerUniversities,
  listStudentEnrolledModules,
  listStudentPlannerEvents,
} from "@/lib/server/universityPlanner";
import type { PlannerCalendarDay, PlannerCalendarMonth, StudentPlannerEventRecord } from "@/types/planner";

export const dynamic = "force-dynamic";

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

function addUtcDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function buildPlannerEventMap(events: StudentPlannerEventRecord[]) {
  const byDate = new Map<string, StudentPlannerEventRecord[]>();

  for (const event of events) {
    let current = parseIsoDate(event.eventDate);
    const last = parseIsoDate(event.endDate ?? event.eventDate);

    while (current <= last) {
      const isoDate = toIsoDate(current);
      const currentEvents = byDate.get(isoDate) ?? [];
      currentEvents.push(event);
      byDate.set(isoDate, currentEvents);
      current = addUtcDays(current, 1);
    }
  }

  return byDate;
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function mondayOffset(day: Date) {
  return (day.getUTCDay() + 6) % 7;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-ZA", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function buildCalendarMonths(events: StudentPlannerEventRecord[]): PlannerCalendarMonth[] {
  const byDate = buildPlannerEventMap(events);
  const today = startOfMonth(new Date());
  const firstEventMonth = events.length > 0 ? startOfMonth(parseIsoDate(events[0].eventDate)) : today;
  const lastEventMonth =
    events.length > 0
      ? startOfMonth(
          parseIsoDate(
            events.reduce((latest, event) => {
              const candidate = event.endDate ?? event.eventDate;
              return candidate > latest ? candidate : latest;
            }, events[0].endDate ?? events[0].eventDate)
          )
        )
      : today;

  const months: PlannerCalendarMonth[] = [];
  let cursor = firstEventMonth < today ? firstEventMonth : today;
  const finalMonth = lastEventMonth > today ? lastEventMonth : today;
  const todayIso = toIsoDate(new Date());

  while (cursor <= finalMonth) {
    const monthStart = startOfMonth(cursor);
    const monthEnd = endOfMonth(cursor);
    const gridStart = addUtcDays(monthStart, -mondayOffset(monthStart));
    const gridEnd = addUtcDays(monthEnd, 6 - mondayOffset(monthEnd));

    const weeks: PlannerCalendarDay[][] = [];
    let currentWeek: PlannerCalendarDay[] = [];
    let current = gridStart;

    while (current <= gridEnd) {
      const isoDate = toIsoDate(current);
      const dayEvents = (byDate.get(isoDate) ?? []).sort((left, right) => {
        if (left.eventDate !== right.eventDate) return left.eventDate.localeCompare(right.eventDate);
        if ((left.startTime ?? "") !== (right.startTime ?? "")) return (left.startTime ?? "").localeCompare(right.startTime ?? "");
        return left.title.localeCompare(right.title);
      });

      currentWeek.push({
        isoDate,
        dayLabel: String(current.getUTCDate()),
        isCurrentMonth: current.getUTCMonth() === monthStart.getUTCMonth(),
        isToday: isoDate === todayIso,
        isExamDay: dayEvents.some((event) => event.eventType === "exam"),
        isPublicHoliday: dayEvents.some((event) => event.eventType === "public_holiday"),
        events: dayEvents,
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      current = addUtcDays(current, 1);
    }

    months.push({
      monthLabel: monthLabel(monthStart),
      weeks,
    });

    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }

  if (months.length === 0) {
    return [
      {
        monthLabel: monthLabel(today),
        weeks: [],
      },
    ];
  }

  return months;
}

export default async function PlannerPage() {
  const headerStore = await headers();
  const session = await getBackendSessionFromCookieHeader(headerStore.get("cookie") || "");
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";

  if (!userId) {
    redirect("/auth?next=%2Fplanner");
  }

  const profile = await getStudentUniversityProfile(userId).catch(() => null);
  if (!profile?.onboardingCompleted) {
    redirect("/onboarding/university");
  }

  const [events, modules, universities] = await Promise.all([
    listStudentPlannerEvents(userId).catch(() => []),
    listStudentEnrolledModules(userId).catch(() => []),
    listPlannerUniversities().catch(() => []),
  ]);

  const universityName = universities.find((entry) => entry.id === profile.universityId)?.name ?? null;
  const months = buildCalendarMonths(events);

  return (
    <main style={{ padding: "24px 16px 56px", display: "grid", gap: "20px" }}>
      <RouteHeader
        eyebrow="Planner Excellence"
        title="Your academic rhythm, on one surface."
        description={`${universityName ? `${universityName} calendar context is active.` : "University calendar context is active."} Track exams, deadlines, and module pressure before the week drifts.`}
      />
      <PlannerCalendar
        months={months}
        events={events}
        moduleCount={modules.length}
        universityName={universityName}
      />
    </main>
  );
}
