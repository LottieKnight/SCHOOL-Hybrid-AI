"use client";

import { useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Flashcard = {
  front: string;
  back: string;
};

export function FlashcardDeck({ cards }: { cards: Flashcard[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (!cards.length) return null;

  const current = cards[index];

  const handleNext = () => {
    setFlipped(false);
    setIndex((i) => (i + 1) % cards.length);
  };

  const handlePrev = () => {
    setFlipped(false);
    setIndex((i) => (i - 1 + cards.length) % cards.length);
  };

  return (
    <div style={{ display: "grid", gap: "20px", width: "100%", maxWidth: "500px", margin: "24px auto" }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setFlipped(!flipped)}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            setFlipped(!flipped);
          }
        }}
        style={{
          perspective: "1000px",
          cursor: "pointer",
          height: "300px",
          outline: "none",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            textAlign: "center",
            transition: "transform 0.4s",
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* Front */}
          <div
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              backfaceVisibility: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px",
              borderRadius: "var(--r-lg)",
              border: "2px solid var(--gold)",
              background: "var(--surface)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-1)" }}>
              {current.front}
            </div>
          </div>

          {/* Back */}
          <div
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              backfaceVisibility: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px",
              transform: "rotateY(180deg)",
              borderRadius: "var(--r-lg)",
              border: "2px solid var(--gold)",
              background: "var(--surface-2)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div style={{ fontSize: "18px", color: "var(--text-2)" }}>{current.back}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Button variant="ghost" onClick={handlePrev} style={{ fontSize: "14px" }}>
          &larr; Previous
        </Button>
        <span style={{ fontSize: "14px", color: "var(--text-3)", fontWeight: 500, fontFamily: "var(--font-mono)" }}>
          {index + 1} / {cards.length}
        </span>
        <Button variant="ghost" onClick={handleNext} style={{ fontSize: "14px" }}>
          Next &rarr;
        </Button>
      </div>

      <p style={{ textAlign: "center", fontSize: "12px", color: "var(--text-4)", margin: 0 }}>
        Tap to flip • Swipe to navigate
      </p>
    </div>
  );
}
