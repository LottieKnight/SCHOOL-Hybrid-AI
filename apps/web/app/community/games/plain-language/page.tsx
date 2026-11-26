"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import styles from "./page.module.css";

const TEXTS = [
  {
    source: "NWU Regulation",
    original:
      "Notwithstanding any provision contained herein, a registered student who fails to fulfil the financial obligations contemplated in terms of this regulation within the prescribed period, and who has not obtained written dispensation from the Registrar, shall ipso facto be excluded from the institutional roll with immediate effect, subject to reinstatement upon full settlement of all outstanding amounts and applicable reinstatement fees.",
  },
  {
    source: "SARS Notice",
    original:
      "In terms of section 89(2) of the Income Tax Act 58 of 1962, as amended, any natural person who derives income from a source within the Republic and who fails to submit a return of income in respect of any year of assessment by the date specified in the notice issued by the Commissioner in terms of section 89(1), shall be liable to a penalty as prescribed in the Fourth Schedule to this Act, unless such person can demonstrate, to the satisfaction of the Commissioner, that the failure was attributable to circumstances beyond the reasonable control of the taxpayer.",
  },
  {
    source: "NSFAS Bursary Clause",
    original:
      "The bursary recipient acknowledges and agrees that in the event of non-compliance with the academic performance requirements as stipulated in Schedule A hereto, or in the event that the recipient is found to have submitted materially false or misleading information in the application process, the full amount disbursed shall become immediately repayable as a loan, attracting interest at the prescribed rate from the date of original disbursement, and the recipient hereby irrevocably consents to administrative measures being taken to recover such amounts from any future government grants or allowances.",
  },
  {
    source: "Bank T&C Clause",
    original:
      "The account holder expressly acknowledges that the Bank reserves the unilateral right to vary any of the terms and conditions set out herein at any time and for any reason, including but not limited to changes in regulatory requirements, market conditions, or internal policy considerations, provided that the Bank shall notify the account holder of any such variation by means of a notification displayed on the Bank's official digital banking platform no less than thirty (30) calendar days prior to the effective date of such variation, and continued use of the account following such notification shall constitute irrevocable acceptance of the varied terms.",
  },
  {
    source: "Government Gazette",
    original:
      "No person shall, within the defined boundaries of a proclaimed municipal area, conduct, facilitate, or otherwise engage in any activity of a commercial or quasi-commercial nature on any public open space, street, pavement, or road reserve, as defined in the by-laws of the relevant local municipality, without first having obtained a written permit issued by the duly authorised officer of the municipality, subject to such conditions as the municipality may from time to time determine, and failure to comply with the provisions of this regulation shall render the offender liable to a fine not exceeding the amount prescribed in Annexure B.",
  },
];

const ROUND_SECONDS = 90;
const PARTICIPATION_SCORE = 30;

type Phase = "idle" | "typing" | "scoring" | "result" | "done";

type RoundResult = {
  source: string;
  original: string;
  rewrite: string;
  clarity: number;
  accuracy: number;
  conciseness: number;
  feedback: string;
  roundScore: number;
  fallback: boolean;
};

export default function PlainLanguagePage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [roundIdx, setRoundIdx] = useState(0);
  const [rewrite, setRewrite] = useState("");
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const text = TEXTS[roundIdx];

  const submitRewrite = useCallback(async (rw: string) => {
    setPhase("scoring");

    let clarity = 0, accuracy = 0, conciseness = 0;
    let feedback = "";
    let fallback = false;

    try {
      const res = await fetch("/api/games/score-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameType: "plain_language", original: text.original, rewrite: rw }),
      });
      const data = (await res.json()) as {
        scores?: { clarity?: number; accuracy?: number; conciseness?: number; feedback?: string };
        fallback?: boolean;
      };

      if (data.fallback || !data.scores) {
        fallback = true;
        clarity = accuracy = conciseness = 10 / 3;
        feedback = "AI scoring is temporarily unavailable — participation credit awarded.";
      } else {
        clarity = Math.min(10, Math.max(0, Number(data.scores.clarity ?? 5)));
        accuracy = Math.min(10, Math.max(0, Number(data.scores.accuracy ?? 5)));
        conciseness = Math.min(10, Math.max(0, Number(data.scores.conciseness ?? 5)));
        feedback = data.scores.feedback ?? "";
      }
    } catch {
      fallback = true;
      clarity = accuracy = conciseness = 10 / 3;
      feedback = "AI scoring is temporarily unavailable — participation credit awarded.";
    }

    const roundScore = fallback
      ? PARTICIPATION_SCORE
      : Math.round((clarity + accuracy + conciseness) * (10 / 3));

    const result: RoundResult = {
      source: text.source,
      original: text.original,
      rewrite: rw,
      clarity: Math.round(clarity),
      accuracy: Math.round(accuracy),
      conciseness: Math.round(conciseness),
      feedback,
      roundScore,
      fallback,
    };

    setResults((prev) => [...prev, result]);
    setTotalScore((s) => s + roundScore);
    setPhase("result");
  }, [text]);

  useEffect(() => {
    if (phase !== "typing") return;
    if (timeLeft <= 0) {
      submitRewrite(rewrite || "(no rewrite submitted)");
      return;
    }
    const id = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [phase, timeLeft, rewrite, submitRewrite]);

  const startGame = () => {
    setRoundIdx(0); setRewrite(""); setTimeLeft(ROUND_SECONDS);
    setResults([]); setTotalScore(0); setSubmitted(false);
    setPhase("typing");
  };

  const nextRound = async () => {
    const next = roundIdx + 1;
    if (next >= TEXTS.length) {
      setPhase("done");
      const final = results.reduce((a, r) => a + r.roundScore, 0);
      if (!submitted) {
        setSubmitted(true);
        await fetch("/api/games/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameType: "plain_language",
            score: final,
            metadata: { rounds: TEXTS.length },
          }),
        }).catch(() => {});
      }
    } else {
      setRoundIdx(next);
      setRewrite("");
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
            <h1>Plain Language Rewriter</h1>
            <p className="subtitle">5 chunks of dense legal and bureaucratic text. Rewrite them in plain English. AI scores clarity, accuracy, and conciseness.</p>
            <div className={styles.howTo}>
              <h3>How to play</h3>
              <ul>
                <li>A complex official text appears. Read it carefully.</li>
                <li>Rewrite it in plain, simple English — preserving the meaning.</li>
                <li>You have 90 seconds per chunk.</li>
                <li>AI scores Clarity (did it simplify?), Accuracy (did it preserve meaning?), and Conciseness (is it tighter?).</li>
                <li>Max 100 points per round.</li>
              </ul>
            </div>
            <button className="button" onClick={startGame}>Start game</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "typing") {
    const timerClass = timeLeft <= 20 ? `${styles.timer} ${styles.timerUrgent}` : styles.timer;
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.header}>
            <span className={styles.round}>Round {roundIdx + 1} / {TEXTS.length}</span>
            <span className={timerClass}>{timeLeft}s</span>
            <span className={styles.score}>{totalScore} pts</span>
          </div>
          <div className={styles.original}>
            <span className={styles.originalLabel}>{text.source} — Original text</span>
            {text.original}
          </div>
          <textarea
            className={styles.textarea}
            placeholder="Rewrite this in plain English…"
            value={rewrite}
            onChange={(e) => setRewrite(e.target.value)}
            maxLength={600}
            autoFocus
          />
          <p className={styles.charCount}>{rewrite.length} / 600 characters</p>
          <button className="button" onClick={() => submitRewrite(rewrite)} disabled={rewrite.trim().length < 10}>
            Submit rewrite
          </button>
        </div>
      </div>
    );
  }

  if (phase === "scoring") {
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <p className={styles.loading}>Evaluating your rewrite…</p>
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
            <span className={styles.round}>Round {roundIdx + 1} / {TEXTS.length}</span>
            <span className={styles.score}>+{last.roundScore} this round · {totalScore} total</span>
          </div>
          {last.fallback ? (
            <div className={styles.fallback}>{last.feedback}</div>
          ) : (
            <>
              <div className={styles.scoring}>
                {[
                  { dim: "Clarity", val: last.clarity },
                  { dim: "Accuracy", val: last.accuracy },
                  { dim: "Conciseness", val: last.conciseness },
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
            {roundIdx + 1 < TEXTS.length ? "Next text →" : "See final score"}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const max = TEXTS.length * 100;
    const pct = Math.round((totalScore / max) * 100);
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.done}>
            <h1>
              {totalScore >= 400 ? "Plain Language Expert" : totalScore >= 280 ? "Clear Communicator" : "Keep Simplifying"}
            </h1>
            <p className={styles.finalScore}>{totalScore} / {max} · {pct}%</p>
            <p className="subtitle">
              Plain language writing is a professional skill that makes legal, financial, and government documents accessible to everyone. In South Africa, the Plain Language Act requires clarity in consumer-facing documents.
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
