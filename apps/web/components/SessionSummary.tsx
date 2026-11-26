import type { SessionSummaryData } from "@/lib/learning/session";

type SessionSummaryProps = {
  summary: SessionSummaryData;
  onSaveRevision?: () => void;
  saving?: boolean;
  saved?: boolean;
};

export function SessionSummary({ summary, onSaveRevision, saving = false, saved = false }: SessionSummaryProps) {
  return (
    <section className="session-summary" aria-labelledby="session-summary-title">
      <div className="session-summary__header">
        <div>
          <span className="eyebrow">Session summary</span>
          <h3 id="session-summary-title">{summary.title}</h3>
          {summary.subject ? <p>{summary.subject}{summary.completedAt ? ` · ${formatDate(summary.completedAt)}` : ""}</p> : null}
        </div>
        <span className="badge">{formatKind(summary.kind)}</span>
      </div>
      <div className="session-summary__grid">
        <div>
          <span className="session-summary__label">What changed</span>
          <ul>{summary.takeaways.map((takeaway) => <li key={takeaway}>{takeaway}</li>)}</ul>
        </div>
        <div className="session-summary__next">
          <span className="session-summary__label">Next action</span>
          <strong>{summary.nextAction}</strong>
        </div>
      </div>
      {summary.evidence.length ? (
        <div className="session-summary__evidence">
          <span className="session-summary__label">Evidence</span>
          <div>{summary.evidence.map((source) => source.href ? <a key={`${source.type}-${source.label}`} href={source.href}>{source.label}</a> : <span key={`${source.type}-${source.label}`}>{source.label}</span>)}</div>
        </div>
      ) : null}
      {onSaveRevision ? <button type="button" className="button button--ghost" onClick={onSaveRevision} disabled={saving || saved}>{saved ? "Saved to revision" : saving ? "Saving…" : "Save this summary"}</button> : null}
    </section>
  );
}

function formatKind(kind: string) {
  return kind.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
