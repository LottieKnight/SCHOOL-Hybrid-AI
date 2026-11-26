"use client";

import { useCallback, useMemo, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { API_BASE } from "@/lib/apiBase";
import styles from "./AdaptivePractice.module.css";

export type PracticeQuestion = {
  id: string;
  prompt: string;
  type: "mcq" | "short_answer";
  options?: string[];
  answer: string;
  explanation: string;
  weekNumber: number;
  termNumber: number;
  difficulty: "easy" | "medium" | "hard";
};

type Props = {
  subject: string;
  subjectName: string;
  grade: number;
  phase: string;
  gradeSlug: string;
  questions: PracticeQuestion[];
};

type QuestionResult = { correct: boolean; answer: string };

function normalize(t: string) { return t.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim(); }
function keywordOverlap(a: string, b: string) {
  const s = new Set(normalize(a).split(/\s+/).filter((t) => t.length > 3));
  return normalize(b).split(/\s+/).filter((t) => t.length > 3).some((t) => s.has(t));
}
function isCorrect(q: PracticeQuestion, value: string) {
  if (q.type === "short_answer") return Boolean(value.trim()) && keywordOverlap(value, q.answer);
  return normalize(value) === normalize(q.answer);
}

const difficultyOrder: Record<string, number> = { easy: 0, medium: 1, hard: 2 };

export function AdaptivePractice({ subject, subjectName, grade, phase, gradeSlug, questions }: Props) {
  const { session } = useSession();

  // Adaptive state: track consecutive correct/wrong to shift difficulty
  const [streak, setStreak] = useState(0); // positive = correct streak, negative = wrong streak
  const [currentDifficulty, setCurrentDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [answered, setAnswered] = useState<Record<string, QuestionResult>>({});
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);

  // Queue: shuffle by current difficulty preference
  const queue = useMemo(() => {
    const target = questions.filter((q) => q.difficulty === currentDifficulty);
    const others = questions.filter((q) => q.difficulty !== currentDifficulty);
    const unanswered = (arr: PracticeQuestion[]) => arr.filter((q) => !answered[q.id]);
    const result = [...unanswered(target), ...unanswered(others)];
    return result.sort(() => Math.random() - 0.5);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDifficulty, questions]);

  const unansweredQueue = queue.filter((q) => !answered[q.id]);
  const currentQ = unansweredQueue[0] ?? null;

  const submitAnswer = useCallback(() => {
    if (!currentQ || !currentAnswer.trim()) return;
    const correct = isCorrect(currentQ, currentAnswer);
    setAnswered((prev) => ({ ...prev, [currentQ.id]: { correct, answer: currentAnswer } }));
    setRevealed(true);

    // Adapt difficulty: 3 correct in a row → increase, 2 wrong in a row → decrease
    const newStreak = correct ? Math.max(0, streak) + 1 : Math.min(0, streak) - 1;
    setStreak(newStreak);

    const diffLevel = difficultyOrder[currentDifficulty];
    if (newStreak >= 3 && diffLevel < 2) {
      setCurrentDifficulty(["easy", "medium", "hard"][diffLevel + 1] as "easy" | "medium" | "hard");
      setStreak(0);
    } else if (newStreak <= -2 && diffLevel > 0) {
      setCurrentDifficulty(["easy", "medium", "hard"][diffLevel - 1] as "easy" | "medium" | "hard");
      setStreak(0);
    }

    if (session) {
      const answeredCount = Object.keys(answered).length + 1;
      const correctCount = Object.values(answered).filter((r) => r.correct).length + (correct ? 1 : 0);
      fetch(`${API_BASE}/analytics/quiz-attempt`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "x-csrf-token": session.csrfToken },
        body: JSON.stringify({
          lessonKey: `practice-${subject}-grade${grade}`,
          subject, grade,
          scorePercent: Math.round((correctCount / answeredCount) * 100),
          timeSpentSeconds: 0,
          answersJson: { [currentQ.id]: currentAnswer },
        }),
      }).catch(() => {});
    }
  }, [answered, currentAnswer, currentDifficulty, currentQ, grade, session, streak, subject]);

  const nextQuestion = () => {
    setCurrentAnswer("");
    setRevealed(false);
    if (unansweredQueue.length <= 1) setDone(true);
  };

  const totalAnswered = Object.keys(answered).length;
  const totalCorrect = Object.values(answered).filter((r) => r.correct).length;

  if (questions.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>⚡</div>
        <p>No lessons generated yet for this subject. Practice questions will appear here once content is published.</p>
      </div>
    );
  }

  if (done || !currentQ) {
    const pct = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
    return (
      <div className={styles.done}>
        <div className={styles.doneIcon}>🎉</div>
        <h2 className={styles.doneTitle}>Practice complete!</h2>
        <p className={styles.doneSummary}>{totalCorrect} / {totalAnswered} correct — {pct}%</p>
        <button className={styles.restartBtn} onClick={() => { setAnswered({}); setStreak(0); setCurrentDifficulty("medium"); setDone(false); setRevealed(false); setCurrentAnswer(""); }}>
          Practice again
        </button>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.progress}>
          <span>{totalAnswered} answered</span>
          <span className={styles.progressDot} />
          <span>{totalCorrect} correct</span>
        </div>
        <span className={styles.diffBadge} data-diff={currentDifficulty}>{currentDifficulty}</span>
      </div>

      <div className={styles.card}>
        <div className={styles.cardMeta}>
          Term {currentQ.termNumber} · Week {currentQ.weekNumber}
        </div>
        <div className={styles.prompt}>{currentQ.prompt}</div>

        {currentQ.type === "mcq" && !revealed && (
          <div className={styles.options}>
            {currentQ.options?.map((opt) => (
              <button
                key={opt}
                type="button"
                className={styles.option}
                data-selected={currentAnswer === opt ? "true" : "false"}
                onClick={() => setCurrentAnswer(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {currentQ.type === "short_answer" && !revealed && (
          <textarea className={styles.textarea} rows={3} value={currentAnswer}
            onChange={(e) => setCurrentAnswer(e.target.value)} placeholder="Your answer…" />
        )}

        {revealed && (
          <div className={styles.feedback} data-correct={isCorrect(currentQ, currentAnswer) ? "true" : "false"}>
            <div className={styles.feedbackIcon}>{isCorrect(currentQ, currentAnswer) ? "✓" : "✗"}</div>
            <div>
              <strong>Correct answer:</strong> {currentQ.answer}
              <p className={styles.explanation}>{currentQ.explanation}</p>
            </div>
          </div>
        )}
      </div>

      <div className={styles.actions}>
        {!revealed ? (
          <button className={styles.submitBtn} onClick={submitAnswer} disabled={!currentAnswer.trim()}>
            Check answer
          </button>
        ) : (
          <button className={styles.nextBtn} onClick={nextQuestion}>
            Next question →
          </button>
        )}
      </div>
    </div>
  );
}
