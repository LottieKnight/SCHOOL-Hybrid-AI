import type { RecoveryResult } from "@/lib/learning/session";

type RecoveryResultCardProps = {
  result: RecoveryResult;
  concept?: string | null;
};

export function RecoveryResultCard({ result, concept }: RecoveryResultCardProps) {
  const delta = result.deltaPercent;
  const improved = typeof delta === "number" && delta > 0;
  const regressed = typeof delta === "number" && delta < 0;
  const tone = improved ? "positive" : regressed ? "caution" : "steady";

  return (
    <section className={`recovery-result-card recovery-result-card--${tone}`} aria-labelledby="recovery-result-title">
      <div className="recovery-result-card__eyebrow">
        <span className="eyebrow">Recovery result</span>
        <span className="badge">{improved ? "Concept moved" : regressed ? "Keep working" : "Signal captured"}</span>
      </div>
      <div className="recovery-result-card__headline">
        <div>
          <h4 id="recovery-result-title">{formatPercent(result.retryPercent)} on the retry</h4>
          <p>{concept ? `Focused on ${concept}.` : "Focused practice compared with your original attempt."}</p>
        </div>
        <strong className="recovery-result-card__delta">{formatDelta(delta)}</strong>
      </div>
      <div className="recovery-result-card__comparison" aria-label="Original and retry score comparison">
        <div><span>Original</span><strong>{formatPercent(result.originalPercent)}</strong></div>
        <div className="recovery-result-card__track" aria-hidden="true"><span style={{ width: `${clamp(result.originalPercent)}%` }} /><span style={{ width: `${clamp(result.retryPercent)}%` }} /></div>
        <div><span>Retry</span><strong>{formatPercent(result.retryPercent)}</strong></div>
      </div>
    </section>
  );
}

function clamp(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}

function formatPercent(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value)}%` : "n/a";
}

function formatDelta(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "No baseline";
  return `${value >= 0 ? "+" : ""}${value.toFixed(0)} pts`;
}
