import Link from "next/link";
import type { LearnerWeakness } from "@/lib/learning/weaknesses";

type RecoveryActionCardProps = {
  weakness: LearnerWeakness;
};

export function RecoveryActionCard({ weakness }: RecoveryActionCardProps) {
  const tone = weakness.severity === "focus" ? "recovery-action-card--focus" : "recovery-action-card--watch";

  return (
    <article className={`recovery-action-card ${tone}`}>
      <div className="recovery-action-card__header">
        <div>
          <span className="eyebrow">{weakness.severity === "focus" ? "Recovery priority" : "Keep an eye on this"}</span>
          <h2>{weakness.subject}</h2>
          <p className="recovery-action-card__meta">Grade {weakness.grade} · {weakness.attempts} attempt{weakness.attempts === 1 ? "" : "s"}</p>
        </div>
        <div className="recovery-score" aria-label={`${weakness.score} percent average`}>
          <strong>{weakness.score}%</strong>
          <span>current signal</span>
        </div>
      </div>

      <p className="recovery-action-card__reason">{weakness.reason}</p>
      {weakness.reviewCount > 0 ? (
        <p className="recovery-action-card__review">{weakness.reviewCount} spaced review{weakness.reviewCount === 1 ? "" : "s"} waiting in this area.</p>
      ) : null}

      <div className="recovery-action-card__actions">
        <Link className="button" href={weakness.primaryHref} prefetch={false}>{weakness.primaryLabel}</Link>
        <Link className="button button--ghost" href={weakness.secondaryHref} prefetch={false}>Ask the tutor</Link>
      </div>
    </article>
  );
}
