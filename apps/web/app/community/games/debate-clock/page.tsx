"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import styles from "./page.module.css";

const STATEMENTS = [
  "Load-shedding benefits no one in South Africa.",
  "Gap years are a waste of time for most students.",
  "Social media makes students less empathetic.",
  "NSFAS funding should be merit-based, not needs-based.",
  "Remote work harms team culture and collaboration.",
];

const ROUND_SECONDS = 45;
const PARTICIPATION_SCORE = 30;

type Phase = "idle" | "typing" | "scoring" | "result" | "done";

type RoundResult = {
  statement: string;
  argument: string;
  relevance: number;
  evidence: number;
  clarity: number;
  feedback: string;
  roundScore: number;
  fallback: boolean;
};

export default function DebateClockPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [roundIdx, setRoundIdx] = useState(0);
  const [argument, setArgument] = useState("");
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const submitArgument = useCallback(async (arg: string) => {
    setPhase("scoring");
    const statement = STATEMENTS[roundIdx];

    let relevance = 0, evidence = 0, clarity = 0;
    let feedback = "";
    let fallback = false;

    try {
      const res = await fetch("/api/games/score-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameType: "debate_clock", statement, argument: arg }),
      });
      const data = (await res.json()) as {
        scores?: { relevance?: number; evidence?: number; clarity?: number; feedback?: string };
        fallback?: boolean;
      };

      if (data.fallback || !data.scores) {
        fallback = true;
        relevance = evidence = clarity = 10 / 3;
        feedback = "AI scoring is temporarily unavailable — participation credit awarded.";
      } else {
        relevance = Math.min(10, Math.max(0, Number(data.scores.relevance ?? 5)));
        evidence = Math.min(10, Math.max(0, Number(data.scores.evidence ?? 5)));
        clarity = Math.min(10, Math.max(0, Number(data.scores.clarity ?? 5)));
        feedback = data.scores.feedback ?? "";
      }
    } catch {
      fallback = true;
      relevance = evidence = clarity = 10 / 3;
      feedback = "AI scoring is temporarily unavailable — participation credit awarded.";
    }

    const roundScore = fallback
      ? PARTICIPATION_SCORE
      : Math.round((relevance + evidence + clarity) * (10 / 3));

    const result: RoundResult = {
      statement,
      argument: arg,
      relevance: Math.round(relevance),
      evidence: Math.round(evidence),
      clarity: Math.round(clarity),
      feedback,
      roundScore,
      fallback,
    };

    setResults((prev) => [...prev, result]);
    setTotalScore((s) => s + roundScore);
    setPhase("result");
  }, [roundIdx]);

  useEffect(() => {
    if (phase !== "typing") return;
    if (timeLeft <= 0) {
      submitArgument(argument || "(no argument submitted)");
      return;
    }
    const id = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [phase, timeLeft, argument, submitArgument]);

  const startGame = () => {
    setRoundIdx(0); setArgument(""); setTimeLeft(ROUND_SECONDS);
    setResults([]); setTotalScore(0); setSubmitted(false);
    setPhase("typing");
  };

  const nextRound = async () => {
    const next = roundIdx + 1;
    if (next >= STATEMENTS.length) {
      setPhase("done");
      const final = results.reduce((a, r) => a + r.roundScore, 0);
      if (!submitted) {
        setSubmitted(true);
        await fetch("/api/games/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameType: "debate_clock",
            score: final,
            metadata: { rounds: STATEMENTS.length, avgScore: Math.round(final / STATEMENTS.length) },
          }),
        }).catch(() => {});
      }
    } else {
      setRoundIdx(next);
      setArgument("");
      setTimeLeft(ROUND_SECONDS);
      setPhase("typing");
    }
  };

  if (phase === "idle") {
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.intro}>
            <Link className="button" href="/community/games">← Games</Link>
            <h1>Debate Clock</h1>
            <p className="subtitle">5 provocative statements. 45 seconds each. Type the strongest counter-argument you can. AI scores your reasoning.</p>
            <div className={styles.howTo}>
              <h3>How to play</h3>
              <ul>
                <li>A statement appears — argue against it.</li>
                <li>You have 45 seconds to type your counter-argument.</li>
                <li>AI scores Relevance, Evidence quality, and Clarity (each 0–10).</li>
                <li>Max 100 points per round · 500 total.</li>
                <li>If AI is unavailable, you still earn participation credit.</li>
              </ul>
            </div>
            <button className="button" onClick={startGame}>Start game</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "typing") {
    const timerClass = timeLeft <= 10 ? `${styles.timer} ${styles.timerUrgent}` : styles.timer;
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.header}>
            <span className={styles.round}>Round {roundIdx + 1} / {STATEMENTS.length}</span>
            <span className={timerClass}>{timeLeft}s</span>
            <span className={styles.score}>{totalScore} pts</span>
          </div>
          <div className={styles.statement}>
            <span className={styles.statementLabel}>Statement to argue against</span>
            {STATEMENTS[roundIdx]}
          </div>
          <textarea
            className={styles.textarea}
            placeholder="Type your counter-argument here…"
            value={argument}
            onChange={(e) => setArgument(e.target.value)}
            maxLength={800}
            autoFocus
          />
          <p className={styles.charCount}>{argument.length} / 800 characters</p>
          <button className="button" onClick={() => submitArgument(argument)} disabled={argument.trim().length < 10}>
            Submit argument
          </button>
        </div>
      </div>
    );
  }

  if (phase === "scoring") {
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <p className={styles.loading}>Evaluating your argument…</p>
        </div>
      </div>
    );
  }

  if (phase === "result") {
    const last = results[results.length - 1];
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.header}>
            <span className={styles.round}>Round {roundIdx + 1} / {STATEMENTS.length}</span>
            <span className={styles.score}>+{last.roundScore} this round · {totalScore} total</span>
          </div>
          <div className={styles.statement}>
            <span className={styles.statementLabel}>Statement</span>
            {last.statement}
          </div>
          {last.fallback ? (
            <div className={styles.fallback}>{last.feedback}</div>
          ) : (
            <>
              <div className={styles.scoring}>
                {[
                  { dim: "Relevance", val: last.relevance },
                  { dim: "Evidence", val: last.evidence },
                  { dim: "Clarity", val: last.clarity },
                ].map(({ dim, val }) => (
                  <div key={dim} className={styles.scoreRow}>
                    <span className={styles.scoreDim}>{dim}</span>
                    <span className={styles.scoreVal}>{val} / 10</span>
                  </div>
                ))}
              </div>
              <div className={styles.feedback}>{last.feedback}</div>
            </>
          )}
          <button className="button" onClick={nextRound}>
            {roundIdx + 1 < STATEMENTS.length ? "Next statement →" : "See final score"}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const max = STATEMENTS.length * 100;
    const pct = Math.round((totalScore / max) * 100);
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.done}>
            <h1>
              {totalScore >= 400 ? "Master Debater" : totalScore >= 280 ? "Strong Thinker" : "Keep Arguing"}
            </h1>
            <p className={styles.finalScore}>{totalScore} / {max} · {pct}%</p>
            <p className="subtitle">
              Critical thinking is evaluated on how well you use evidence, not just how confident you sound.
              {totalScore >= 400 ? " Your arguments were consistently well-reasoned and clear." : " Focus on citing evidence and making your logic explicit."}
            </p>
            <div className={styles.doneActions}>
              <button className="button" onClick={startGame}>Play again</button>
              <Link className="button" href="/community/games">All games</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
