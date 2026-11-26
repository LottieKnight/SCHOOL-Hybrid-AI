"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

type Source = {
  type: "journal" | "book" | "website" | "newspaper";
  fields: Record<string, string>;
  correctOrder: string[];
  harwardFormatted: string;
  hint: string;
};

const SOURCES: Source[] = [
  {
    type: "journal",
    hint: "Journal article — APA format: Author(s). (Year). Title. Journal Name, Volume(Issue), Pages.",
    fields: {
      Author: "Mokoena, T. & Dlamini, P.",
      Year: "2022",
      Title: "Load-shedding and academic performance in South African schools",
      Journal: "South African Journal of Education",
      Volume: "42(3)",
      Pages: "1–14",
    },
    correctOrder: ["Author", "Year", "Title", "Journal", "Volume", "Pages"],
    harwardFormatted:
      "Mokoena, T. & Dlamini, P. 2022. Load-shedding and academic performance in South African schools. South African Journal of Education, 42(3), 1–14.",
  },
  {
    type: "book",
    hint: "Book — Harvard format: Author(s). Year. Title (Edition). Place of Publication: Publisher.",
    fields: {
      Author: "Sithole, N.",
      Year: "2021",
      Title: "Financial Literacy for South African Students",
      Edition: "(3rd ed.)",
      City: "Cape Town",
      Publisher: "Juta Academic",
    },
    correctOrder: ["Author", "Year", "Title", "Edition", "City", "Publisher"],
    harwardFormatted:
      "Sithole, N. 2021. Financial Literacy for South African Students (3rd ed.). Cape Town: Juta Academic.",
  },
  {
    type: "website",
    hint: "Website — APA format: Author. (Year, Month Day). Title of page. Website Name. URL",
    fields: {
      Author: "Statistics South Africa",
      Year: "2023",
      "Published date": "14 March",
      Title: "Quarterly Labour Force Survey: Q4 2022",
      Website: "StatsSA.gov.za",
      URL: "https://www.statssa.gov.za/qlfs-q4-2022",
    },
    correctOrder: ["Author", "Year", "Published date", "Title", "Website", "URL"],
    harwardFormatted:
      "Statistics South Africa. 2023. Quarterly Labour Force Survey: Q4 2022. StatsSA.gov.za. https://www.statssa.gov.za/qlfs-q4-2022",
  },
  {
    type: "newspaper",
    hint: "Newspaper — APA format: Author. (Year, Month Day). Article title. Newspaper Name, p./pp. X.",
    fields: {
      Author: "Khoza, L.",
      Year: "2023",
      "Month Day": "3 July",
      "Article title": "NSFAS applications reach record high amid budget cuts",
      Newspaper: "Daily Maverick",
      Pages: "p. 4",
    },
    correctOrder: ["Author", "Year", "Month Day", "Article title", "Newspaper", "Pages"],
    harwardFormatted:
      "Khoza, L. 2023, 3 July. NSFAS applications reach record high amid budget cuts. Daily Maverick, p. 4.",
  },
  {
    type: "journal",
    hint: "Journal article — Harvard format: Author(s). Year. Title. Journal, Volume(Issue): Pages.",
    fields: {
      Author: "Van Niekerk, R.",
      Year: "2020",
      Title: "Entrepreneurship education at South African HEIs: A systematic review",
      Journal: "African Journal of Business Management",
      Volume: "14(7)",
      Pages: "218–230",
    },
    correctOrder: ["Author", "Year", "Title", "Journal", "Volume", "Pages"],
    harwardFormatted:
      "Van Niekerk, R. 2020. Entrepreneurship education at South African HEIs: A systematic review. African Journal of Business Management, 14(7), 218–230.",
  },
];

type Phase = "idle" | "playing" | "result" | "done";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function CitationSprintPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [sourceIdx, setSourceIdx] = useState(0);
  const [shuffledFields, setShuffledFields] = useState<string[]>([]);
  const [ranked, setRanked] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(60);
  const [totalScore, setTotalScore] = useState(0);
  const [roundScores, setRoundScores] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const source = SOURCES[sourceIdx];

  const stopTimer = () => { if (timerRef.current) clearInterval(timerRef.current); };

  const startSource = (idx: number) => {
    const src = SOURCES[idx];
    setShuffledFields(shuffle(Object.keys(src.fields)));
    setRanked([]);
    setTimeLeft(60);
    setPhase("playing");
    stopTimer();
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { stopTimer(); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => stopTimer();
  }, []);

  // Auto-submit when time runs out
  const selectField = (field: string) => {
    if (ranked.includes(field) || ranked.length >= source.correctOrder.length) return;
    setRanked((prev) => [...prev, field]);
  };

  const removeField = (pos: number) => {
    setRanked((prev) => prev.filter((_, i) => i !== pos));
  };

  const submitRanking = useCallback(() => {
    stopTimer();
    const src = SOURCES[sourceIdx];
    let score = 0;
    for (let i = 0; i < src.correctOrder.length; i++) {
      if (ranked[i] === src.correctOrder[i]) score += 10;
    }
    setTotalScore((prev) => prev + score);
    setRoundScores((prev) => [...prev, score]);
    setPhase("result");
  }, [sourceIdx, ranked]);

  useEffect(() => {
    if (phase === "playing" && timeLeft === 0) submitRanking();
  }, [timeLeft, phase, submitRanking]);

  const nextSource = async () => {
    const next = sourceIdx + 1;
    if (next >= SOURCES.length) {
      setPhase("done");
      if (!submitted) {
        setSubmitted(true);
        await fetch("/api/games/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameType: "citation_sprint", score: totalScore, metadata: { sources: SOURCES.length } }),
        }).catch(() => {});
      }
    } else {
      setSourceIdx(next);
      startSource(next);
    }
  };

  if (phase === "idle") {
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.intro}>
            <Link className="button" href="/community/games">← Games</Link>
            <h1>Citation Sprint</h1>
            <p className="subtitle">Arrange the reference fields in the correct APA/Harvard order. 5 sources · 60 seconds each.</p>
            <div className={styles.howTo}>
              <h3>How to play</h3>
              <ul>
                <li>A source appears with scrambled fields (Author, Year, Title, etc.).</li>
                <li>Click fields in the correct citation order — fastest wins more points.</li>
                <li>10 points for each correctly ordered field.</li>
                <li>A hint shows the format required.</li>
              </ul>
            </div>
            <button className="button" onClick={() => { setSourceIdx(0); setTotalScore(0); setRoundScores([]); setSubmitted(false); startSource(0); }}>Start game</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "playing") {
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.header}>
            <span className={styles.progress}>{sourceIdx + 1} / {SOURCES.length} · {source.type}</span>
            <div className={`${styles.timer} ${timeLeft <= 15 ? styles.timerUrgent : ""}`}>{timeLeft}s</div>
            <span className={styles.score}>{totalScore} pts</span>
          </div>

          <p className={styles.hint}>{source.hint}</p>

          <div className={styles.orderSlots}>
            {source.correctOrder.map((_, pos) => (
              <div key={pos} className={styles.slot}>
                <span className={styles.slotNum}>{pos + 1}</span>
                {ranked[pos] ? (
                  <div className={styles.fieldChip} onClick={() => removeField(pos)}>
                    <strong>{ranked[pos]}:</strong> {source.fields[ranked[pos]]}
                    <span className={styles.removeHint}>✕</span>
                  </div>
                ) : (
                  <div className={`${styles.fieldChip} ${styles.emptySlot}`}>—</div>
                )}
              </div>
            ))}
          </div>

          <div className={styles.fieldPool}>
            {shuffledFields.filter((f) => !ranked.includes(f)).map((field) => (
              <button key={field} className={styles.fieldBtn} onClick={() => selectField(field)}>
                <strong>{field}:</strong> {source.fields[field]}
              </button>
            ))}
          </div>

          {ranked.length === source.correctOrder.length && (
            <button className="button" onClick={submitRanking}>Submit citation</button>
          )}
        </div>
      </div>
    );
  }

  if (phase === "result") {
    const score = roundScores[roundScores.length - 1];
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.header}>
            <span className={styles.progress}>{sourceIdx + 1} / {SOURCES.length}</span>
            <span className={styles.score}>+{score} pts · {totalScore} total</span>
          </div>

          <div className={styles.correctCitation}>
            <p className={styles.sectionLabel}>Correct citation</p>
            <p className={styles.citationText}>{source.harwardFormatted}</p>
          </div>

          <div className={styles.fieldResults}>
            {source.correctOrder.map((field, pos) => {
              const playerField = ranked[pos];
              const correct = playerField === field;
              return (
                <div key={pos} className={`${styles.fieldResult} ${correct ? styles.correct : styles.wrong}`}>
                  <span className={styles.slotNum}>{pos + 1}</span>
                  <div>
                    <strong>{field}</strong>
                    {!correct && playerField && <span className={styles.playerPicked}> (you put: {playerField})</span>}
                  </div>
                  <span className={styles.tick}>{correct ? "✓" : "✗"}</span>
                </div>
              );
            })}
          </div>

          <button className="button" onClick={nextSource}>
            {sourceIdx + 1 < SOURCES.length ? "Next source →" : "See final score"}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const maxScore = SOURCES.length * source.correctOrder.length * 10;
    const pct = Math.round((totalScore / maxScore) * 100);
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.done}>
            <h1>{pct >= 80 ? "Citation Champion" : pct >= 55 ? "Getting There" : "Keep Practising"}</h1>
            <p className={styles.finalScore}>{totalScore} / {maxScore} pts</p>
            <p className="subtitle">Proper citation is the foundation of academic integrity. Your references are your credibility.</p>
            <div className={styles.doneActions}>
              <button className="button" onClick={() => { setSourceIdx(0); setTotalScore(0); setRoundScores([]); setSubmitted(false); startSource(0); }}>Play again</button>
              <Link className="button" href="/community/games">All games</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
