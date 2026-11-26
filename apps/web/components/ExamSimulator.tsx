"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { API_BASE } from "@/lib/apiBase";
import styles from "./ExamSimulator.module.css";

export type ExamQuestion = {
  id: string;
  prompt: string;
  type: "mcq" | "short_answer";
  options?: string[];
  answer: string;
  explanation: string;
  weekNumber: number;
  termNumber: number;
};

type ExamSimulatorProps = {
  subject: string;
  subjectName: string;
  grade: number;
  phase: string;
  gradeSlug: string;
  questions: ExamQuestion[];
  durationMinutes?: number;
};

type Phase = "intro" | "exam" | "results";

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
}

function keywordOverlap(answer: string, expected: string) {
  const answerTokens = new Set(normalize(answer).split(/\s+/).filter((t) => t.length > 3));
  return normalize(expected).split(/\s+/).filter((t) => t.length > 3).some((t) => answerTokens.has(t));
}

function isCorrect(q: ExamQuestion, value: string) {
  if (q.type === "short_answer") return Boolean(value.trim()) && keywordOverlap(value, q.answer);
  return normalize(value) === normalize(q.answer);
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ExamSimulator({
  subject,
  subjectName,
  grade,
  phase,
  gradeSlug,
  questions,
  durationMinutes = 45,
}: ExamSimulatorProps) {
  const { session } = useSession();
  const [examPhase, setExamPhase] = useState<Phase>("intro");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);
  const [startedAt] = useState(() => Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selected = useMemo(() => {
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(20, shuffled.length));
  }, [questions]);

  const startExam = () => {
    setExamPhase("exam");
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setExamPhase("results");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const submitExam = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setExamPhase("results");
    if (!session || selected.length === 0) return;
    const correctCount = selected.filter((q) => isCorrect(q, answers[q.id] ?? "")).length;
    const scorePercent = Math.round((correctCount / selected.length) * 100);
    const timeSpentSeconds = Math.round((Date.now() - startedAt) / 1000);
    fetch(`${API_BASE}/analytics/quiz-attempt`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "x-csrf-token": session.csrfToken },
      body: JSON.stringify({
        lessonKey: `exam-${subject}-grade${grade}`,
        subject,
        grade,
        scorePercent,
        timeSpentSeconds,
        answersJson: answers,
      }),
    }).catch(() => {});
  }, [answers, grade, selected, session, startedAt, subject]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // ── Results ─────────────────────────────────────────────────────────
  if (examPhase === "results") {
    const correctCount = selected.filter((q) => isCorrect(q, answers[q.id] ?? "")).length;
    const scorePercent = Math.round((correctCount / selected.length) * 100);

    // Group weak questions by term/week
    const weakByWeek: Record<string, ExamQuestion[]> = {};
    for (const q of selected) {
      if (!isCorrect(q, answers[q.id] ?? "")) {
        const key = `Term ${q.termNumber}, Week ${q.weekNumber}`;
        if (!weakByWeek[key]) weakByWeek[key] = [];
        weakByWeek[key].push(q);
      }
    }

    return (
      <div className={styles.results}>
        <div className={styles.scoreCircle} data-pass={scorePercent >= 50 ? "true" : "false"}>
          <span className={styles.scorePct}>{scorePercent}%</span>
          <span className={styles.scoreLabel}>{scorePercent >= 70 ? "Excellent" : scorePercent >= 50 ? "Pass" : "Needs work"}</span>
        </div>

        <p className={styles.scoreSummary}>
          You answered <strong>{correctCount}</strong> out of <strong>{selected.length}</strong> questions correctly.
        </p>

        {Object.keys(weakByWeek).length > 0 && (
          <div className={styles.weakSection}>
            <h3 className={styles.weakTitle}>Review these weeks</h3>
            <div className={styles.weakList}>
              {Object.entries(weakByWeek).map(([key, qs]) => {
                const q = qs[0];
                const weekHref = `/learn/${phase}/${gradeSlug}/${subject}/term/${q.termNumber}/week/${q.weekNumber}`;
                return (
                  <a key={key} href={weekHref} className={styles.weakItem}>
                    <strong>{key}</strong>
                    <span className={styles.weakCount}>{qs.length} missed</span>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        <div className={styles.reviewList}>
          <h3 className={styles.weakTitle}>All questions reviewed</h3>
          {selected.map((q, i) => {
            const userAnswer = answers[q.id] ?? "";
            const correct = isCorrect(q, userAnswer);
            return (
              <div key={q.id} className={styles.reviewItem} data-correct={correct ? "true" : "false"}>
                <div className={styles.reviewQ}>{i + 1}. {q.prompt}</div>
                {!correct && <div className={styles.reviewAnswer}>Correct: {q.answer}</div>}
                <div className={styles.reviewExplanation}>{q.explanation}</div>
              </div>
            );
          })}
        </div>

        <button className={styles.retryBtn} onClick={() => { setAnswers({}); setSecondsLeft(durationMinutes * 60); setExamPhase("intro"); }}>
          Try again
        </button>
      </div>
    );
  }

  // ── Intro ───────────────────────────────────────────────────────────
  if (examPhase === "intro") {
    return (
      <div className={styles.intro}>
        <div className={styles.introIcon}>📝</div>
        <h2 className={styles.introTitle}>{subjectName} Exam Simulation</h2>
        <p className={styles.introDesc}>
          {selected.length} questions drawn from available lessons across all terms.
          You have <strong>{durationMinutes} minutes</strong>. The exam auto-submits when time runs out.
        </p>
        {selected.length === 0 ? (
          <p className={styles.emptyMsg}>
            No lessons have been generated for this subject yet. Check back after content is published.
          </p>
        ) : (
          <button className={styles.startBtn} onClick={startExam}>
            Start exam
          </button>
        )}
      </div>
    );
  }

  // ── Exam ────────────────────────────────────────────────────────────
  const urgent = secondsLeft < 300;
  return (
    <div className={styles.exam}>
      <div className={styles.timerBar}>
        <span className={styles.timerLabel}>Time remaining</span>
        <span className={styles.timer} data-urgent={urgent ? "true" : "false"}>
          {formatTime(secondsLeft)}
        </span>
        <span className={styles.timerProgress}>
          {selected.filter((q) => answers[q.id]).length} / {selected.length} answered
        </span>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); submitExam(); }} className={styles.form}>
        {selected.map((q, i) => (
          <div key={q.id} className={styles.qBlock}>
            <div className={styles.qMeta}>
              <span className={styles.qNum}>Q{i + 1}</span>
              <span className={styles.qWeek}>Term {q.termNumber} · Week {q.weekNumber}</span>
            </div>
            <div className={styles.qPrompt}>{q.prompt}</div>

            {q.type === "mcq" && (
              <div className={styles.options}>
                {q.options?.map((opt) => (
                  <label key={opt} className={styles.option} data-selected={answers[q.id] === opt ? "true" : "false"}>
                    <input type="radio" name={q.id} value={opt} checked={answers[q.id] === opt}
                      onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))} />
                    {opt}
                  </label>
                ))}
              </div>
            )}

            {q.type === "short_answer" && (
              <textarea className={styles.textarea} rows={3} value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                placeholder="Write your answer…" />
            )}
          </div>
        ))}

        <div className={styles.submitRow}>
          <button type="submit" className={styles.submitBtn}>
            Submit exam
          </button>
        </div>
      </form>
    </div>
  );
}
