"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import { useSession } from "@/components/SessionProvider";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { StateCard } from "@/components/ui/StateCard";
import { PLATFORM_INVARIANT } from "@/lib/tutorCopy";
import styles from "./page.module.css";

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
  ratingId?: string | null;
  ratingValue?: number | null;
  scheduledStartAt?: string | null;
  disputeStatus?: string | null;
  disputeCategory?: string | null;
};

type DisputeForm = { category: string; description: string };

type Notice = { type: "success" | "error" | "info"; message: string };

export default function TutorSessionsPage() {
  const { session } = useSession();
  const apiBase = API_BASE;
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [ratingInput, setRatingInput] = useState<Record<string, string>>({});
  const [feedbackInput, setFeedbackInput] = useState<Record<string, string>>({});
  const [disputeOpen, setDisputeOpen] = useState<string | null>(null);
  const [disputeForm, setDisputeForm] = useState<DisputeForm>({ category: "other", description: "" });

  const loadSessions = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/tutors/sessions`, { credentials: "include" });
      if (!response.ok) {
        throw new Error("Unable to load sessions.");
      }
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (error) {
      setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to load sessions.") });
    } finally {
      setLoading(false);
    }
  }, [apiBase, session]);

  const updateStatus = async (sessionId: string, status: string) => {
    if (!session) return;
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
      await loadSessions();
      setNotice({ type: "success", message: "Session updated." });
    } catch (error) {
      setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to update session.") });
    }
  };

  const cancelSession = async (sessionId: string) => {
    if (!session) return;
    const reason = "";
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
      await loadSessions();
      setNotice({ type: "success", message: "Session cancelled." });
    } catch (error) {
      setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to cancel session.") });
    }
  };

  const reportNoShow = async (sessionId: string) => {
    if (!session) return;
    try {
      const response = await fetch(`${apiBase}/tutors/sessions/${sessionId}/no-show`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({ reportedBy: "learner" }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Unable to report no-show.");
      }
      await loadSessions();
      setNotice({ type: "success", message: "No-show reported." });
    } catch (error) {
      setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to report no-show.") });
    }
  };

  const submitDispute = async (sessionId: string) => {
    if (!session) return;
    if (!disputeForm.description.trim()) {
      setNotice({ type: "error", message: "Dispute description is required." });
      return;
    }
    try {
      const response = await fetch(`${apiBase}/tutors/sessions/${sessionId}/dispute`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({ category: disputeForm.category, description: disputeForm.description }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Unable to open dispute.");
      }
      setDisputeOpen(null);
      setDisputeForm({ category: "other", description: "" });
      await loadSessions();
      setNotice({ type: "success", message: "Dispute opened. Our team will review it within 48 hours." });
    } catch (error) {
      setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to open dispute.") });
    }
  };

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!session) {
      setLoading(false);
    }
  }, [session]);

  const submitRating = async (sessionId: string) => {
    if (!session) return;
    const ratingValue = Number(ratingInput[sessionId]);
    if (Number.isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      setNotice({ type: "error", message: "Rating must be between 1 and 5." });
      return;
    }
    try {
      const response = await fetch(`${apiBase}/tutors/sessions/${sessionId}/rating`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({
          rating: ratingValue,
          feedback: feedbackInput[sessionId],
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Unable to submit rating.");
      }
      setNotice({ type: "success", message: "Thanks for rating your tutor." });
      await loadSessions();
    } catch (error) {
      setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to submit rating.") });
    }
  };

  return (
    <div className="route-lock-dock">
      <div className="route-lock-frame glass card card-with-back">
      <RouteHeader
        eyebrow="Sessions"
        title="Manage tutoring sessions and post-session trust signals."
        description="Handle cancellations, disputes, no-shows, and ratings without leaving the SCHOOL shell."
      >
        <Link className="button" href="/tutors">
          Back to tutors
        </Link>
      </RouteHeader>

      {notice && <div className={`${styles.notice} ${styles[notice.type]}`}>{notice.message}</div>}

      {!session ? (
        <StateCard title="Sign in required" description="Sign in to manage your tutoring sessions." />
      ) : loading ? (
        <StateCard title="Loading sessions" description="SCHOOL is fetching your tutoring timeline and current session actions." />
      ) : sessions.length === 0 ? (
        <StateCard title="No sessions yet" description="Once you book or receive tutoring sessions, they’ll appear here." />
      ) : (
        <div className={styles.list}>
          {sessions.map((item) => (
            <div className={styles.sessionCard} key={item.id}>
              <div>
                <strong>{item.tutorName}</strong>
                <p className="subtitle">
                  {new Date(item.startTime).toLocaleString()} · R{item.price.toFixed(0)}
                </p>
                <div className={styles.statusRow}>
                  <p className={styles.status}>Status: {item.status}</p>
                  {item.status === "disputed" && (
                    <span className={styles.disputeBadge}>
                      Dispute open{item.disputeCategory ? ` · ${item.disputeCategory}` : ""}
                    </span>
                  )}
                </div>
              </div>
              {item.role === "learner" && ["requested", "confirmed"].includes(item.status) && (
                <div className={styles.sessionActions}>
                  <button className="button" onClick={() => cancelSession(item.id)}>
                    Cancel session
                  </button>
                  {item.status === "confirmed" && (
                    <>
                      <button className="button" onClick={() => reportNoShow(item.id)}>
                        Report no-show
                      </button>
                      <button
                        className="button"
                        onClick={() => {
                          setDisputeOpen(disputeOpen === item.id ? null : item.id);
                          setDisputeForm({ category: "other", description: "" });
                        }}
                      >
                        {disputeOpen === item.id ? "Cancel" : "Open dispute"}
                      </button>
                    </>
                  )}
                </div>
              )}
              {disputeOpen === item.id && (
                <div className={styles.disputeForm}>
                  <p className={styles.disputeHeading}>What went wrong?</p>
                  <select
                    className={styles.disputeSelect}
                    value={disputeForm.category}
                    onChange={(e) => setDisputeForm((f) => ({ ...f, category: e.target.value }))}
                  >
                    <option value="no_show">Tutor didn't show up</option>
                    <option value="quality">Session quality issue</option>
                    <option value="misconduct">Misconduct</option>
                    <option value="billing">Billing problem</option>
                    <option value="other">Other</option>
                  </select>
                  <textarea
                    className={styles.disputeTextarea}
                    placeholder="Describe the issue in detail…"
                    rows={3}
                    value={disputeForm.description}
                    onChange={(e) => setDisputeForm((f) => ({ ...f, description: e.target.value }))}
                  />
                  <button className="button" onClick={() => submitDispute(item.id)}>
                    Submit dispute
                  </button>
                </div>
              )}
              {item.role === "learner" && item.status === "completed" && !item.ratingId && (
                <div className={styles.ratingRow}>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    placeholder="Rating"
                    value={ratingInput[item.id] || ""}
                    onChange={(event) =>
                      setRatingInput((prev) => ({ ...prev, [item.id]: event.target.value }))
                    }
                  />
                  <input
                    type="text"
                    placeholder="Feedback (optional)"
                    value={feedbackInput[item.id] || ""}
                    onChange={(event) =>
                      setFeedbackInput((prev) => ({ ...prev, [item.id]: event.target.value }))
                    }
                  />
                  <button className="button" onClick={() => submitRating(item.id)}>
                    Submit rating
                  </button>
                </div>
              )}
              {item.ratingId && (
                <p className="subtitle">Rating submitted: {item.ratingValue}/5</p>
              )}
            </div>
          ))}
        </div>
      )}

      <p className={styles.trustNote}>{PLATFORM_INVARIANT}</p>
      </div>
    </div>
  );
}
