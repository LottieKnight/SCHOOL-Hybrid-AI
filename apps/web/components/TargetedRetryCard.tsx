"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { TargetedRetrySet } from "@/lib/pastPapers/targetedRetry";
import { RecoveryResultCard } from "@/components/RecoveryResultCard";
import { SessionSummary } from "@/components/SessionSummary";
import type { RecoveryResult } from "@/lib/learning/session";

type TargetedRetryCardProps = {
  retrySet: TargetedRetrySet;
  paperHref: string;
  parentAttemptId: string;
};

type RetryQuestion = TargetedRetrySet["questions"][number];
type RetryComparison = {
  originalPercent: number | null;
  retryPercent: number | null;
  deltaPercent: number | null;
};

export function TargetedRetryCard({ retrySet, paperHref, parentAttemptId }: TargetedRetryCardProps) {
  const [retryAttemptId, setRetryAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [comparison, setComparison] = useState<RetryComparison | null>(null);
  const [savedRevision, setSavedRevision] = useState(false);
  const selectedQuestions = useMemo(() => retrySet.questions, [retrySet.questions]);

  if (!retrySet.questions.length) {
    return (
      <div className="targeted-retry-card targeted-retry-card--empty">
        <span className="eyebrow">Targeted retry</span>
        <strong>More scored evidence needed</strong>
        <p>{retrySet.summary}</p>
      </div>
    );
  }

  const startRetry = async () => {
    setBusy(true);
    setStatus("Preparing your retry workspace…");
    try {
      const response = await fetch("/api/past-papers/attempts/retry/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentAttemptId,
          questionIds: selectedQuestions.map((question) => question.id),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Unable to start retry.");
      setRetryAttemptId(payload.attemptId);
      setStatus("Retry workspace ready. Your answers save with this attempt.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to start retry.");
    } finally {
      setBusy(false);
    }
  };

  const updateAnswer = (questionId: string, value: string) => {
    setAnswers((previous) => ({ ...previous, [questionId]: value }));
  };

  const submitRetry = async () => {
    if (!retryAttemptId) return;
    setBusy(true);
    setStatus("Saving and marking your retry…");
    try {
      const saveResponse = await fetch("/api/past-papers/attempts/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: retryAttemptId,
          answers: selectedQuestions.map((question) => ({
            questionId: question.id,
            answerText: answers[question.id] || "",
            notes: "targeted-retry",
          })),
        }),
      });
      if (!saveResponse.ok) throw new Error("Unable to save retry answers.");
      const submitResponse = await fetch("/api/past-papers/attempts/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: retryAttemptId }),
      });
      const payload = await submitResponse.json().catch(() => null);
      if (!submitResponse.ok) throw new Error(payload?.error || "Unable to mark retry.");
      setComparison(payload.retryComparison ?? null);
      setStatus("Retry marked. Compare the signal below.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to submit retry.");
    } finally {
      setBusy(false);
    }
  };

  const saveRevision = async () => {
    if (!comparison) return;
    setBusy(true);
    setStatus("Saving your revision artifact…");
    try {
      const response = await fetch("/api/learning/revision-artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Recovery: ${retrySet.focusConcept || "targeted retry"}`,
          kind: "targeted_retry",
          subject: retrySet.focusConcept,
          sourceType: "past_paper_attempt",
          sourceId: parentAttemptId,
          takeaways: [
            `Original result: ${formatPercent(comparison.originalPercent)}.`,
            `Focused retry result: ${formatPercent(comparison.retryPercent)}.`,
            `${formatDelta(comparison.deltaPercent)} on the selected concept.`,
          ],
          nextAction: `Review ${retrySet.focusConcept || "this concept"} again during your next study session.`,
          evidence: [{ type: "past_paper_retry", label: retrySet.focusConcept || "Targeted retry" }],
        }),
      });
      if (!response.ok) throw new Error("Unable to save revision artifact.");
      setSavedRevision(true);
      setStatus("Saved to your revision history.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save revision artifact.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="targeted-retry-card">
      <div className="targeted-retry-card__header">
        <div>
          <span className="eyebrow">Phase 3 recovery set</span>
          <h3>Retry the signal, not the whole paper</h3>
          <p>{retrySet.summary}</p>
        </div>
        <span className="badge">{retrySet.missedSignals.length} missed signal{retrySet.missedSignals.length === 1 ? "" : "s"}</span>
      </div>

      {!retryAttemptId ? (
        <>
          <ol className="targeted-retry-list">
            {selectedQuestions.map((question) => <RetryQuestionRow key={question.id} question={question} />)}
          </ol>
          <div className="outline-actions">
            <button className="button" type="button" onClick={() => void startRetry()} disabled={busy}>
              {busy ? "Preparing…" : "Start targeted retry"}
            </button>
            <Link className="button button--ghost" href={`/tutor?topic=${encodeURIComponent(retrySet.focusConcept || "past paper recovery")}`} prefetch={false}>Ask about this concept</Link>
          </div>
        </>
      ) : comparison ? (
        <div className="targeted-retry-result-stack">
          <RecoveryResultCard result={comparison as RecoveryResult} concept={retrySet.focusConcept} />
          <SessionSummary
            summary={{
              title: `Recovery: ${retrySet.focusConcept || "targeted retry"}`,
              kind: "targeted_retry",
              subject: retrySet.focusConcept,
              completedAt: new Date().toISOString(),
              result: comparison,
              evidence: [{ type: "past_paper_retry", label: retrySet.focusConcept || "Targeted retry" }],
              takeaways: [
                `Original result: ${formatPercent(comparison.originalPercent)}.`,
                `Focused retry result: ${formatPercent(comparison.retryPercent)}.`,
                `${formatDelta(comparison.deltaPercent)} on the selected concept.`,
              ],
              nextAction: `Review ${retrySet.focusConcept || "this concept"} again during your next study session.`,
            }}
            onSaveRevision={() => void saveRevision()}
            saving={busy}
            saved={savedRevision}
          />
          <div className="outline-actions"><Link className="button" href="/dashboard/weaknesses" prefetch={false}>Open weakness map</Link><Link className="button button--ghost" href={paperHref} prefetch={false}>Review paper</Link></div>
        </div>
      ) : (
        <>
          <div className="targeted-retry-form">
            {selectedQuestions.map((question) => (
              <label key={question.id}>
                <span><strong>Question {question.qNumber}</strong> · {question.concept}</span>
                <textarea value={answers[question.id] || ""} onChange={(event) => updateAnswer(question.id, event.target.value)} placeholder="Write your answer in your own words…" rows={4} />
              </label>
            ))}
          </div>
          <div className="outline-actions"><button className="button" type="button" onClick={() => void submitRetry()} disabled={busy}>{busy ? "Marking…" : "Submit retry"}</button></div>
        </>
      )}
      {status ? <p className="targeted-retry-status" aria-live="polite">{status}</p> : null}
    </section>
  );
}

function RetryQuestionRow({ question }: { question: RetryQuestion }) {
  return <li><div><strong>Question {question.qNumber}</strong><span>{question.concept} · {question.scorePercent}%</span></div><small>{question.selectionReason}</small></li>;
}

function formatPercent(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value)}%` : "n/a";
}

function formatDelta(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "No comparable baseline was available.";
  return `${value >= 0 ? "+" : ""}${value.toFixed(0)} percentage points`;
}
