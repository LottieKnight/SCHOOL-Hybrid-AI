"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

type Question = {
  id: string;
  question: string;
  subject: string;
  difficulty: number;
  options: string[];
  correctIndex: number;
};

type Phase = "lobby" | "playing" | "result";

const SUBJECTS = [
  "Any subject",
  "Mathematics",
  "Physical Sciences",
  "Life Sciences",
  "Accounting",
  "Economics",
  "History",
  "Geography",
  "Business Studies",
  "English",
];

const TIME_PER_Q = 15;
const BONUS_THRESHOLD = 5;
const TOTAL_QUESTIONS = 10;

function DifficultyDots({ level }: { level: number }) {
  return (
    <span className={styles.diffDots} aria-label={`Difficulty ${level} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= level ? styles.dotFilled : styles.dotEmpty} />
      ))}
    </span>
  );
}

function TimerBar({ seconds, total }: { seconds: number; total: number }) {
  const pct = (seconds / total) * 100;
  const danger = pct <= 33;
  return (
    <div className={styles.timerTrack}>
      <div
        className={`${styles.timerBar} ${danger ? styles.timerDanger : ""}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function QuizRushClient() {
  const [phase, setPhase] = useState<Phase>("lobby");
  const [subject, setSubject] = useState("Any subject");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [bonusPoints, setBonusPoints] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_Q);
  const [loading, setLoading] = useState(false);
  const [creditsEarned, setCreditsEarned] = useState<number | null>(null);
  const [perQResult, setPerQResult] = useState<("correct" | "wrong" | "timeout")[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentQ = questions[qIndex] ?? null;

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const advanceQuestion = useCallback(
    (result: "correct" | "wrong" | "timeout") => {
      stopTimer();
      setPerQResult((prev) => [...prev, result]);

      if (qIndex + 1 >= TOTAL_QUESTIONS || qIndex + 1 >= questions.length) {
        setPhase("result");
        return;
      }

      setTimeout(() => {
        setQIndex((i) => i + 1);
        setSelected(null);
        setRevealed(false);
        setTimeLeft(TIME_PER_Q);
      }, 900);
    },
    [qIndex, questions.length, stopTimer]
  );

  const handleSelect = useCallback(
    (idx: number) => {
      if (revealed || selected !== null) return;
      setSelected(idx);
      setRevealed(true);
      stopTimer();

      const correct = idx === currentQ?.correctIndex;
      const bonus = timeLeft > BONUS_THRESHOLD ? 1 : 0;

      if (correct) {
        setScore((s) => s + 1);
        setBonusPoints((b) => b + bonus);
      }

      setTimeout(() => {
        advanceQuestion(correct ? "correct" : "wrong");
      }, 800);
    },
    [revealed, selected, currentQ, timeLeft, stopTimer, advanceQuestion]
  );

  // Timer tick
  useEffect(() => {
    if (phase !== "playing" || revealed) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          setRevealed(true);
          setTimeout(() => advanceQuestion("timeout"), 800);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return stopTimer;
  }, [phase, qIndex, revealed, stopTimer, advanceQuestion]);

  const startGame = useCallback(async () => {
    setLoading(true);
    setScore(0);
    setBonusPoints(0);
    setQIndex(0);
    setSelected(null);
    setRevealed(false);
    setPerQResult([]);
    setCreditsEarned(null);
    setTimeLeft(TIME_PER_Q);

    const subjectParam = subject === "Any subject" ? "" : `&subject=${encodeURIComponent(subject)}`;
    const res = await fetch(`/api/community/exam-dash?count=${TOTAL_QUESTIONS}${subjectParam}`).catch(() => null);
    const data = (res?.ok ? await res.json().catch(() => null) : null) as { questions?: Question[] } | null;
    const qs = data?.questions ?? [];

    setLoading(false);
    if (qs.length === 0) return;
    setQuestions(qs);
    setPhase("playing");
  }, [subject]);

  // Submit score after game ends
  useEffect(() => {
    if (phase !== "result" || creditsEarned !== null) return;
    void (async () => {
      const res = await fetch("/api/community/exam-dash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, total: questions.length }),
      }).catch(() => null);
      const data = (res?.ok ? await res.json().catch(() => null) : null) as { creditsEarned?: number } | null;
      setCreditsEarned(data?.creditsEarned ?? 0);
    })();
  }, [phase, creditsEarned, score, questions.length]);

  if (phase === "lobby") {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <Link href="/community/games" className={styles.backLink}>← Games Center</Link>
          <span className={styles.badge}>⚡ QUIZ RUSH</span>
        </div>

        <div className={styles.lobby}>
          <div className={styles.lobbyHero}>
            <div className={styles.lobbyEmoji}>⚡</div>
            <h1 className={styles.lobbyTitle}>Quiz Rush</h1>
            <p className={styles.lobbySub}>
              10 questions · 15 seconds each · earn Scholar Credits
            </p>
          </div>

          <div className={styles.lobbyCard}>
            <label className={styles.lobbyLabel} htmlFor="subject-select">
              Pick your subject
            </label>
            <select
              id="subject-select"
              className={styles.subjectSelect}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <div className={styles.rulesGrid}>
              <div className={styles.ruleItem}>
                <span className={styles.ruleIcon}>⏱</span>
                <span>15s per question</span>
              </div>
              <div className={styles.ruleItem}>
                <span className={styles.ruleIcon}>⚡</span>
                <span>Bonus for fast answers</span>
              </div>
              <div className={styles.ruleItem}>
                <span className={styles.ruleIcon}>🪙</span>
                <span>Earn Scholar Credits</span>
              </div>
              <div className={styles.ruleItem}>
                <span className={styles.ruleIcon}>🎯</span>
                <span>4 options per question</span>
              </div>
            </div>

            <button
              className={`${styles.startBtn} button skeu-btn`}
              onClick={() => void startGame()}
              disabled={loading}
            >
              {loading ? "Loading questions…" : "Start Dash →"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "result") {
    const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
    const grade =
      pct >= 90 ? "Outstanding!" : pct >= 75 ? "Great work!" : pct >= 50 ? "Good effort!" : "Keep practising!";

    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <Link href="/community/games" className={styles.backLink}>← Games Center</Link>
          <span className={styles.badge}>⚡ QUIZ RUSH</span>
        </div>

        <div className={styles.result}>
          <div className={styles.resultScore}>
            <span className={styles.resultPct}>{pct}%</span>
            <span className={styles.resultRaw}>{score}/{questions.length} correct</span>
            <span className={styles.resultGrade}>{grade}</span>
          </div>

          <div className={styles.resultRow}>
            {perQResult.map((r, i) => (
              <span
                key={i}
                className={`${styles.resultDot} ${
                  r === "correct" ? styles.resultCorrect : r === "wrong" ? styles.resultWrong : styles.resultTimeout
                }`}
                title={r === "correct" ? "Correct" : r === "timeout" ? "Timed out" : "Wrong"}
              />
            ))}
          </div>

          {bonusPoints > 0 && (
            <p className={styles.bonusBadge}>+{bonusPoints} quick-answer bonus{bonusPoints !== 1 ? "es" : ""} ⚡</p>
          )}

          {creditsEarned === null ? (
            <p className={styles.creditsLoading}>Calculating credits…</p>
          ) : creditsEarned > 0 ? (
            <p className={styles.creditsEarned}>+{creditsEarned} Scholar Credits earned 🪙</p>
          ) : (
            <p className={styles.creditsNote}>Score higher to earn Scholar Credits next time!</p>
          )}

          <div className={styles.resultActions}>
            <button className={`${styles.startBtn} button skeu-btn`} onClick={() => void startGame()}>
              Play Again →
            </button>
            <Link href="/community/games" className={`button ${styles.homeBtn}`}>
              Back to Games
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Playing phase
  if (!currentQ) return null;

  const totalInGame = Math.min(questions.length, TOTAL_QUESTIONS);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.progress}>
            {qIndex + 1} / {totalInGame}
          </span>
          <span className={styles.scorePill}>Score: {score}</span>
        </div>
        <span className={styles.badge}>⚡ QUIZ RUSH</span>
      </div>

      <div className={styles.game}>
        <div className={styles.timerRow}>
          <TimerBar seconds={timeLeft} total={TIME_PER_Q} />
          <span className={`${styles.timerNum} ${timeLeft <= 5 ? styles.timerNumDanger : ""}`}>{timeLeft}s</span>
        </div>

        <div className={styles.qMeta}>
          <span className={styles.subjectPill}>{currentQ.subject}</span>
          <DifficultyDots level={currentQ.difficulty} />
        </div>

        <p className={styles.questionText}>{currentQ.question}</p>

        <div className={styles.optionsGrid}>
          {currentQ.options.map((opt, i) => {
            let cls = styles.optionBtn;
            if (revealed) {
              if (i === currentQ.correctIndex) cls = `${styles.optionBtn} ${styles.optionCorrect}`;
              else if (i === selected) cls = `${styles.optionBtn} ${styles.optionWrong}`;
              else cls = `${styles.optionBtn} ${styles.optionDimmed}`;
            }
            return (
              <button
                key={i}
                className={cls}
                onClick={() => handleSelect(i)}
                disabled={revealed}
              >
                <span className={styles.optionLetter}>{String.fromCharCode(65 + i)}</span>
                <span className={styles.optionText}>{opt}</span>
              </button>
            );
          })}
        </div>

        {revealed && timeLeft === 0 && selected === null && (
          <p className={styles.timeoutMsg}>Time's up! The correct answer was {String.fromCharCode(65 + currentQ.correctIndex)}.</p>
        )}
      </div>
    </div>
  );
}
