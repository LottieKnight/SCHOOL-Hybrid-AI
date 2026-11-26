"use client";

import { useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { API_BASE } from "@/lib/apiBase";
import { calculateSM2, confidenceToQuality } from "@saedu/shared/sm2";
import styles from "./FlashcardDeck.module.css";

export type Flashcard = {
  id: string;
  front: string; // question / objective
  back: string;  // answer / explanation
  weekNumber: number;
  termNumber: number;
  repetitions?: number;
  interval?: number;
  easeFactor?: number;
};

type Props = {
  subject: string;
  grade: number;
  cards: Flashcard[];
};

type Confidence = "again" | "hard" | "good" | "easy";

const confidenceLabels: Record<Confidence, string> = {
  again: "Again (1d)",
  hard: "Hard (SM-2)",
  good: "Good (SM-2)",
  easy: "Easy (SM-2)",
};

export function FlashcardDeck({ subject, grade, cards }: Props) {
  const { session } = useSession();
  const [deck, setDeck] = useState<Flashcard[]>(() => [...cards].sort(() => Math.random() - 0.5));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<Record<string, Confidence>>({});
  const [done, setDone] = useState(false);

  const current = deck[index] ?? null;

  const handleConfidence = (conf: Confidence) => {
    if (!current) return;
    const newResults = { ...results, [current.id]: conf };
    setResults(newResults);
    setFlipped(false);

    // Compute SM-2 metrics
    const quality = confidenceToQuality(conf);
    const sm2Result = calculateSM2({
      quality,
      repetitions: current.repetitions ?? 0,
      interval: current.interval ?? 1,
      easeFactor: current.easeFactor ?? 2.5,
    });

    // Submit spaced review data
    if (session) {
      const score = conf === "easy" ? 100 : conf === "good" ? 75 : conf === "hard" ? 40 : 0;
      fetch(`${API_BASE}/analytics/spaced-reviews`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "x-csrf-token": session.csrfToken },
        body: JSON.stringify({
          lessonKey: `${String(grade).padStart(2, "0")}-${subject}`,
          topic: current.front.slice(0, 80),
          score,
          repetitions: sm2Result.repetitions,
          interval: sm2Result.interval,
          easeFactor: sm2Result.easeFactor,
          nextReviewDate: sm2Result.dueDateString,
        }),
      }).catch(() => {});
    }

    // Move "again" and "hard" cards to later in the deck
    if (conf === "again" || conf === "hard") {
      const remaining = deck.slice(index + 1);
      const insert = Math.min(remaining.length, 2 + Math.floor(Math.random() * 3));
      const newDeck = [...remaining.slice(0, insert), current, ...remaining.slice(insert)];
      setDeck(newDeck);
      setIndex(0);
    } else {
      if (index + 1 >= deck.length) setDone(true);
      else setIndex(index + 1);
    }
  };

  if (cards.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>🗂</div>
        <p>No flashcards yet — they're generated from lesson content. Check back once lessons are published.</p>
      </div>
    );
  }

  if (done) {
    const total = Object.keys(results).length;
    const easy = Object.values(results).filter((c) => c === "easy" || c === "good").length;
    return (
      <div className={styles.done}>
        <div className={styles.doneIcon}>🎉</div>
        <h2 className={styles.doneTitle}>Deck complete!</h2>
        <p className={styles.doneSummary}>{easy} / {total} cards known well</p>
        <button className={styles.restartBtn} onClick={() => { setDeck([...cards].sort(() => Math.random() - 0.5)); setIndex(0); setFlipped(false); setResults({}); setDone(false); }}>
          Review again
        </button>
      </div>
    );
  }

  const remaining = deck.length - index;

  return (
    <div className={styles.wrap}>
      <div className={styles.meta}>
        <span>{remaining} card{remaining !== 1 ? "s" : ""} remaining</span>
        <span className={styles.metaDot} />
        <span>Term {current?.termNumber} · Week {current?.weekNumber}</span>
      </div>

      <button
        className={styles.cardWrap}
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "Card back — click to flip" : "Card front — click to flip"}
      >
        <div className={styles.card} data-flipped={flipped ? "true" : "false"}>
          <div className={styles.cardFace} data-face="front">
            <div className={styles.faceLabel}>Question</div>
            <div className={styles.faceText}>{current?.front}</div>
            <div className={styles.tapHint}>Tap to reveal answer</div>
          </div>
          <div className={styles.cardFace} data-face="back">
            <div className={styles.faceLabel}>Answer</div>
            <div className={styles.faceText}>{current?.back}</div>
          </div>
        </div>
      </button>

      {flipped && (
        <div className={styles.confidence}>
          <p className={styles.confidenceLabel}>How well did you know this?</p>
          <div className={styles.confidenceBtns}>
            {(["again", "hard", "good", "easy"] as Confidence[]).map((conf) => (
              <button key={conf} className={styles.confBtn} data-conf={conf} onClick={() => handleConfidence(conf)}>
                {confidenceLabels[conf]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
