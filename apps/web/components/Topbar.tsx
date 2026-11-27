"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AcademicPeriodSelector } from "@/components/AcademicPeriodSelector";
import periodStyles from "@/components/AcademicPeriodSelector.module.css";
import { NotificationBell } from "@/components/NotificationBell";
import { ZenFocusToggle } from "@/components/ZenFocusToggle";
import { useMinimalProfile } from "@/components/profile/useMinimalProfile";
import { useSession } from "@/components/SessionProvider";
import { buttonClassName } from "@/components/ui/Button";
import { ExamCountdown } from "@/components/ExamCountdown";
import { topbarIdentity } from "@/lib/minimalProfile";
import { learnerPrimaryAction } from "@/lib/navigation/navManifest";

function getFirstName(user: Record<string, unknown> | undefined) {
  const firstName = typeof user?.firstName === "string" ? user.firstName.trim() : "";
  if (firstName) return firstName;

  const email = typeof user?.email === "string" ? user.email.trim() : "";
  if (!email) return "";
  return email.split("@")[0] || "";
}

function formatClock(now: Date) {
  const time = new Intl.DateTimeFormat("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const day = new Intl.DateTimeFormat("en-ZA", { weekday: "short" }).format(now).toUpperCase();
  return `${time} \u00B7 ${day}`;
}

type TopbarProps = {
  onMenuClick: () => void;
  average?: string | null;
};

export function Topbar({ onMenuClick, average }: TopbarProps) {
  const { session } = useSession();
  const { profile } = useMinimalProfile();
  const user = (session?.user ?? null) as Record<string, unknown> | null;
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const sync = () => setNow(new Date());
    sync();
    const timer = window.setInterval(sync, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const sessionName = useMemo(() => getFirstName(user ?? undefined), [user]);
  const identity = useMemo(
    () => topbarIdentity({ profile, sessionFirstName: sessionName }),
    [profile, sessionName],
  );
  const clockLabel = useMemo(() => (now ? formatClock(now) : ""), [now]);
  const userRole = typeof user?.role === "string" ? user.role : null;
  const gradeLabel =
    typeof user?.studyType === "string" && user.studyType === "university"
      ? (typeof user?.institutionShortName === "string" && user.institutionShortName.trim()
          ? user.institutionShortName
          : typeof user?.institutionName === "string"
            ? user.institutionName
            : null)
      : typeof user?.grade === "string" || typeof user?.grade === "number"
        ? (user.grade as string | number)
        : null;

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className={buttonClassName({ variant: "ghost", size: "sm", className: "topbar-menu-button" })}
          type="button"
          onClick={onMenuClick}
          aria-label="Toggle navigation"
        >
          <svg className="topbar-menu-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span className="topbar-menu-label">Menu</span>
        </button>
        <div className="topbar-title">
          <div className="topbar-greeting">
            <span>{identity.greetingName ? "Welcome back," : "Welcome"}</span>
            {identity.greetingName ? <span className="topbar-name">{identity.greetingName}</span> : null}
          </div>
          {identity.showAcademicPeriod ? (
            <AcademicPeriodSelector userRole={userRole || "university"} gradeLabel={gradeLabel ?? "university"} />
          ) : (
            <Link href="/settings" className={periodStyles.pill} data-testid="topbar-profile-badge" prefetch={false}>
              {identity.badge}
            </Link>
          )}
        </div>
      </div>

      <div className="topbar-right">
        {Array.isArray(user?.examDates) ? (
          <div style={{ marginRight: "12px" }}>
            <ExamCountdown exams={user!.examDates as { subject: string; date: string }[]} />
          </div>
        ) : null}
        <button
          className={buttonClassName({ variant: "ghost", size: "sm" })}
          type="button"
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
          aria-label="Open Command Palette Search"
          title="Search (Cmd+K / Ctrl+K)"
          style={{ gap: "6px" }}
        >
          🔍 <span style={{ opacity: 0.7, fontSize: "0.8rem" }}>Cmd+K</span>
        </button>
        <ZenFocusToggle />
        <span className="topbar-clock" suppressHydrationWarning>{clockLabel}</span>
        {average ? <span className="ui-badge ui-badge--green">{`\u2191 ${average} avg`}</span> : null}
        {user ? <NotificationBell /> : null}
        <Link
          className={buttonClassName({ variant: "ghost", size: "sm" })}
          href="/settings"
          prefetch={false}
          aria-label="Settings"
          title="Settings"
          style={{ gap: "6px" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span style={{ opacity: 0.7, fontSize: "0.8rem" }}>Settings</span>
        </Link>
        <Link className={buttonClassName({ variant: "gold", size: "sm" })} href={learnerPrimaryAction.href} prefetch={false}>
          {learnerPrimaryAction.label}
        </Link>
      </div>
    </header>
  );
}
