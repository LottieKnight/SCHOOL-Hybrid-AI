"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

const CARDS = ["📚", "🧪", "📐", "🎨", "🧬", "💻", "🧠", "🎓"];

export default function MemoryGame() {
  const [grid, setGrid] = useState<string[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [solved, setSolved] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);

  useEffect(() => {
    const doubled = [...CARDS, ...CARDS];
    setGrid(doubled.sort(() => Math.random() - 0.5));
  }, []);

  const handleFlip = (idx: number) => {
    if (flipped.length === 2 || flipped.includes(idx) || solved.includes(idx)) return;

    const nextFlipped = [...flipped, idx];
    setFlipped(nextFlipped);

    if (nextFlipped.length === 2) {
      setMoves(m => m + 1);
      if (grid[nextFlipped[0]] === grid[nextFlipped[1]]) {
        setSolved([...solved, ...nextFlipped]);
        setFlipped([]);
      } else {
        setTimeout(() => setFlipped([]), 1000);
      }
    }
  };

  const isWon = solved.length === grid.length && grid.length > 0;

  useEffect(() => {
    if (isWon) {
      // Record score
      fetch("/api/games/scores", {
        method: "POST",
        body: JSON.stringify({ gameType: "memory_match", score: moves, metadata: { moves } }),
      }).catch(() => {});
    }
  }, [isWon, moves]);

  return (
    <div className={styles.container}>
      <Link href="/community/games" className={styles.back}>← Games</Link>
      <h1 className={styles.title}>Memory Match</h1>
      <p className={styles.subtitle}>Match the academic icons. Fewer moves is better!</p>
      
      <div className={styles.stats}>
        <span>Moves: {moves}</span>
        {isWon && <span className={styles.win}>You won! 🎉</span>}
      </div>

      <div className={styles.grid}>
        {grid.map((icon, i) => (
          <button
            key={i}
            className={styles.card}
            data-flipped={flipped.includes(i) || solved.includes(i)}
            onClick={() => handleFlip(i)}
          >
            <div className={styles.cardInner}>
              <div className={styles.cardFront}>?</div>
              <div className={styles.cardBack}>{icon}</div>
            </div>
          </button>
        ))}
      </div>

      {isWon && (
        <button className={styles.restart} onClick={() => window.location.reload()}>
          Play Again
        </button>
      )}
    </div>
  );
}
