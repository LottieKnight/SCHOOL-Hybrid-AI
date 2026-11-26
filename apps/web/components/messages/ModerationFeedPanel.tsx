"use client";
import {
  getModerationEventTarget,
  getModerationSeverityLabel,
  getModerationTypeLabel,
  type ModerationEventSeverity,
  type ModerationEventSeverityFilter,
  type ModerationEventType,
  type ModerationEventTypeFilter,
} from "@/lib/moderationEvents";
import styles from "@/app/messages/page.module.css";

type ModerationEvent = {
  id: string;
  actor_id?: string;
  actor_email?: string;
  actor_name: string;
  session_id: string | null;
  type: ModerationEventType;
  severity: ModerationEventSeverity;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

type ModerationFeedPanelProps = {
  moderationEvents: ModerationEvent[];
  loadingModerationEvents: boolean;
  moderationTypeFilter: ModerationEventTypeFilter;
  moderationSeverityFilter: ModerationEventSeverityFilter;
  setModerationTypeFilter: (value: ModerationEventTypeFilter) => void;
  setModerationSeverityFilter: (value: ModerationEventSeverityFilter) => void;
  refreshModerationEvents: () => void;
  openModerationEventTarget: (event: any) => void;
  openingModerationEventId: string | null;
  formatDateTime: (value?: string | null) => string;
};

export function ModerationFeedPanel({
  moderationEvents,
  loadingModerationEvents,
  moderationTypeFilter,
  moderationSeverityFilter,
  setModerationTypeFilter,
  setModerationSeverityFilter,
  refreshModerationEvents,
  openModerationEventTarget,
  openingModerationEventId,
  formatDateTime,
}: ModerationFeedPanelProps) {
  return (
    <div>
      <div className={styles.discoveryHeader}>
        <h3>Moderation Feed</h3>
        <span className={styles.unreadBadge}>{moderationEvents.length}</span>
      </div>
      <div className={styles.stateRow}>
        <label className={styles.inlineField}>
          Event type
          <select
            value={moderationTypeFilter}
            onChange={(event) => setModerationTypeFilter(event.target.value as ModerationEventTypeFilter)}
          >
            <option value="all">All types</option>
            <option value="off_platform_attempt">Off-platform</option>
            <option value="fraud_flag">Fraud</option>
            <option value="abuse">Abuse</option>
          </select>
        </label>
        <label className={styles.inlineField}>
          Severity
          <select
            value={moderationSeverityFilter}
            onChange={(event) =>
              setModerationSeverityFilter(event.target.value as ModerationEventSeverityFilter)
            }
          >
            <option value="all">All severities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <button className="button" type="button" onClick={refreshModerationEvents} disabled={loadingModerationEvents}>
          {loadingModerationEvents ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      {loadingModerationEvents ? <p className={styles.status}>Loading moderation events...</p> : null}
      <div className={styles.userList}>
        {moderationEvents.map((event) => {
          const target = getModerationEventTarget({
            metadata: event.metadata,
            sessionId: event.session_id,
          });
          const canOpenConversation = Boolean(target.conversationId);
          return (
            <div key={event.id} className={styles.userRowCard}>
              <div>
                <strong>{event.actor_name}</strong>
                <p>
                  {getModerationTypeLabel(event.type)} · {getModerationSeverityLabel(event.severity)}
                </p>
                <p>{formatDateTime(event.created_at)}</p>
              </div>
              <div className={styles.rowActions}>
                {canOpenConversation ? (
                  <button
                    className="button"
                    type="button"
                    onClick={() => openModerationEventTarget(event)}
                    disabled={openingModerationEventId === event.id}
                  >
                    {openingModerationEventId === event.id ? "Opening..." : "Open chat"}
                  </button>
                ) : null}
                {target.sessionId ? (
                  <a className="button" href={`/tutors/sessions?sessionId=${encodeURIComponent(target.sessionId)}`}>
                    Open session
                  </a>
                ) : null}
                <span
                  className={`${styles.dueTag} ${
                    event.severity === "high"
                      ? styles.dueTagOverdue
                      : event.severity === "medium"
                      ? styles.dueTagSoon
                      : styles.dueTagUpcoming
                  }`}
                >
                  {event.severity.toUpperCase()}
                </span>
              </div>
            </div>
          );
        })}
        {!loadingModerationEvents && moderationEvents.length === 0 ? (
          <p className={styles.status}>No moderation events in this view.</p>
        ) : null}
      </div>
    </div>
  );
}
