"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import { AdminQuickLinks } from "@/components/AdminQuickLinks";

type ModerationEvent = {
  id: string;
  actor_id: string;
  actor_email: string;
  actor_name: string;
  type: "off_platform_attempt" | "fraud_flag" | "abuse";
  severity: "low" | "medium" | "high";
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

function parseSource(event: ModerationEvent) {
  const source = event.metadata?.source;
  return typeof source === "string" ? source : "unknown";
}

function parseReason(event: ModerationEvent) {
  const reason = event.metadata?.reason;
  return typeof reason === "string" && reason.trim().length > 0 ? reason : "No reason provided";
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "n/a";
  return parsed.toLocaleString();
}

export default function AdminMessagesPage() {
  const apiBase = API_BASE;
  const [events, setEvents] = useState<ModerationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<"all" | "message_report" | "user_report" | "other">("all");

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/admin/messages/moderation-feed?limit=60&type=abuse`, {
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as {
        events?: ModerationEvent[];
        error?: string;
      } | null;
      if (!response.ok) throw new Error(payload?.error || "Unable to load moderation reports.");
      setEvents(Array.isArray(payload?.events) ? payload.events : []);
      setNotice(null);
    } catch (error) {
      setEvents([]);
      setNotice(getApiErrorMessage(error, "Unable to load moderation reports."));
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const filteredEvents = useMemo(() => {
    if (sourceFilter === "all") return events;
    if (sourceFilter === "other") {
      return events.filter((event) => {
        const source = parseSource(event);
        return source !== "message_report" && source !== "user_report";
      });
    }
    return events.filter((event) => parseSource(event) === sourceFilter);
  }, [events, sourceFilter]);

  return (
    <div className="glass card card-with-back">
      <h1 className="title">Messaging moderation queue</h1>
      <p className="subtitle">Admin placeholder view for message/user reports and abuse moderation triage.</p>
      <AdminQuickLinks />
      <div className="outline-actions">
        <button className="button" type="button" onClick={() => void loadEvents()} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
        <label>
          Source
          <select
            value={sourceFilter}
            onChange={(event) =>
              setSourceFilter(event.target.value as "all" | "message_report" | "user_report" | "other")
            }
          >
            <option value="all">All</option>
            <option value="message_report">Message reports</option>
            <option value="user_report">User reports</option>
            <option value="other">Other abuse events</option>
          </select>
        </label>
        <Link className="button" href="/messages">
          Open live moderation tools
        </Link>
      </div>
      {notice ? <div className="badge">{notice}</div> : null}
      {loading ? (
        <p className="subtitle">Loading moderation queue...</p>
      ) : filteredEvents.length === 0 ? (
        <p className="subtitle">No moderation events found for this view.</p>
      ) : (
        <div className="grid">
          {filteredEvents.map((event) => (
            <article className="list-item" key={event.id}>
              <strong>{event.actor_name || event.actor_email}</strong>
              <p className="subtitle">{event.actor_email}</p>
              <p className="subtitle">
                Source: <code>{parseSource(event)}</code>
              </p>
              <p className="subtitle">Reason: {parseReason(event)}</p>
              <p className="subtitle">
                Severity: {event.severity} | Logged: {formatDateTime(event.created_at)}
              </p>
              <p className="subtitle">
                Event: <code>{event.id}</code>
              </p>
            </article>
          ))}
        </div>
      )}
      <p className="subtitle">
        Manual case actions (assign, notes, resolve) are currently available in the in-app moderation panel under{" "}
        <code>/messages</code>.
      </p>
    </div>
  );
}

