"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getCalendarFreshness, type CalendarFreshness } from "@/app/actions/get-calendar-freshness";
import { scrapeModuleTimetable } from "@/app/actions/scrape-module-timetable";
import { Button } from "@/components/ui/Button";
import { PENDING_TIMETABLE_SYNC_STORAGE_KEY, type PendingTimetableSyncPayload } from "@/lib/plannerSync";
import type { PlannerCalendarDay, PlannerCalendarMonth, StudentPlannerEventRecord } from "@/types/planner";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const FRESHNESS_DISMISSAL_DAYS = 30;

const TIER_ACCENTS: Record<StudentPlannerEventRecord["tier"], string> = {
  tier1: "#60a5fa",
  tier2: "#34d399",
  tier3: "#f0d27a",
  manual: "#94a3b8",
};

type PlannerCalendarProps = {
  months: PlannerCalendarMonth[];
  events: StudentPlannerEventRecord[];
  moduleCount: number;
  universityName: string | null;
};

function formatLongDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

function formatEventTime(event: StudentPlannerEventRecord) {
  if (!event.startTime) return "All day";
  if (!event.endTime) return event.startTime.slice(0, 5);
  return `${event.startTime.slice(0, 5)} - ${event.endTime.slice(0, 5)}`;
}

function buildInitialMonthIndex(months: PlannerCalendarMonth[]) {
  const today = new Date().toISOString().slice(0, 10);
  const withToday = months.findIndex((month) => month.weeks.some((week) => week.some((day) => day.isoDate === today)));
  if (withToday >= 0) return withToday;
  return 0;
}

function buildInitialSelectedDay(months: PlannerCalendarMonth[]) {
  const today = new Date().toISOString().slice(0, 10);
  for (const month of months) {
    for (const week of month.weeks) {
      for (const day of week) {
        if (day.isoDate === today) return today;
      }
    }
  }

  for (const month of months) {
    for (const week of month.weeks) {
      for (const day of week) {
        if (day.events.length > 0) return day.isoDate;
      }
    }
  }

  return months[0]?.weeks[0]?.[0]?.isoDate ?? "";
}

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

function buildExamPeriodMap(periods: CalendarFreshness["examPeriods"]) {
  const byDate = new Map<string, { tooltip: string }>();

  for (const period of periods) {
    const tooltip = period.opportunity
      ? `Exam period - Opportunity ${period.opportunity}`
      : `Exam period - ${period.label}`;
    let cursor = parseIsoDate(period.startDate);
    const last = parseIsoDate(period.endDate);

    while (cursor <= last) {
      byDate.set(toIsoDate(cursor), { tooltip });
      cursor = addUtcDays(cursor, 1);
    }
  }

  return byDate;
}

function buildDayBackground(day: PlannerCalendarDay, hasExamPeriod: boolean) {
  const baseBackground = day.isPublicHoliday
    ? "rgba(255, 255, 255, 0.06)"
    : day.isExamDay
      ? "rgba(239, 68, 68, 0.12)"
      : day.isCurrentMonth
        ? "rgba(255, 255, 255, 0.02)"
        : "rgba(255, 255, 255, 0.01)";

  if (!hasExamPeriod) {
    return baseBackground;
  }

  return `repeating-linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0px, rgba(239, 68, 68, 0.12) 10px, transparent 10px, transparent 20px), ${baseBackground}`;
}

export default function PlannerCalendar({ months, events, moduleCount, universityName }: PlannerCalendarProps) {
  const router = useRouter();
  const [activeMonthIndex, setActiveMonthIndex] = useState(() => buildInitialMonthIndex(months));
  const [selectedDay, setSelectedDay] = useState(() => buildInitialSelectedDay(months));
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [freshness, setFreshness] = useState<CalendarFreshness | null>(null);
  const [freshnessDismissed, setFreshnessDismissed] = useState(false);

  const activeMonth = months[activeMonthIndex] ?? months[0] ?? null;
  const universityId = useMemo(() => events.find((event) => event.universityId)?.universityId ?? null, [events]);
  const examPeriodsByDate = useMemo(
    () => buildExamPeriodMap(freshness?.examPeriods ?? []),
    [freshness?.examPeriods]
  );

  const selectedDayEvents = useMemo(() => {
    if (!activeMonth || !selectedDay) return [] as StudentPlannerEventRecord[];
    const match = activeMonth.weeks.flat().find((day) => day.isoDate === selectedDay);
    return match?.events ?? [];
  }, [activeMonth, selectedDay]);

  useEffect(() => {
    if (!activeMonth) return;
    const existsInActiveMonth = activeMonth.weeks.some((week) => week.some((day) => day.isoDate === selectedDay));
    if (!existsInActiveMonth) {
      const nextSelected =
        activeMonth.weeks.flat().find((day) => day.events.length > 0)?.isoDate ??
        activeMonth.weeks[0]?.[0]?.isoDate ??
        "";
      setSelectedDay(nextSelected);
    }
  }, [activeMonth, selectedDay]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = window.localStorage.getItem(PENDING_TIMETABLE_SYNC_STORAGE_KEY);
    if (!raw) return;

    let pending: PendingTimetableSyncPayload | null = null;
    try {
      pending = JSON.parse(raw) as PendingTimetableSyncPayload;
    } catch {
      window.localStorage.removeItem(PENDING_TIMETABLE_SYNC_STORAGE_KEY);
      return;
    }

    if (!pending || pending.modules.length === 0) {
      window.localStorage.removeItem(PENDING_TIMETABLE_SYNC_STORAGE_KEY);
      return;
    }

    let cancelled = false;
    setSyncState("syncing");
    setSyncMessage("We're loading your class timetable. This takes about 30 seconds.");

    void (async () => {
      const results = await Promise.allSettled(
        pending.modules.map((module) =>
          scrapeModuleTimetable({
            universityId: pending!.universityId,
            campusId: pending!.campusId,
            moduleCode: module.moduleCode,
            semester: module.semester,
            year: pending!.year,
          })
        )
      );

      if (cancelled) return;

      window.localStorage.removeItem(PENDING_TIMETABLE_SYNC_STORAGE_KEY);

      const failures = results.filter(
        (result) => result.status === "rejected" || (result.status === "fulfilled" && !result.value.ok)
      );

      if (failures.length > 0) {
        setSyncState("error");
        setSyncMessage("Some timetable entries could not be loaded. You can retry by re-adding the affected modules.");
      } else {
        setSyncState("done");
        setSyncMessage("Your class timetable is ready.");
      }

      router.refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!universityId) {
      setFreshness(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const data = await getCalendarFreshness(universityId);
        if (!cancelled) {
          setFreshness(data);
        }
      } catch {
        if (!cancelled) {
          setFreshness(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [universityId]);

  useEffect(() => {
    if (typeof window === "undefined" || !freshness?.stale || !freshness.universityId || !freshness.lastVerifiedAt) {
      setFreshnessDismissed(false);
      return;
    }

    const storageKey = `planner_freshness_dismissed_${freshness.universityId}`;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      setFreshnessDismissed(false);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as { dismissedAt?: string; lastVerifiedAt?: string };
      const dismissedAt = parsed.dismissedAt ? Date.parse(parsed.dismissedAt) : Number.NaN;
      const isSameVerification = parsed.lastVerifiedAt === freshness.lastVerifiedAt;
      const isWithinDismissalWindow =
        Number.isFinite(dismissedAt) && Date.now() - dismissedAt < FRESHNESS_DISMISSAL_DAYS * DAY_IN_MS;
      setFreshnessDismissed(Boolean(isSameVerification && isWithinDismissalWindow));
    } catch {
      window.localStorage.removeItem(storageKey);
      setFreshnessDismissed(false);
    }
  }, [freshness]);

  function dismissFreshnessNotice() {
    if (typeof window === "undefined" || !freshness?.universityId || !freshness.lastVerifiedAt) {
      return;
    }

    const storageKey = `planner_freshness_dismissed_${freshness.universityId}`;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        dismissedAt: new Date().toISOString(),
        lastVerifiedAt: freshness.lastVerifiedAt,
      })
    );
    setFreshnessDismissed(true);
  }

  if (events.length === 0 && moduleCount === 0) {
    return (
      <section
        style={{
          display: "grid",
          gap: "18px",
          padding: "28px",
          borderRadius: "var(--r-xl)",
          border: "1px solid var(--border)",
          background: "linear-gradient(160deg, var(--surface) 0%, var(--surface-2) 100%)",
        }}
      >
        <div style={{ display: "grid", gap: "8px" }}>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "32px" }}>Planner</h1>
          <p style={{ margin: 0, color: "var(--text-2)", fontSize: "14px" }}>
            Add your modules to see your class timetable.
          </p>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <Button variant="gold" onClick={() => router.push("/onboarding/university")}>
            Finish onboarding
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section style={{ display: "grid", gap: "20px" }}>
      <div
        style={{
          display: "grid",
          gap: "16px",
          padding: "24px",
          borderRadius: "var(--r-xl)",
          border: "1px solid var(--border)",
          background: "linear-gradient(160deg, var(--surface) 0%, var(--surface-2) 100%)",
          boxShadow: "var(--sh-md)",
        }}
      >
        <div style={{ display: "grid", gap: "8px" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-2)" }}>
            {universityName ?? "University planner"}
          </span>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "34px", lineHeight: 1.1 }}>Planner</h1>
          <p style={{ margin: 0, color: "var(--text-2)", fontSize: "14px", lineHeight: 1.6 }}>
            Tier 1 boundaries, public holidays, exams, and your live class timetable all land here.
          </p>
        </div>

        {(syncState === "syncing" || syncState === "done" || syncState === "error") && syncMessage ? (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "var(--r-md)",
              border:
                syncState === "error"
                  ? "1px solid rgba(239, 68, 68, 0.32)"
                  : syncState === "done"
                    ? "1px solid rgba(16, 185, 129, 0.32)"
                    : "1px solid var(--gold-border)",
              background:
                syncState === "error"
                  ? "var(--red-dim)"
                  : syncState === "done"
                    ? "var(--green-dim)"
                    : "var(--gold-dim)",
              color: syncState === "error" ? "#fecaca" : syncState === "done" ? "#bbf7d0" : "var(--gold)",
              fontSize: "13px",
            }}
          >
            {syncMessage}
          </div>
        ) : null}

        {freshness?.stale && !freshnessDismissed && freshness.daysOld != null ? (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "12px",
              padding: "12px 14px",
              borderRadius: "var(--r-md)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              background: "rgba(245, 158, 11, 0.1)",
              color: "#fcd34d",
              fontSize: "13px",
            }}
          >
            <div style={{ display: "grid", gap: "4px" }}>
              <span>⚠ Calendar data was last verified {freshness.daysOld} days ago. Dates may have changed.</span>
              {freshness.calendarUrl ? (
                <a
                  href={freshness.calendarUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "inherit", textDecoration: "underline" }}
                >
                  Check university website →
                </a>
              ) : null}
            </div>
            <button
              type="button"
              onClick={dismissFreshnessNotice}
              aria-label="Dismiss calendar freshness notice"
              style={{
                border: "none",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                fontSize: "16px",
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          </div>
        ) : null}

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {[
            { label: "Tier 1", color: TIER_ACCENTS.tier1 },
            { label: "Tier 2", color: TIER_ACCENTS.tier2 },
            { label: "Tier 3", color: TIER_ACCENTS.tier3 },
            { label: "Manual", color: TIER_ACCENTS.manual },
          ].map((item) => (
            <span
              key={item.label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 10px",
                borderRadius: "999px",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid var(--border)",
                fontSize: "12px",
                color: "var(--text-2)",
              }}
            >
              <span
                style={{
                  width: "9px",
                  height: "9px",
                  borderRadius: "999px",
                  background: item.color,
                }}
              />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {months.length > 1 ? (
        <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "4px" }}>
          {months.map((month, index) => (
            <button
              key={month.monthLabel}
              onClick={() => setActiveMonthIndex(index)}
              style={{
                padding: "9px 14px",
                borderRadius: "999px",
                border: index === activeMonthIndex ? "1px solid var(--gold-border)" : "1px solid var(--border)",
                background: index === activeMonthIndex ? "var(--gold-dim)" : "rgba(255, 255, 255, 0.02)",
                color: index === activeMonthIndex ? "var(--gold)" : "var(--text-2)",
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
            >
              {month.monthLabel}
            </button>
          ))}
        </div>
      ) : null}

      {activeMonth ? (
        <div
          style={{
            display: "grid",
            gap: "18px",
            padding: "24px",
            borderRadius: "var(--r-xl)",
            border: "1px solid var(--border)",
            background: "linear-gradient(160deg, var(--surface) 0%, var(--surface-2) 100%)",
          }}
        >
          <div style={{ display: "grid", gap: "12px" }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "28px" }}>{activeMonth.monthLabel}</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                gap: "10px",
                color: "var(--text-2)",
                fontSize: "12px",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {WEEKDAY_LABELS.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            {activeMonth.weeks.map((week, weekIndex) => (
              <div
                key={`${activeMonth.monthLabel}-week-${weekIndex + 1}`}
                style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "10px" }}
              >
                {week.map((day) => {
                  const isSelected = day.isoDate === selectedDay;
                  const examPeriod = examPeriodsByDate.get(day.isoDate);
                  return (
                    <button
                      key={day.isoDate}
                      onClick={() => setSelectedDay(day.isoDate)}
                      title={examPeriod?.tooltip}
                      style={{
                        minHeight: "112px",
                        display: "grid",
                        alignContent: "space-between",
                        gap: "12px",
                        padding: "12px",
                        borderRadius: "var(--r-lg)",
                        border: isSelected
                          ? "1px solid var(--gold)"
                          : examPeriod || day.isExamDay
                            ? "1px solid rgba(239, 68, 68, 0.38)"
                            : "1px solid var(--border)",
                        background: buildDayBackground(day, Boolean(examPeriod)),
                        color: day.isCurrentMonth ? "var(--text-1)" : "var(--text-3)",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                        <strong style={{ fontSize: "15px" }}>{day.dayLabel}</strong>
                        {day.events.length > 0 ? (
                          <span
                            style={{
                              minWidth: "22px",
                              height: "22px",
                              padding: "0 7px",
                              borderRadius: "999px",
                              background: "rgba(255, 255, 255, 0.08)",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "11px",
                              color: "var(--text-1)",
                            }}
                          >
                            {day.events.length}
                          </span>
                        ) : null}
                      </div>

                      <div style={{ display: "grid", gap: "6px" }}>
                        {day.events.slice(0, 2).map((event) => (
                          <span
                            key={event.id}
                            style={{
                              display: "block",
                              padding: "6px 8px",
                              borderRadius: "var(--r-sm)",
                              background: `${TIER_ACCENTS[event.tier]}1F`,
                              color: TIER_ACCENTS[event.tier],
                              fontSize: "11px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {event.title}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {selectedDay ? (
        <div
          style={{
            display: "grid",
            gap: "16px",
            padding: "24px",
            borderRadius: "var(--r-xl)",
            border: "1px solid var(--border)",
            background: "linear-gradient(160deg, var(--surface) 0%, var(--surface-2) 100%)",
          }}
        >
          <div style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-2)" }}>
              {selectedDayEvents.length} event{selectedDayEvents.length === 1 ? "" : "s"}
            </span>
            <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "26px" }}>{formatLongDate(selectedDay)}</h3>
          </div>

          {selectedDayEvents.length > 0 ? (
            <div style={{ display: "grid", gap: "12px" }}>
              {selectedDayEvents.map((event) => (
                <article
                  key={event.id}
                  style={{
                    display: "grid",
                    gap: "8px",
                    padding: "16px",
                    borderRadius: "var(--r-lg)",
                    border: "1px solid var(--border)",
                    borderLeft: `4px solid ${TIER_ACCENTS[event.tier]}`,
                    background: "rgba(255, 255, 255, 0.02)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                    <strong>{event.title}</strong>
                    <span style={{ color: "var(--text-2)", fontSize: "12px" }}>{formatEventTime(event)}</span>
                  </div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", color: "var(--text-2)", fontSize: "12px" }}>
                    <span>{event.tier.toUpperCase()}</span>
                    <span>{event.eventType.replace(/_/g, " ")}</span>
                    {event.moduleCode ? <span>{event.moduleCode}</span> : null}
                  </div>
                  {event.description ? (
                    <p style={{ margin: 0, color: "var(--text-2)", fontSize: "13px", lineHeight: 1.6 }}>{event.description}</p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: "var(--text-2)", fontSize: "14px" }}>No planner events are scheduled for this day.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
