"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { playKey } from "@/lib/sounds";
import { getDailyPassage, getRandomPassage } from "@/lib/examDashPassages";

type GameStatus = "idle" | "countdown" | "racing" | "done";

const RACE_DURATION = 60; // 60 seconds

export default function ExamDashPage() {
  return (
    <Suspense>
      <ExamDashInner />
    </Suspense>
  );
}

function ExamDashInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isChallenge = searchParams.get("mode") === "challenge";

  // Memoize passage selection to prevent re-rolls on re-renders
  const [passage] = useState(() => {
    if (isChallenge) return getDailyPassage();
    
    // Adaptive difficulty based on local history
    const histRaw = typeof window !== "undefined" ? localStorage.getItem("examdash_wpm_history") : null;
    const hist = histRaw ? (JSON.parse(histRaw) as number[]) : [];
    const avg =
      hist.length > 0
        ? hist.reduce((a, b) => a + b, 0) / Math.min(3, hist.length)
        : 0;
    const tier: 1 | 2 | 3 = avg >= 60 ? 3 : avg >= 35 ? 2 : 1;
    return getRandomPassage(tier);
  });

  // Colorblind mode — read once at mount
  const [colorblind, setColorblind] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setColorblind(localStorage.getItem("accessibility_colorblind") === "1");
    }
  }, []);

  // ── Core state ────────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<GameStatus>("idle");
  const [countdown, setCountdown] = useState(3);
  const [typed, setTyped] = useState("");
  const [timeLeft, setTimeLeft] = useState(RACE_DURATION);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [personalBest, setPersonalBest] = useState<number | null>(null);

  // ── Extra state ─────────────────────────────────────────────────────────────
  const [combo, setCombo] = useState(0);
  const [crossGameBonus, setCrossGameBonus] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [wordStats, setWordStats] = useState<{ word: string; errors: number }[]>([]);
  const [heatmap, setHeatmap] = useState<{
    slowWords: string[];
    errorChars: [string, number][];
  } | null>(null);

  // ── Refs ──────────────────────────────────────────────────────────────────────
  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const comboRef = useRef(0);
  const ghostWpmRef = useRef(0);
  const keystrokeRef = useRef<
    { idx: number; expected: string; correct: boolean; ts: number }[]
  >([]);
  const wordStatsRef = useRef<{ word: string; errors: number }[]>([]);

  // ── Derived values ────────────────────────────────────────────────────────────
  const chars = Array.from(passage.text);
  const words = passage.text.split(" ");
  const correctSoFar = typed.split("").filter((ch, i) => ch === chars[i]).length;
  const errors = typed.length - correctSoFar;
  const progress = Math.min(100, Math.round((typed.length / chars.length) * 100));
  const finished = typed.length >= chars.length;

  const [comboMultiplier, setComboMultiplier] = useState(1.0);
  const [comboLabel, setComboLabel] = useState<string | null>(null);
  const [ghostPos, setGhostPos] = useState(-1);

  // Update derived values from refs
  useEffect(() => {
    setComboMultiplier(
      comboRef.current >= 15 ? 2.0 : comboRef.current >= 5 ? 1.5 : 1.0
    );
    setComboLabel(
      comboRef.current >= 15 ? "×2.0" : comboRef.current >= 5 ? "×1.5" : null
    );
  }, []);

  // Update ghost position on animation frame during racing
  useEffect(() => {
    if (status !== "racing" || ghostWpmRef.current <= 0) {
      setGhostPos(-1);
      return;
    }

    const updateGhost = () => {
      const pos = Math.min(
        chars.length - 1,
        Math.floor(
          ghostWpmRef.current *
            ((Date.now() - startTimeRef.current) / 60000) *
            5
        )
      );
      setGhostPos(pos);
    };

    const raf = requestAnimationFrame(updateGhost);
    return () => cancelAnimationFrame(raf);
  }, [status, chars.length]);

  const calcWpm = useCallback(() => {
    const elapsed = (Date.now() - startTimeRef.current) / 1000 / 60;
    if (elapsed <= 0) return 0;
    const base = Math.round(correctSoFar / 5 / elapsed);
    return Math.round(base * comboMultiplier);
  }, [correctSoFar, comboMultiplier]);

  useEffect(() => {
    ghostWpmRef.current = +(localStorage.getItem("examdash_best_wpm") ?? 0);
  }, []);

  const endGame = useCallback(
    async (timedOut: boolean) => {
      void timedOut;
      setStatus("done");
      if (timerRef.current) clearInterval(timerRef.current);

      const finalWpm = calcWpm();
      const finalAccuracy =
        typed.length > 0 ? Math.round((correctSoFar / typed.length) * 100) : 0;
      setWpm(finalWpm);
      setAccuracy(finalAccuracy);
      setWordStats([...wordStatsRef.current]);

      // Heatmap computation
      const kstrokes = keystrokeRef.current;
      if (kstrokes.length > 0) {
        let charPos = 0;
        const wordTimings: { word: string; duration: number }[] = [];
        words.forEach((w) => {
          const ks = kstrokes.filter(
            (k) => k.idx >= charPos && k.idx < charPos + w.length
          );
          if (ks.length >= 2)
            wordTimings.push({ word: w, duration: ks[ks.length - 1].ts - ks[0].ts });
          charPos += w.length + 1;
        });
        wordTimings.sort((a, b) => b.duration - a.duration);

        const errorMap: Record<string, number> = {};
        kstrokes
          .filter((k) => !k.correct)
          .forEach((k) => {
            errorMap[k.expected] = (errorMap[k.expected] ?? 0) + 1;
          });
        const errorChars = (Object.entries(errorMap) as [string, number][])
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        setHeatmap({
          slowWords: wordTimings.slice(0, 3).map((w) => w.word),
          errorChars,
        });
      }

      const hist = JSON.parse(
        localStorage.getItem("examdash_wpm_history") ?? "[]"
      ) as number[];
      hist.push(finalWpm);
      if (hist.length > 10) hist.shift();
      localStorage.setItem("examdash_wpm_history", JSON.stringify(hist));

      if (finalWpm > ghostWpmRef.current) {
        ghostWpmRef.current = finalWpm;
        localStorage.setItem("examdash_best_wpm", String(finalWpm));
      }

      try {
        const res = await fetch("/api/games/scores", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameType: "exam_dash",
            score: finalWpm,
            metadata: {
              wpm: finalWpm,
              accuracy: finalAccuracy,
              passage: passage.id,
            },
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          personalBest?: number;
          crossGameBonus?: boolean;
        };
        if (typeof data.personalBest === "number") setPersonalBest(data.personalBest);
        if (data.crossGameBonus) setCrossGameBonus(true);
      } catch { /* ignore */ }

      setTimeout(() => setShowNudge(true), 2500);
    },
    [calcWpm, correctSoFar, typed.length, passage.id, words]
  );

  useEffect(() => {
    if (status !== "countdown") return;
    if (countdown <= 0) {
      setStatus("racing");
      startTimeRef.current = Date.now();
      inputRef.current?.focus();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [status, countdown]);

  useEffect(() => {
    if (status !== "racing") return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          void endGame(true);
          return 0;
        }
        return t - 1;
      });
      setWpm(calcWpm());
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, calcWpm, endGame]);

  useEffect(() => {
    if (status === "racing" && finished) void endGame(false);
  }, [status, finished, endGame]);

  function startGame() {
    setTyped("");
    setTimeLeft(RACE_DURATION);
    setWpm(0);
    setAccuracy(100);
    setCountdown(3);
    setStatus("countdown");
    setCombo(0);
    comboRef.current = 0;
    setCrossGameBonus(false);
    setShowNudge(false);
    setWordStats([]);
    setHeatmap(null);
    wordStatsRef.current = [];
    keystrokeRef.current = [];
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (status !== "racing") return;
    const value = e.target.value;
    if (value.length > chars.length) return;
    setTyped(value);

    const i = value.length - 1;
    if (i < 0) return;

    const isCorrect = value[i] === chars[i];
    playKey(isCorrect);

    keystrokeRef.current.push({
      idx: i,
      expected: chars[i],
      correct: isCorrect,
      ts: Date.now(),
    });

    if (isCorrect) {
      comboRef.current++;
      setCombo(comboRef.current);
    } else {
      comboRef.current = 0;
      setCombo(0);
    }

    let charPos = 0;
    let wordIdx = 0;
    for (let wi = 0; wi < words.length; wi++) {
      if (i >= charPos && i < charPos + words[wi].length) {
        wordIdx = wi;
        break;
      }
      charPos += words[wi].length + 1;
    }
    if (!wordStatsRef.current[wordIdx]) {
      wordStatsRef.current[wordIdx] = { word: words[wordIdx], errors: 0 };
    }
    if (!isCorrect) wordStatsRef.current[wordIdx].errors++;

    if (chars[i] === " " || i === chars.length - 1) {
      setWordStats([...wordStatsRef.current]);
    }
  }

  const timerPct = (timeLeft / RACE_DURATION) * 100;
  const timerColor =
    timeLeft > 20 ? "var(--green)" : timeLeft > 10 ? "var(--amber)" : "var(--red)";

  return (
    <div style={{ maxWidth: "760px", margin: "0 auto", padding: "24px 16px", display: "grid", gap: "24px" }}>
      <div>
        <Link href="/community/games" style={{ fontSize: "13px", color: "var(--text-2)", textDecoration: "none" }}>
          ← Game Center
        </Link>
        <h1 style={{ margin: "8px 0 4px", fontFamily: "var(--font-display)", fontSize: "36px" }}>
          ⌨ Exam Dash
        </h1>
        <p style={{ margin: 0, color: "var(--text-2)", fontSize: "14px" }}>
          {isChallenge ? "Daily Challenge — same passage for every student today." : "Free Play — type to win."}{" "}
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--gold)" }}>
            {passage.subject} · {passage.title}
            {passage.difficulty && (
              <span style={{ marginLeft: "8px", opacity: 0.6 }}>
                {"·".repeat(passage.difficulty)} {["", "Easy", "Medium", "Hard"][passage.difficulty]}
              </span>
            )}
          </span>
        </p>
      </div>

      <div style={{
        padding: "28px",
        borderRadius: "var(--r-xl)",
        border: "1px solid var(--border)",
        background: "linear-gradient(160deg, var(--surface) 0%, var(--surface-2) 100%)",
        display: "grid",
        gap: "20px",
        position: "relative",
        overflow: "hidden",
      }}>
        {status === "countdown" && (
          <div style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(4,12,24,0.85)",
            borderRadius: "var(--r-xl)",
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "96px", lineHeight: 1, color: "var(--gold)", animation: "exam-dash-pop 0.4s ease" }}>
                {countdown === 0 ? "GO!" : countdown}
              </div>
              <p style={{ margin: "8px 0 0", color: "var(--text-2)", fontSize: "14px" }}>Get ready to type…</p>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gap: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: timerColor }}>{timeLeft}s</span>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              {comboLabel && (
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 700, color: "var(--gold)",
                  padding: "2px 8px", border: "1px solid var(--gold)", borderRadius: "999px",
                  boxShadow: "0 0 8px rgba(255,215,0,0.25)", animation: "exam-dash-pop 0.2s ease"
                }}>
                  {comboLabel} combo
                </span>
              )}
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--gold)", fontWeight: 700 }}>{wpm} WPM</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: errors > 0 ? "var(--red)" : "var(--green)" }}>{errors} errors</span>
            </div>
          </div>
          <div style={{ height: "4px", background: "rgba(255,255,255,0.07)", borderRadius: "2px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${timerPct}%`, background: timerColor, borderRadius: "2px", transition: "width 1s linear, background 0.3s" }} />
          </div>
          <div style={{ height: "2px", background: "rgba(255,255,255,0.04)", borderRadius: "1px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "var(--gold)", borderRadius: "1px", transition: "width 0.1s" }} />
          </div>
        </div>

        <div style={{ fontFamily: "var(--font-mono)", fontSize: "15px", lineHeight: 1.9, color: "var(--text-2)", userSelect: "none", padding: "8px 0", letterSpacing: "0.01em", cursor: status === "racing" ? "text" : "default" }} onClick={() => status === "racing" && inputRef.current?.focus()}>
          {chars.map((ch, i) => {
            let color = "var(--text-3)";
            let bg = "transparent";
            let textDecoration: React.CSSProperties["textDecoration"] = "none";
            if (i < typed.length) {
              if (typed[i] === ch) {
                color = colorblind ? "var(--text-1)" : "var(--green)";
                textDecoration = colorblind ? "underline" : "none";
              } else {
                color = "var(--text-1)";
                bg = "rgba(239,68,68,0.2)";
                textDecoration = colorblind ? "line-through" : "none";
              }
            } else if (i === typed.length) {
              bg = "rgba(255,215,0,0.15)";
              color = "var(--text-1)";
            }
            const isGhost = i === ghostPos && status === "racing" && i > typed.length;
            return (
              <span key={i} style={{ color, background: isGhost ? "rgba(100,160,255,0.22)" : bg, borderRadius: "2px", textDecoration, outline: isGhost ? "1px solid rgba(100,160,255,0.5)" : "none" }}>
                {ch}
              </span>
            );
          })}
        </div>

        {(status === "racing" || status === "done") && wordStats.length > 0 && (
          <div style={{ display: "flex", gap: "3px", flexWrap: "wrap", padding: "2px 0" }}>
            {words.map((w, wi) => {
              const ws = wordStats[wi];
              const done = ws !== undefined;
              return (
                <div key={wi} title={done ? `"${w}": ${ws.errors} error${ws.errors !== 1 ? "s" : ""}` : w}
                  style={{
                    height: "5px", width: `${Math.max(12, w.length * 5)}px`, borderRadius: "3px",
                    background: done ? (ws.errors === 0 ? "var(--green)" : ws.errors <= 2 ? "var(--amber)" : "var(--red)") : "rgba(255,255,255,0.07)",
                    transform: done ? "scaleY(1)" : "scaleY(0.5)", transition: "background 0.2s, transform 0.15s", transformOrigin: "bottom"
                  }} />
              );
            })}
          </div>
        )}

        <input ref={inputRef} type="text" value={typed} onChange={handleInput} disabled={status !== "racing"} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
          style={{ position: "absolute", opacity: 0, pointerEvents: status === "racing" ? "auto" : "none", width: "1px", height: "1px" }} />

        {status === "done" && (
          <div style={{ padding: "20px", borderRadius: "var(--r-lg)", background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.2)", display: "grid", gap: "12px" }}>
            <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "22px", color: "var(--gold)" }}>
              {finished ? "Passage complete! 🎉" : "Time's up!"}
            </h3>
            <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
              <div>
                <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "28px", color: "var(--text-1)", fontWeight: 700 }}>{wpm}</p>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-2)" }}>WPM</p>
              </div>
              <div>
                <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "28px", color: accuracy >= 95 ? "var(--green)" : accuracy >= 80 ? "var(--amber)" : "var(--red)", fontWeight: 700 }}>{accuracy}%</p>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-2)" }}>Accuracy</p>
              </div>
              {personalBest !== null && (
                <div>
                  <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "28px", color: "var(--gold)", fontWeight: 700 }}>{personalBest}</p>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-2)" }}>Personal Best</p>
                </div>
              )}
            </div>

            {crossGameBonus && (
              <div style={{ padding: "10px 14px", borderRadius: "var(--r-md)", background: "rgba(100,160,255,0.1)", border: "1px solid rgba(100,160,255,0.3)", fontSize: "13px", color: "#6aa0ff", fontWeight: 600 }}>
                🎮 +20 XP Cross-game bonus! You played both games today.
              </div>
            )}

            {heatmap && (heatmap.slowWords.length > 0 || heatmap.errorChars.length > 0) && (
              <div style={{ padding: "14px", borderRadius: "var(--r-md)", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", display: "grid", gap: "12px" }}>
                <p style={{ margin: 0, fontSize: "10px", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Performance Breakdown</p>
                {heatmap.slowWords.length > 0 && (
                  <div>
                    <p style={{ margin: "0 0 6px", fontSize: "12px", color: "var(--text-2)" }}>Slowest words:</p>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      {heatmap.slowWords.map((w) => (
                        <span key={w} style={{ fontFamily: "var(--font-mono)", fontSize: "12px", padding: "2px 9px", borderRadius: "4px", background: "rgba(251,191,36,0.12)", color: "var(--amber)" }}>{w}</span>
                      ))}
                    </div>
                  </div>
                )}
                {heatmap.errorChars.length > 0 && (
                  <div>
                    <p style={{ margin: "0 0 8px", fontSize: "12px", color: "var(--text-2)" }}>Most-missed characters:</p>
                    <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
                      {heatmap.errorChars.map(([ch, count]) => (
                        <div key={ch} style={{ textAlign: "center" }}>
                          <div style={{ height: `${Math.min(40, count * 8)}px`, width: "28px", background: "rgba(239,68,68,0.35)", borderRadius: "3px 3px 0 0", marginBottom: "3px" }} />
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--red)" }}>{ch === " " ? "␣" : ch}</span>
                          <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-3)" }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <button type="button" onClick={startGame} style={{ padding: "10px 20px", borderRadius: "var(--r-md)", background: "var(--gold)", color: "#000", fontWeight: 700, fontSize: "14px", cursor: "pointer", border: "none" }}>Play Again</button>
              <Link href="/community/games" style={{ padding: "10px 20px", borderRadius: "var(--r-md)", border: "1px solid var(--border)", color: "var(--text-2)", fontSize: "14px", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Leaderboard</Link>
            </div>
          </div>
        )}

        {status === "idle" && (
          <button type="button" onClick={startGame} style={{ padding: "14px", borderRadius: "var(--r-md)", background: "var(--gold)", color: "#000", fontWeight: 700, fontSize: "16px", cursor: "pointer", border: "none", letterSpacing: "0.02em" }}>Start Race</button>
        )}
      </div>

      {showNudge && (
        <div style={{ position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)", padding: "14px 20px", borderRadius: "var(--r-lg)", background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", gap: "16px", zIndex: 50, animation: "nudge-slide 0.35s ease", maxWidth: "480px", width: "calc(100vw - 32px)" }}>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--text-1)", flex: 1 }}>Nice break. You have tasks due today →</p>
          <button type="button" onClick={() => router.push("/today")} style={{ padding: "8px 16px", borderRadius: "var(--r-md)", background: "var(--gold)", color: "#000", fontWeight: 700, fontSize: "13px", cursor: "pointer", border: "none", whiteSpace: "nowrap" }}>Back to studying</button>
          <button type="button" onClick={() => setShowNudge(false)} style={{ padding: "4px 8px", borderRadius: "var(--r-sm)", background: "transparent", border: "1px solid var(--border)", color: "var(--text-3)", fontSize: "12px", cursor: "pointer" }}>✕</button>
        </div>
      )}

      <style>{`
        @keyframes exam-dash-pop {
          0%   { transform: scale(0.6); opacity: 0; }
          70%  { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes nudge-slide {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
