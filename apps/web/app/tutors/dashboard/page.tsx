"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import PhoneVerificationBanner from "@/components/PhoneVerificationBanner";
import { useSession } from "@/components/SessionProvider";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { StateCard } from "@/components/ui/StateCard";
import { COMPLIANCE_NOTICE, PLATFORM_INVARIANT } from "@/lib/tutorCopy";
import styles from "./page.module.css";

type TutorProfile = {
  id: string;
  fullName: string;
  highestQualification: string;
  qualificationType: string;
  deliveryMode: string;
  hourlyRate: number;
  ratingAvg: number | null;
  ratingCount: number;
  completedSessionsCount?: number;
  reliabilityLabel?: string;
  badges?: string[];
  subjects: { name: string }[] | string[];
  availability: { dayOfWeek: number; startTime: string; endTime: string }[];
  location: { city: string; province: string; country: string; radiusKm: number };
};

type SessionItem = {
  id: string;
  tutorId: string;
  tutorName: string;
  learnerId: string;
  startTime: string;
  endTime: string;
  price: number;
  status: string;
  role: "tutor" | "learner";
};

type PayoutSummary = {
  weeklyEarnings: number;
  upcomingPayout: number;
};

type PayoutItem = {
  payoutBatchId: string;
  sessionId: string;
  periodStart: string;
  periodEnd: string;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  status: string;
  paidAt: string;
};

type Notice = { type: "success" | "error" | "info"; message: string };

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const formatAvailability = (slots: TutorProfile["availability"]) =>
  slots
    .map((slot) => {
      const start = slot.startTime.slice(0, 5);
      const end = slot.endTime.slice(0, 5);
      return `${dayNames[slot.dayOfWeek]} ${start}-${end}`;
    })
    .join(" • ");

export default function TutorDashboardPage() {
  const { session } = useSession();
  const apiBase = API_BASE;
  const [notice, setNotice] = useState<Notice | null>(null);
  const [tutor, setTutor] = useState<TutorProfile | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [history, setHistory] = useState<PayoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const requiresPhoneVerification = Boolean(session && !session.user.isPhoneVerified);

  const loadDashboard = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [tutorRes, sessionsRes, summaryRes, historyRes] = await Promise.all([
        fetch(`${apiBase}/tutors/me`, { credentials: "include" }),
        fetch(`${apiBase}/tutors/sessions`, { credentials: "include" }),
        fetch(`${apiBase}/tutors/payouts/summary`, { credentials: "include" }),
        fetch(`${apiBase}/tutors/payouts/history`, { credentials: "include" }),
      ]);

      if (tutorRes.ok) {
        const data = await tutorRes.json();
        setTutor(data.tutor);
      }
      if (sessionsRes.ok) {
        const data = await sessionsRes.json();
        setSessions((data.sessions || []).filter((item: SessionItem) => item.role === "tutor"));
      }
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummary(data.summary);
      }
      if (historyRes.ok) {
        const data = await historyRes.json();
        setHistory(data.history || []);
      }
    } catch (error) {
      setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to load dashboard.") });
    } finally {
      setLoading(false);
    }
  }, [apiBase, session]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!session) {
      setLoading(false);
    }
  }, [session]);

  const updateStatus = async (sessionId: string, status: string) => {
    if (!session) return;
    if (requiresPhoneVerification) {
      setNotice({ type: "error", message: "Verify your phone before managing tutor marketplace sessions." });
      return;
    }
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/tutors/sessions/${sessionId}/status`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Unable to update session.");
      }
      await loadDashboard();
      setNotice({ type: "success", message: "Session updated." });
    } catch (error) {
      setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to update session.") });
    }
  };

  const cancelSession = async (sessionId: string) => {
    if (!session) return;
    if (requiresPhoneVerification) {
      setNotice({ type: "error", message: "Verify your phone before managing tutor marketplace sessions." });
      return;
    }
    const reason = window.prompt("Reason for cancellation (optional)") || "";
    try {
      const response = await fetch(`${apiBase}/tutors/sessions/${sessionId}/cancel`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Unable to cancel session.");
      }
      await loadDashboard();
      setNotice({ type: "success", message: "Session cancelled." });
    } catch (error) {
      setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to cancel session.") });
    }
  };

  const reportNoShow = async (sessionId: string) => {
    if (!session) return;
    if (requiresPhoneVerification) {
      setNotice({ type: "error", message: "Verify your phone before managing tutor marketplace sessions." });
      return;
    }
    try {
      const response = await fetch(`${apiBase}/tutors/sessions/${sessionId}/no-show`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({ reportedBy: "tutor" }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Unable to report no-show.");
      }
      await loadDashboard();
      setNotice({ type: "success", message: "No-show reported." });
    } catch (error) {
      setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to report no-show.") });
    }
  };

  const upcomingSessions = useMemo(
    () => sessions.filter((item) => ["requested", "confirmed"].includes(item.status)),
    [sessions]
  );

  return (
    <div className="route-lock-dock">
      <div className="route-lock-frame glass card card-with-back">
      <RouteHeader
        eyebrow="Tutor Dashboard"
        title="Manage your tutoring operation without friction."
        description="Track sessions, payouts, profile visibility, and trust signals from one SCHOOL surface."
      >
        <div className={styles.actions}>
          <Link className="button" href={requiresPhoneVerification ? "/verify-phone?next=%2Ftutors%2Fonboarding" : "/tutors/onboarding"}>
            Edit profile
          </Link>
          <Link className="button" href="/tutors">
            View marketplace
          </Link>
        </div>
      </RouteHeader>

      {notice && <div className={`${styles.notice} ${styles[notice.type]}`}>{notice.message}</div>}
      {requiresPhoneVerification ? <PhoneVerificationBanner nextPath="/tutors/dashboard" /> : null}

      {!session ? (
        <StateCard title="Sign in required" description="Sign in from the sidebar to access your tutor dashboard." />
      ) : loading ? (
        <StateCard title="Loading dashboard" description="SCHOOL is assembling your tutor sessions, payouts, and profile visibility." />
      ) : !tutor ? (
        <StateCard title="No tutor profile yet" description="Finish onboarding to unlock your dashboard, sessions, and payouts.">
          <Link className="button" href="/tutors/onboarding">
            Start onboarding
          </Link>
        </StateCard>
      ) : (
        <>
          <div className={styles.profileCard}>
            <div>
              <h3>{tutor.fullName}</h3>
              <p className="subtitle">{tutor.highestQualification}</p>
              {tutor.badges && tutor.badges.length > 0 && (
                <div className={styles.badgeRow}>
                  {tutor.badges.map((badge) => (
                    <span className={styles.badgePill} key={`${tutor.id}-${badge}`}>
                      {badge.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.profileMeta}>
              <span>Rating: {tutor.ratingAvg ? tutor.ratingAvg.toFixed(1) : "New"}</span>
              <span>{tutor.ratingCount} reviews</span>
              <span>{tutor.completedSessionsCount ?? 0} sessions</span>
              <span>R{tutor.hourlyRate.toFixed(0)}/hour</span>
            </div>
            {tutor.reliabilityLabel && (
              <p className={styles.profileLine}>Reliability: {tutor.reliabilityLabel}</p>
            )}
            <div className={styles.profileMeta}>
              <span>{tutor.deliveryMode.replace("_", " ")}</span>
              <span>
                {tutor.location.city}, {tutor.location.province} ({tutor.location.radiusKm} km)
              </span>
            </div>
            <p className={styles.profileLine}>
              Subjects: {Array.isArray(tutor.subjects) ? tutor.subjects.map((s: any) => s.name || s).join(", ") : ""}
            </p>
            <p className={styles.profileLine}>Availability: {formatAvailability(tutor.availability)}</p>
          </div>

          <div className={styles.grid}>
            <div className={styles.panel}>
              <h3>Upcoming sessions</h3>
              {upcomingSessions.length === 0 ? (
                <p className="subtitle">No pending session requests.</p>
              ) : (
                upcomingSessions.map((item) => (
                  <div className={styles.sessionRow} key={item.id}>
                    <div>
                      <strong>{new Date(item.startTime).toLocaleString()}</strong>
                      <p className="subtitle">
                        {item.status} · R{item.price.toFixed(0)}
                      </p>
                    </div>
                    <div className={styles.sessionActions}>
                      {item.status === "requested" && (
                        <button className="button" onClick={() => updateStatus(item.id, "confirmed")}>
                          Confirm
                        </button>
                      )}
                      {item.status === "confirmed" && (
                        <>
                          <button className="button" onClick={() => updateStatus(item.id, "completed")}>
                            Mark completed
                          </button>
                          <button className="button" onClick={() => reportNoShow(item.id)}>
                            Report no-show
                          </button>
                        </>
                      )}
                      <button className="button" onClick={() => cancelSession(item.id)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className={styles.panel}>
              <h3>Earnings snapshot</h3>
              <div className={styles.earnings}>
                <div>
                  <span className={styles.earningsLabel}>Last 7 days</span>
                  <strong>R{summary?.weeklyEarnings.toFixed(0) ?? 0}</strong>
                </div>
                <div>
                  <span className={styles.earningsLabel}>Upcoming payout</span>
                  <strong>R{summary?.upcomingPayout.toFixed(0) ?? 0}</strong>
                </div>
              </div>
              <p className="subtitle">
                Payouts run weekly with no instant withdrawals. Commission is deducted automatically before payout.
              </p>
            </div>
          </div>

          <div className={styles.panel}>
            <h3>Payout history</h3>
            {history.length === 0 ? (
              <p className="subtitle">No payouts yet.</p>
            ) : (
              <div className={styles.historyGrid}>
                {history.slice(0, 6).map((item) => (
                  <div className={styles.historyCard} key={item.sessionId}>
                    <strong>R{item.netAmount.toFixed(0)}</strong>
                    <p className="subtitle">
                      Period {item.periodStart} → {item.periodEnd}
                    </p>
                    <p className="subtitle">Commission: R{item.commissionAmount.toFixed(0)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.legal}>
            <p className={styles.legalLine}>{PLATFORM_INVARIANT}</p>
            <ul>
              {COMPLIANCE_NOTICE.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
