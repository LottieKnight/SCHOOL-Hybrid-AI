"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import { useSession } from "@/components/SessionProvider";
import { AdminQuickLinks } from "@/components/AdminQuickLinks";

type Dispute = {
  id: string;
  session_id: string;
  status: string;
  category: string;
  description: string;
  opened_by: string;
  created_at: string;
  tutor_id: string;
  learner_id: string;
  session_status: string;
};

type Notice = { type: "success" | "error" | "info"; message: string };

export default function TutorDisputesAdminPage() {
  const { session, refresh } = useSession();
  const apiBase = API_BASE;
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDisputes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/admin/tutor-disputes`, { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load disputes.");
      const data = await response.json();
      setDisputes(data.disputes || []);
    } catch (error) {
      setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to load disputes.") });
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    loadDisputes();
  }, [loadDisputes]);

  const resolveDispute = async (id: string) => {
    const outcome =
      window.prompt("Resolution outcome (uphold_tutor, partial_refund, full_refund, tutor_fault, learner_fault)") ||
      "uphold_tutor";
    const refundAmountRaw = window.prompt("Refund amount (0 if none)") || "0";
    const refundAmount = Number(refundAmountRaw);
    const adminNotes = window.prompt("Admin notes (optional)") || "";
    try {
      let csrfToken = session?.csrfToken;
      if (!csrfToken) {
        const nextSession = await refresh();
        csrfToken = nextSession?.csrfToken;
      }
      if (!csrfToken) {
        throw new Error("Missing CSRF token.");
      }
      const response = await fetch(`${apiBase}/admin/tutor-disputes/${id}/resolve`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          status: "resolved",
          resolutionOutcome: outcome,
          refundAmount,
          adminNotes,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Unable to resolve dispute.");
      }
      setNotice({ type: "success", message: "Dispute resolved." });
      await loadDisputes();
    } catch (error) {
      setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to resolve dispute.") });
    }
  };

  return (
    <div className="glass card card-with-back">
      <h1 className="title">Tutor disputes</h1>
      <p className="subtitle">Review and resolve disputes.</p>
      <AdminQuickLinks />
      {notice && <div className="badge">{notice.message}</div>}
      {loading ? (
        <p className="subtitle">Loading disputes...</p>
      ) : disputes.length === 0 ? (
        <p className="subtitle">No disputes found.</p>
      ) : (
        <div className="grid">
          {disputes.map((dispute) => (
            <div className="list-item" key={dispute.id}>
              <strong>{dispute.category}</strong>
              <p className="subtitle">Status: {dispute.status}</p>
              <p className="subtitle">Opened by: {dispute.opened_by}</p>
              <p className="subtitle">{dispute.description}</p>
              <button className="button" onClick={() => resolveDispute(dispute.id)}>
                Resolve
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
