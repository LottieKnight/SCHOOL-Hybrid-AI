"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import PhoneVerificationBanner from "@/components/PhoneVerificationBanner";
import { useSession } from "@/components/SessionProvider";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { StateCard } from "@/components/ui/StateCard";
import { PLATFORM_INVARIANT } from "@/lib/tutorCopy";
import styles from "./page.module.css";

type Tutor = {
  id: string;
  fullName: string;
  deliveryMode: "online" | "in_person" | "hybrid";
  location: {
    city: string;
    province: string;
    country: string;
    radiusKm: number;
  };
  hourlyRate: number;
  ratingAvg: number | null;
  ratingCount: number;
  completedSessionsCount?: number;
  reliabilityLabel?: string;
  subjects: string[];
  availability: { dayOfWeek: number; startTime: string; endTime: string }[];
  bio?: string | null;
  badges?: BadgeType[];
};

type BadgeType = "verified_graduate" | "verified_student" | "verified_teacher" | "top_tutor";

type TutorConfig = {
  minSessionPrice: number;
  commissionRate: number;
  platformInvariant: string;
};

type Notice = { type: "success" | "error" | "info"; message: string };

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon→Sun display order

function AvailabilityGrid({ slots }: { slots: Tutor["availability"] }) {
  const byDay = new Map<number, string[]>();
  for (const slot of slots) {
    const existing = byDay.get(slot.dayOfWeek) ?? [];
    existing.push(`${slot.startTime.slice(0, 5)}–${slot.endTime.slice(0, 5)}`);
    byDay.set(slot.dayOfWeek, existing);
  }
  return (
    <div className={styles.availabilityGrid} aria-label="Weekly availability">
      {dayOrder.map((day) => {
        const times = byDay.get(day);
        return (
          <div
            key={day}
            className={`${styles.dayPill} ${times ? styles.dayPillActive : ""}`}
            title={times ? `${dayNames[day]}: ${times.join(", ")}` : undefined}
            aria-label={times ? `${dayNames[day]} available: ${times.join(", ")}` : `${dayNames[day]} unavailable`}
          >
            {dayNames[day].slice(0, 1)}
          </div>
        );
      })}
    </div>
  );
}

const badgeLabels: Record<BadgeType, string> = {
  verified_graduate: "Verified Graduate",
  verified_student: "Verified Student",
  verified_teacher: "Verified Teacher",
  top_tutor: "Top Tutor",
};

const formatAvailability = (slots: Tutor["availability"]) => {
  if (!slots.length) return "Availability to be confirmed";
  return slots
    .slice(0, 3)
    .map((slot) => {
      const start = slot.startTime.slice(0, 5);
      const end = slot.endTime.slice(0, 5);
      return `${dayNames[slot.dayOfWeek]} ${start}-${end}`;
    })
    .join(" • ");
};

export default function TutorsPage() {
  const { session } = useSession();
  const apiBase = API_BASE;
  const [config, setConfig] = useState<TutorConfig | null>(null);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [filters, setFilters] = useState({ subject: "", mode: "", minRating: "" });
  const [activeTutor, setActiveTutor] = useState<Tutor | null>(null);
  const [sessionForm, setSessionForm] = useState({
    startTime: "",
    endTime: "",
    price: "",
  });
  const requiresPhoneVerification = Boolean(session && !session.user.isPhoneVerified);

  const minPrice = config?.minSessionPrice ?? 120;

  const loadConfig = useCallback(async () => {
    const response = await fetch(`${apiBase}/tutors/config`, { credentials: "include" });
    if (!response.ok) {
      throw new Error("Failed to load tutor configuration.");
    }
    return (await response.json()) as TutorConfig;
  }, [apiBase]);

  const loadTutors = useCallback(
    async (currentFilters = filters) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (currentFilters.subject.trim()) params.set("subject", currentFilters.subject.trim());
        if (currentFilters.mode) params.set("mode", currentFilters.mode);
        if (currentFilters.minRating) params.set("minRating", currentFilters.minRating);
        const response = await fetch(`${apiBase}/tutors/marketplace?${params.toString()}`, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Unable to load tutors.");
        }
        const data = await response.json();
        setTutors(data.tutors ?? []);
      } catch (error) {
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to load tutors.") });
      } finally {
        setLoading(false);
      }
    },
    [apiBase, filters]
  );

  useEffect(() => {
    (async () => {
      try {
        const nextConfig = await loadConfig();
        setConfig(nextConfig);
      } catch (error) {
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to load configuration.") });
      }
    })();
  }, [loadConfig]);

  useEffect(() => {
    loadTutors();
  }, [loadTutors]);

  const openSessionModal = (tutor: Tutor) => {
    if (requiresPhoneVerification) {
      setNotice({ type: "error", message: "Verify your phone before requesting tutor sessions." });
      return;
    }
    setNotice(null);
    setActiveTutor(tutor);
    setSessionForm({
      startTime: "",
      endTime: "",
      price: tutor.hourlyRate ? tutor.hourlyRate.toString() : minPrice.toString(),
    });
  };

  const closeSessionModal = () => {
    setActiveTutor(null);
  };

  const handleRequestSession = async () => {
    if (!activeTutor) return;
    if (!session) {
      setNotice({ type: "error", message: "Please sign in to request a session." });
      return;
    }
    const price = Number(sessionForm.price);
    if (!sessionForm.startTime || !sessionForm.endTime) {
      setNotice({ type: "error", message: "Please choose a start and end time." });
      return;
    }
    if (Number.isNaN(price) || price < minPrice) {
      setNotice({
        type: "error",
        message: `Minimum session price is R${minPrice} per hour.`,
      });
      return;
    }
    try {
      const response = await fetch(`${apiBase}/tutors/sessions`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({
          tutorId: activeTutor.id,
          startTime: new Date(sessionForm.startTime).toISOString(),
          endTime: new Date(sessionForm.endTime).toISOString(),
          price,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Unable to request session.");
      }
      setNotice({ type: "success", message: "Session request sent. You will be notified to confirm." });
      closeSessionModal();
    } catch (error) {
      setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to request session.") });
    }
  };

  const filterSummary = useMemo(() => {
    if (!filters.subject && !filters.mode && !filters.minRating) return "Showing all tutors";
    const items = [
      filters.subject ? `Subject: ${filters.subject}` : "",
      filters.mode ? `Mode: ${filters.mode.replace("_", " ")}` : "",
      filters.minRating ? `Rating: ${filters.minRating}+` : "",
    ].filter(Boolean);
    return items.join(" • ");
  }, [filters]);

  return (
    <div className="route-lock-dock">
      <div className="route-lock-frame glass card card-with-back">
      <RouteHeader
        eyebrow="Tutors"
        title="Find CAPS-aligned tutors with signal, not guesswork."
        description="Find tutors by subject, availability, delivery mode, verification status, and market trust indicators."
      >
        <div className={styles.actions}>
          <Link className="button" href={requiresPhoneVerification ? "/verify-phone?next=%2Ftutors%2Fonboarding" : "/tutors/onboarding"}>
            Become a tutor
          </Link>
          <Link className="button" href={requiresPhoneVerification ? "/verify-phone?next=%2Ftutors%2Fdashboard" : "/tutors/dashboard"}>
            Tutor dashboard
          </Link>
        </div>
      </RouteHeader>

      {notice && <div className={`${styles.notice} ${styles[notice.type]}`}>{notice.message}</div>}
      {requiresPhoneVerification ? <PhoneVerificationBanner nextPath="/tutors/onboarding" /> : null}

      <div className={styles.filters}>
        <label className={styles.field}>
          Subject
          <input
            type="text"
            placeholder="e.g. Maths, English"
            value={filters.subject}
            onChange={(event) => setFilters((prev) => ({ ...prev, subject: event.target.value }))}
          />
        </label>
        <label className={styles.field}>
          Delivery mode
          <select
            value={filters.mode}
            onChange={(event) => setFilters((prev) => ({ ...prev, mode: event.target.value }))}
          >
            <option value="">Any</option>
            <option value="online">Online</option>
            <option value="in_person">In-person</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </label>
        <label className={styles.field}>
          Minimum rating
          <select
            value={filters.minRating}
            onChange={(event) => setFilters((prev) => ({ ...prev, minRating: event.target.value }))}
          >
            <option value="">Any</option>
            <option value="4.5">4.5+</option>
            <option value="4.0">4.0+</option>
            <option value="3.5">3.5+</option>
          </select>
        </label>
        <button className="button" type="button" onClick={() => loadTutors(filters)}>
          Apply filters
        </button>
      </div>

      <p className={styles.filterSummary}>{filterSummary}</p>

      {loading ? (
        <StateCard title="Loading tutors" description="SCHOOL is ranking available tutors against your current filters." />
      ) : tutors.length === 0 ? (
        <StateCard title="No tutors match these filters" description="Broaden the subject, mode, or rating settings and try again." />
      ) : (
        <div className={styles.grid}>
          {tutors.map((tutor) => (
            <div className={styles.card} key={tutor.id}>
              <div className={styles.cardHeader}>
                <div>
                  <h3>{tutor.fullName}</h3>
                  <p className="subtitle">{tutor.subjects.join(", ") || "Subjects pending"}</p>
                  {tutor.badges && tutor.badges.length > 0 && (
                    <div className={styles.badgeRow}>
                      {tutor.badges.map((badge) => (
                        <span
                          key={`${tutor.id}-${badge}`}
                          className={`${styles.badgePill} ${badge === "top_tutor" ? styles.topBadge : ""}`}
                        >
                          {badgeLabels[badge] ?? badge}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className={styles.badge}>
                  {tutor.ratingAvg ? `${tutor.ratingAvg.toFixed(1)}★` : "New"}
                </span>
              </div>
              <div className={styles.meta}>
                <span>{tutor.deliveryMode.replace("_", " ")}</span>
                <span>
                  {tutor.location.city}, {tutor.location.province} ({tutor.location.radiusKm} km)
                </span>
                <AvailabilityGrid slots={tutor.availability} />
              </div>
              <div className={styles.priceRow}>
                <span>From R{tutor.hourlyRate.toFixed(0)}/hour</span>
                <span>{tutor.ratingCount} reviews</span>
                <span>{tutor.completedSessionsCount ?? 0} sessions</span>
              </div>
              {tutor.reliabilityLabel && (
                <span className={styles.reliabilityTag}>{tutor.reliabilityLabel}</span>
              )}
              {tutor.bio && <p className={styles.bio}>{tutor.bio}</p>}
              <div className={styles.cardActions}>
                <button className="button" type="button" onClick={() => openSessionModal(tutor)} disabled={requiresPhoneVerification}>
                  Request session
                </button>
                <Link className="button" href={requiresPhoneVerification ? "/verify-phone?next=%2Ftutors%2Fsessions" : "/tutors/sessions"}>
                  My sessions
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.trustBlock}>
        <p className={styles.trustLine}>
          SCHOOL verifies tutors through academic records, ratings, and community feedback.
        </p>
        <p className={styles.trustNote}>{PLATFORM_INVARIANT}</p>
      </div>

      {activeTutor && (
        <div className={styles.modalOverlay} onClick={closeSessionModal}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <h3>Request a session with {activeTutor.fullName}</h3>
            <p className="subtitle">
              Minimum session price is R{minPrice} per hour. Sessions are confirmed by the tutor.
            </p>
            <div className={styles.modalFields}>
              <label className={styles.field}>
                Start time
                <input
                  type="datetime-local"
                  value={sessionForm.startTime}
                  onChange={(event) =>
                    setSessionForm((prev) => ({ ...prev, startTime: event.target.value }))
                  }
                />
              </label>
              <label className={styles.field}>
                End time
                <input
                  type="datetime-local"
                  value={sessionForm.endTime}
                  onChange={(event) =>
                    setSessionForm((prev) => ({ ...prev, endTime: event.target.value }))
                  }
                />
              </label>
              <label className={styles.field}>
                Price (R/hour)
                <input
                  type="number"
                  min={minPrice}
                  step="5"
                  value={sessionForm.price}
                  onChange={(event) =>
                    setSessionForm((prev) => ({ ...prev, price: event.target.value }))
                  }
                />
              </label>
            </div>
            <div className={styles.modalActions}>
              <button className="button" type="button" onClick={closeSessionModal}>
                Cancel
              </button>
              <button className="button" type="button" onClick={handleRequestSession}>
                Send request
              </button>
            </div>
            <p className={styles.modalDisclaimer}>{PLATFORM_INVARIANT}</p>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
