"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/SessionProvider";
import { type CalendarFormat, getCurrentPeriod } from "@/lib/academicPeriod";
import {
  buildAcademicPreferencesPatch,
  CALENDAR_FORMAT_STORAGE_KEY,
  readAcademicPreferences,
} from "@/lib/academicPreferences";
import { API_BASE } from "@/lib/apiBase";
import styles from "@/components/AcademicPeriodSelector.module.css";

type AcademicPeriodSelectorProps = {
  userRole?: string | null;
  gradeLabel?: string | number | null;
};

const CALENDAR_FORMAT_EVENT = "school:calendar-format-changed";

type ProfileResponse = {
  profile?: {
    appPreferences?: Record<string, unknown>;
  };
};

type FormatOption = {
  format: CalendarFormat;
  icon: string;
  title: string;
  description: string;
};

const FORMAT_OPTIONS: FormatOption[] = [
  {
    format: "term",
    icon: "📅",
    title: "Term system",
    description: "4 terms · CAPS standard",
  },
  {
    format: "semester",
    icon: "🎓",
    title: "Semester system",
    description: "2 semesters · University default",
  },
  {
    format: "trimester",
    icon: "📆",
    title: "Trimester system",
    description: "3 trimesters · 13 weeks each",
  },
  {
    format: "quarter",
    icon: "🗓",
    title: "Quarter system",
    description: "4 quarters · Calendar aligned",
  },
];

function parseNumericGrade(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;
  const match = value.match(/\d+/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

export function resolveDefaultCalendarFormat(userRole?: string | null, gradeLabel?: string | number | null) {
  const numericGrade = parseNumericGrade(gradeLabel);
  if (numericGrade !== null && numericGrade > 12) {
    return "semester" as const;
  }

  const gradeValue = typeof gradeLabel === "string" ? gradeLabel.toLowerCase() : "";
  if (gradeValue.includes("univers")) {
    return "semester" as const;
  }

  const roleValue = (userRole || "").toLowerCase();
  if (roleValue.includes("univers")) {
    return "semester" as const;
  }

  return "term" as const;
}

export function AcademicPeriodSelector({ userRole, gradeLabel }: AcademicPeriodSelectorProps) {
  const router = useRouter();
  const { session } = useSession();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<CalendarFormat>(() => resolveDefaultCalendarFormat(userRole, gradeLabel));
  const [appPreferences, setAppPreferences] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = window.localStorage.getItem(CALENDAR_FORMAT_STORAGE_KEY);
    if (saved === "term" || saved === "semester" || saved === "trimester" || saved === "quarter") {
      setFormat(saved);
      return;
    }

    setFormat(resolveDefaultCalendarFormat(userRole, gradeLabel));
  }, [gradeLabel, userRole]);

  useEffect(() => {
    if (!session) return;

    let active = true;
    fetch(`${API_BASE}/profile/me`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json().catch(() => null)) as ProfileResponse | null;
      })
      .then((payload) => {
        if (!active || !payload?.profile) return;

        const nextPreferences = payload.profile.appPreferences ?? {};
        const academicPreferences = readAcademicPreferences(payload);
        setAppPreferences(nextPreferences);

        if (academicPreferences.calendarFormat) {
          setFormat(academicPreferences.calendarFormat);
          window.localStorage.setItem(CALENDAR_FORMAT_STORAGE_KEY, academicPreferences.calendarFormat);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    if (!open) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const currentPeriod = useMemo(() => getCurrentPeriod(format), [format]);

  const handleSelectFormat = async (nextFormat: CalendarFormat) => {
    setFormat(nextFormat);
    setOpen(false);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(CALENDAR_FORMAT_STORAGE_KEY, nextFormat);
      window.dispatchEvent(new CustomEvent(CALENDAR_FORMAT_EVENT, { detail: nextFormat }));
    }

    if (!session) return;

    try {
      const response = await fetch(`${API_BASE}/profile/me`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({
          appPreferences: buildAcademicPreferencesPatch(appPreferences, {
            calendarFormat: nextFormat,
          }),
        }),
      });

      const payload = (await response.json().catch(() => null)) as ProfileResponse | null;
      if (response.ok && payload?.profile?.appPreferences) {
        setAppPreferences(payload.profile.appPreferences);
      }
    } catch {
      // The local selection is still the right UX fallback if the profile sync fails.
    }
  };

  const handlePlannerOpen = () => {
    setOpen(false);
    router.push("/planner");
  };

  const handlePillClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.altKey) {
      event.preventDefault();
      handlePlannerOpen();
      return;
    }

    setOpen((current) => !current);
  };

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        className={open ? `${styles.pill} ${styles.pillOpen}` : styles.pill}
        type="button"
        onClick={handlePillClick}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span>{`\u25CF ${currentPeriod.label}`}</span>
        <span className={open ? `${styles.chevron} ${styles.chevronOpen}` : styles.chevron} aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div className={styles.panel} role="menu">
          <div className={styles.header}>Academic calendar format</div>

          <div className={styles.options}>
            {FORMAT_OPTIONS.map((option) => {
              const selected = option.format === format;
              return (
                <button
                  key={option.format}
                  className={selected ? `${styles.option} ${styles.optionSelected}` : styles.option}
                  type="button"
                  onClick={() => void handleSelectFormat(option.format)}
                  role="menuitemradio"
                  aria-checked={selected}
                >
                  <span className={styles.optionIcon} aria-hidden="true">
                    {option.icon}
                  </span>
                  <span className={styles.optionCopy}>
                    <span className={styles.optionTitle}>{option.title}</span>
                    <span className={styles.optionDescription}>{option.description}</span>
                  </span>
                  <span className={styles.optionCheck} aria-hidden="true">
                    {selected ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>

          <div className={styles.divider} />

          <div className={styles.currentPeriod}>
            <span>Current period</span>
            <strong>{currentPeriod.label}</strong>
          </div>

          <button className={styles.plannerLink} type="button" onClick={handlePlannerOpen}>
            <span>Open full planner</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
