import { buildReadinessEvidence, type ReadinessEvidence } from "@/lib/learning/evidence";

type ReadinessEvidenceCardProps = {
  scores?: Array<{ score_percent: number }>;
  dueReviews?: Array<{ status?: string; id?: string }>;
  recommendations?: Array<{ avgScore: number; subject: string }>;
  compact?: boolean;
};

function EvidenceCard({ evidence, compact }: { evidence: ReadinessEvidence; compact: boolean }) {
  return (
    <section className={`readiness-evidence-card${compact ? " readiness-evidence-card--compact" : ""}`} aria-labelledby="readiness-evidence-title">
      <div className="readiness-evidence-card__topline">
        <div>
          <span className="eyebrow">Evidence, not vibes</span>
          <h2 id="readiness-evidence-title">{evidence.headline}</h2>
          <p>{evidence.explanation}</p>
        </div>
        <div className={`readiness-score readiness-score--${evidence.band}`} aria-label={`Readiness score ${evidence.score} out of 100`}>
          <strong>{evidence.score}</strong>
          <span>/100</span>
          <small>{evidence.bandLabel}</small>
        </div>
      </div>
      <div className="readiness-evidence-grid">
        {evidence.signals.map((signal) => (
          <div className={`readiness-evidence-signal readiness-evidence-signal--${signal.tone}`} key={signal.label}>
            <span>{signal.label}</span>
            <strong>{signal.value}</strong>
            <small>{signal.detail}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ReadinessEvidenceCard({ scores, dueReviews, recommendations, compact = false }: ReadinessEvidenceCardProps) {
  const evidence = buildReadinessEvidence({ scores, dueReviews, recommendations });
  return <EvidenceCard evidence={evidence} compact={compact} />;
}
