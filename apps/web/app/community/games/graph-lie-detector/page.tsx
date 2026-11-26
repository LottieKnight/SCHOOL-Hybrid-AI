"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

type FlawType =
  | "Truncated Y-axis"
  | "Cherry-picked date range"
  | "Pie chart > 100%"
  | "Misleading 3D effect"
  | "Dual-axis manipulation"
  | "Missing baseline"
  | "Sample size hidden";

type Round = {
  title: string;
  flaw: FlawType;
  options: FlawType[];
  explanation: string;
  chart: React.ReactNode;
};

/* ---------- hand-coded SVG charts ---------- */
const TruncatedBarChart = () => (
  <svg width="260" height="160" viewBox="0 0 260 160" aria-hidden>
    <text x="130" y="14" textAnchor="middle" fontSize="11" fill="#555">Student Pass Rates by Province</text>
    {/* Y axis — starts at 60, not 0 */}
    {[60, 70, 80, 90, 100].map((v, i) => (
      <g key={v}>
        <text x="24" y={130 - i * 22 + 4} fontSize="9" fill="#888" textAnchor="end">{v}%</text>
        <line x1="28" y1={130 - i * 22} x2="255" y2={130 - i * 22} stroke="#e5e5e5" strokeWidth="1" />
      </g>
    ))}
    {/* bars — heights exaggerated because Y starts at 60 */}
    {[
      { label: "GP", value: 82, h: 48 },
      { label: "WC", value: 88, h: 62 },
      { label: "EC", value: 67, h: 15 },
      { label: "KZN", value: 79, h: 42 },
    ].map((b, i) => (
      <g key={b.label}>
        <rect x={38 + i * 52} y={130 - b.h} width="36" height={b.h} fill="#e8c15a" rx="3" />
        <text x={56 + i * 52} y={145} textAnchor="middle" fontSize="9" fill="#555">{b.label}</text>
        <text x={56 + i * 52} y={126 - b.h} textAnchor="middle" fontSize="9" fill="#333">{b.value}%</text>
      </g>
    ))}
    <line x1="28" y1="22" x2="28" y2="130" stroke="#999" strokeWidth="1.5" />
    <line x1="28" y1="130" x2="255" y2="130" stroke="#999" strokeWidth="1.5" />
  </svg>
);

const CherryPickedLineChart = () => (
  <svg width="260" height="160" viewBox="0 0 260 160" aria-hidden>
    <text x="130" y="14" textAnchor="middle" fontSize="11" fill="#555">Graduate Employment Rate (%)</text>
    {/* Only shows 2020–2022, hiding the 2017–2019 decline */}
    {["2020", "2021", "2022"].map((y, i) => (
      <text key={y} x={55 + i * 80} y={148} textAnchor="middle" fontSize="9" fill="#888">{y}</text>
    ))}
    {[40, 50, 60, 70].map((v, i) => (
      <g key={v}>
        <text x="24" y={128 - i * 22 + 4} fontSize="9" fill="#888" textAnchor="end">{v}%</text>
        <line x1="28" y1={128 - i * 22} x2="245" y2={128 - i * 22} stroke="#e5e5e5" strokeWidth="1" />
      </g>
    ))}
    {/* upward line — cherry-picked period of growth */}
    <polyline points="55,110 135,80 215,52" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round" />
    {[110, 80, 52].map((y, i) => (
      <circle key={i} cx={55 + i * 80} cy={y} r="4" fill="#10b981" />
    ))}
    <line x1="28" y1="22" x2="28" y2="132" stroke="#999" strokeWidth="1.5" />
    <line x1="28" y1="132" x2="245" y2="132" stroke="#999" strokeWidth="1.5" />
    <text x="130" y="158" textAnchor="middle" fontSize="8" fill="#dc2626">← Note: 2016–2019 data not shown</text>
  </svg>
);

const PieOver100 = () => (
  <svg width="200" height="170" viewBox="0 0 200 170" aria-hidden>
    <text x="100" y="14" textAnchor="middle" fontSize="11" fill="#555">Student Budget Breakdown</text>
    {/* Pie slices intentionally sum to 120% */}
    <path d="M100,90 L100,40 A50,50 0 0,1 143,115 Z" fill="#e8c15a" />
    <path d="M100,90 L143,115 A50,50 0 0,1 75,138 Z" fill="#f59e0b" />
    <path d="M100,90 L75,138 A50,50 0 0,1 57,65 Z" fill="#10b981" />
    <path d="M100,90 L57,65 A50,50 0 0,1 100,40 Z" fill="#ec4899" />
    <text x="10" y="125" fontSize="9" fill="#e8c15a">Rent 40%</text>
    <text x="10" y="138" fontSize="9" fill="#f59e0b">Food 30%</text>
    <text x="10" y="151" fontSize="9" fill="#10b981">Transport 25%</text>
    <text x="10" y="164" fontSize="9" fill="#ec4899">Other 25%</text>
    <text x="190" y="164" textAnchor="end" fontSize="8" fill="#dc2626">Total: 120%</text>
  </svg>
);

const DualAxisChart = () => (
  <svg width="270" height="165" viewBox="0 0 270 165" aria-hidden>
    <text x="135" y="14" textAnchor="middle" fontSize="11" fill="#555">Tutor Hours vs. Pass Rate</text>
    {/* Left Y axis: tutor hours 0-500 */}
    {[0, 125, 250, 375, 500].map((v, i) => (
      <text key={v} x="24" y={132 - i * 22 + 4} fontSize="8" fill="#e8c15a" textAnchor="end">{v}h</text>
    ))}
    {/* Right Y axis: pass rate 60-100 — different scale creates false correlation */}
    {[60, 70, 80, 90, 100].map((v, i) => (
      <text key={v} x="252" y={132 - i * 22 + 4} fontSize="8" fill="#10b981">{v}%</text>
    ))}
    <polyline points="50,125 100,100 150,72 200,52 240,32" fill="none" stroke="#e8c15a" strokeWidth="2" />
    <polyline points="50,128 100,106 150,90 200,78 240,60" fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="4,2" />
    <text x="50" y="148" fontSize="8" fill="#e8c15a" textAnchor="middle">2019</text>
    <text x="240" y="148" fontSize="8" fill="#e8c15a" textAnchor="middle">2023</text>
    <line x1="28" y1="22" x2="28" y2="135" stroke="#e8c15a" strokeWidth="1.5" />
    <line x1="248" y1="22" x2="248" y2="135" stroke="#10b981" strokeWidth="1.5" />
    <line x1="28" y1="135" x2="248" y2="135" stroke="#999" strokeWidth="1.5" />
  </svg>
);

const MisleadingPercentageBar = () => (
  <svg width="260" height="150" viewBox="0 0 260 150" aria-hidden>
    <text x="130" y="14" textAnchor="middle" fontSize="11" fill="#555">Support for Free HE (Survey Results)</text>
    <text x="130" y="28" textAnchor="middle" fontSize="9" fill="#dc2626">n = 12 respondents</text>
    {[
      { label: "Strongly agree", pct: 58, color: "#10b981" },
      { label: "Agree", pct: 25, color: "#e8c15a" },
      { label: "Neutral", pct: 8, color: "#f59e0b" },
      { label: "Disagree", pct: 9, color: "#ec4899" },
    ].map((row, i) => (
      <g key={row.label}>
        <text x="28" y={50 + i * 24 + 4} fontSize="9" fill="#555">{row.label}</text>
        <rect x="128" y={42 + i * 24} width={row.pct * 1.1} height="14" fill={row.color} rx="3" />
        <text x={132 + row.pct * 1.1} y={52 + i * 24} fontSize="9" fill="#333">{row.pct}%</text>
      </g>
    ))}
  </svg>
);

const TruncatedComparison = () => (
  <svg width="260" height="160" viewBox="0 0 260 160" aria-hidden>
    <text x="130" y="14" textAnchor="middle" fontSize="11" fill="#555">Average Study Hours: Before vs After App</text>
    {/* Y axis starts at 4, not 0 */}
    {[4, 5, 6, 7, 8].map((v, i) => (
      <g key={v}>
        <text x="24" y={130 - i * 22 + 4} fontSize="9" fill="#888" textAnchor="end">{v}h</text>
        <line x1="28" y1={130 - i * 22} x2="230" y2={130 - i * 22} stroke="#e5e5e5" strokeWidth="1" />
      </g>
    ))}
    <rect x="60" y="108" width="50" height="22" fill="#e8c15a" rx="3" />
    <text x="85" y="104" textAnchor="middle" fontSize="9" fill="#333">5.1h</text>
    <text x="85" y="144" textAnchor="middle" fontSize="9" fill="#555">Before</text>
    <rect x="145" y="64" width="50" height="66" fill="#10b981" rx="3" />
    <text x="170" y="60" textAnchor="middle" fontSize="9" fill="#333">7.0h</text>
    <text x="170" y="144" textAnchor="middle" fontSize="9" fill="#555">After</text>
    <line x1="28" y1="22" x2="28" y2="132" stroke="#999" strokeWidth="1.5" />
    <line x1="28" y1="132" x2="230" y2="132" stroke="#999" strokeWidth="1.5" />
    <text x="130" y="158" textAnchor="middle" fontSize="8" fill="#dc2626">Y-axis starts at 4h, not 0h</text>
  </svg>
);

const MissingBaselinePie = () => (
  <svg width="220" height="170" viewBox="0 0 220 170" aria-hidden>
    <text x="110" y="14" textAnchor="middle" fontSize="11" fill="#555">NSFAS Application Outcomes</text>
    {/* Giant green "approved" slice obscures context */}
    <path d="M110,90 L110,40 A50,50 0 1,1 70,132 Z" fill="#10b981" />
    <path d="M110,90 L70,132 A50,50 0 0,1 110,40 Z" fill="#dc2626" />
    <text x="125" y="78" fontSize="9" fill="white" fontWeight="700">87%</text>
    <text x="125" y="90" fontSize="8" fill="white">Approved</text>
    <text x="78" y="140" fontSize="9" fill="#dc2626" fontWeight="700">13%</text>
    <text x="65" y="152" fontSize="8" fill="#555">Rejected</text>
    <text x="110" y="168" textAnchor="middle" fontSize="8" fill="#dc2626">↑ Of those who completed the application</text>
  </svg>
);

const SampleSizeHidden = () => (
  <svg width="260" height="160" viewBox="0 0 260 160" aria-hidden>
    <text x="130" y="14" textAnchor="middle" fontSize="11" fill="#555">Lecture Attendance by Gender</text>
    {[0, 25, 50, 75, 100].map((v, i) => (
      <g key={v}>
        <text x="24" y={132 - i * 22 + 4} fontSize="9" fill="#888" textAnchor="end">{v}%</text>
        <line x1="28" y1={132 - i * 22} x2="245" y2={132 - i * 22} stroke="#e5e5e5" strokeWidth="1" />
      </g>
    ))}
    {[
      { label: "Female", pct: 91, h: 88, color: "#ec4899" },
      { label: "Male", pct: 64, h: 62, color: "#e8c15a" },
      { label: "Non-binary", pct: 100, h: 88, color: "#f59e0b" },
    ].map((b, i) => (
      <g key={b.label}>
        <rect x={45 + i * 68} y={132 - b.h} width="42" height={b.h} fill={b.color} rx="3" />
        <text x={66 + i * 68} y={132 - b.h - 4} textAnchor="middle" fontSize="9" fill="#333">{b.pct}%</text>
        <text x={66 + i * 68} y={148} textAnchor="middle" fontSize="8" fill="#555">{b.label}</text>
      </g>
    ))}
    <line x1="28" y1="22" x2="28" y2="132" stroke="#999" strokeWidth="1.5" />
    <line x1="28" y1="132" x2="245" y2="132" stroke="#999" strokeWidth="1.5" />
  </svg>
);

/* ---------- round definitions ---------- */
const ROUNDS: Round[] = [
  {
    title: "Student pass rates look very different across provinces.",
    flaw: "Truncated Y-axis",
    options: ["Truncated Y-axis", "Cherry-picked date range", "Pie chart > 100%", "Missing baseline"],
    explanation: "The Y-axis starts at 60%, not 0%. This makes a difference of 21 percentage points (EC vs WC) look like EC scored near-zero. Starting axes at non-zero values is one of the most common ways graphs mislead.",
    chart: <TruncatedBarChart />,
  },
  {
    title: "Graduate employment is on a strong upward trend.",
    flaw: "Cherry-picked date range",
    options: ["Cherry-picked date range", "Truncated Y-axis", "Sample size hidden", "Dual-axis manipulation"],
    explanation: "The graph shows only 2020–2022, a recovery period. Employment fell sharply from 2016–2019. Showing a carefully selected window to support a narrative — while hiding unfavourable data — is 'cherry-picking'.",
    chart: <CherryPickedLineChart />,
  },
  {
    title: "Most of students' budget goes to rent and food.",
    flaw: "Pie chart > 100%",
    options: ["Pie chart > 100%", "Truncated Y-axis", "Misleading 3D effect", "Cherry-picked date range"],
    explanation: "The four segments add up to 120%, not 100%. A pie chart must sum to exactly 100% by definition. This often happens when percentages are estimated separately rather than calculated from a whole.",
    chart: <PieOver100 />,
  },
  {
    title: "More tutor hours directly leads to higher pass rates.",
    flaw: "Dual-axis manipulation",
    options: ["Dual-axis manipulation", "Truncated Y-axis", "Cherry-picked date range", "Sample size hidden"],
    explanation: "The two Y-axes use completely different scales: one goes 0–500 hours, the other 60–100%. This makes two separate trends appear to track each other closely, implying causation where there may be none.",
    chart: <DualAxisChart />,
  },
  {
    title: "Students overwhelmingly support free higher education.",
    flaw: "Sample size hidden",
    options: ["Sample size hidden", "Pie chart > 100%", "Truncated Y-axis", "Dual-axis manipulation"],
    explanation: "The survey had only 12 respondents — far too small to generalise to the student population. Presenting percentages without disclosing a tiny sample size makes results look statistically meaningful when they are not.",
    chart: <MisleadingPercentageBar />,
  },
  {
    title: "Students study almost twice as long after using the SCHOOL app.",
    flaw: "Truncated Y-axis",
    options: ["Truncated Y-axis", "Cherry-picked date range", "Dual-axis manipulation", "Missing baseline"],
    explanation: "The Y-axis starts at 4 hours, making a 1.9-hour increase look like a doubling. Starting at 0 would reveal the bars are actually similar in height — a 37% increase, not 'almost twice'.",
    chart: <TruncatedComparison />,
  },
  {
    title: "87% of NSFAS applications are approved.",
    flaw: "Missing baseline",
    options: ["Missing baseline", "Truncated Y-axis", "Sample size hidden", "Pie chart > 100%"],
    explanation: "The 87% is calculated only among applications that were completed and submitted. Thousands of students start but never finish applications due to complexity. The true approval rate from all eligible students is much lower.",
    chart: <MissingBaselinePie />,
  },
  {
    title: "Female students attend lectures far more reliably than others.",
    flaw: "Sample size hidden",
    options: ["Sample size hidden", "Dual-axis manipulation", "Cherry-picked date range", "Truncated Y-axis"],
    explanation: "Non-binary students show 100% attendance — likely because there are only 1 or 2 in the dataset. Without showing sample sizes, small groups produce extreme percentages that look meaningful but statistically are not.",
    chart: <SampleSizeHidden />,
  },
];

type Phase = "idle" | "playing" | "done";

export default function GraphLieDetectorPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [roundIdx, setRoundIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const round = ROUNDS[roundIdx];

  const startGame = () => {
    setRoundIdx(0);
    setSelected(null);
    setTotalScore(0);
    setCorrect(0);
    setSubmitted(false);
    setPhase("playing");
  };

  const handlePick = (option: string) => {
    if (selected !== null) return;
    setSelected(option);
    if (option === round.flaw) {
      setTotalScore((s) => s + 10);
      setCorrect((c) => c + 1);
    }
  };

  const next = async () => {
    const next = roundIdx + 1;
    if (next >= ROUNDS.length) {
      setPhase("done");
      if (!submitted) {
        setSubmitted(true);
        await fetch("/api/games/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameType: "graph_lie_detector",
            score: totalScore + (selected === round.flaw ? 10 : 0),
            metadata: { correct: correct + (selected === round.flaw ? 1 : 0), total: ROUNDS.length },
          }),
        }).catch(() => {});
      }
    } else {
      setRoundIdx(next);
      setSelected(null);
    }
  };

  if (phase === "idle") {
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.intro}>
            <Link className="button" href="/community/games">← Games</Link>
            <h1>Graph Lie Detector</h1>
            <p className="subtitle">Spot the manipulation in {ROUNDS.length} real-looking charts. Develop the data literacy to resist misleading statistics.</p>
            <div className={styles.howTo}>
              <h3>How to play</h3>
              <ul>
                <li>A chart appears with a misleading flaw deliberately built in.</li>
                <li>Pick the correct type of manipulation from 4 options.</li>
                <li>10 points per correct answer.</li>
                <li>After picking, see an explanation of the flaw.</li>
              </ul>
            </div>
            <button className="button" onClick={startGame}>Start game</button>
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
            <span className={styles.round}>Round {roundIdx + 1} / {ROUNDS.length}</span>
            <span className={styles.score}>{totalScore} pts</span>
          </div>

          <p className={styles.chartTitle}>{round.title}</p>
          <div className={styles.chartBox}>{round.chart}</div>

          <div className={styles.options}>
            {round.options.map((option) => {
              let cls = styles.optionBtn;
              if (selected !== null) {
                if (option === round.flaw) cls += ` ${styles.optionCorrect}`;
                else if (option === selected) cls += ` ${styles.optionWrong}`;
              }
              return (
                <button key={option} className={cls} onClick={() => handlePick(option)}>
                  {option}
                </button>
              );
            })}
          </div>

          {selected !== null && (
            <>
              <div className={styles.explanation}>{round.explanation}</div>
              <button className="button" onClick={next}>
                {roundIdx + 1 < ROUNDS.length ? "Next chart →" : "See results"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const pct = Math.round((correct / ROUNDS.length) * 100);
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.done}>
            <h1>
              {correct >= 7 ? "Fact Checker Badge Earned" : correct >= 5 ? "Data Literate" : "Keep Questioning Graphs"}
            </h1>
            <p className={styles.finalScore}>{correct} / {ROUNDS.length} correct · {pct}%</p>
            <p className="subtitle">
              {correct >= 7
                ? "You spotted misleading charts that fool most readers. Apply this scepticism to everything you see."
                : "Data visualisations can be powerful tools for truth or manipulation. Practice reading the axes and sample sizes first."}
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
