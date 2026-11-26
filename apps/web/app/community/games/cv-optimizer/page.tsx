"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import styles from "./page.module.css";

type CvBlock = { text: string; keywords: string[] };

type Employer = {
  name: string;
  description: string;
  keywords: string[];
  blocks: CvBlock[];
};

const EMPLOYERS: Employer[] = [
  {
    name: "Standard Bank Graduate Programme",
    description: "Investment banking division. Seeking analytical thinkers with quantitative skills.",
    keywords: ["financial modelling", "excel", "data analysis", "risk", "compliance", "attention to detail"],
    blocks: [
      { text: "Built financial models in Excel to project 3-year revenue scenarios for a campus project.", keywords: ["financial modelling", "excel", "data analysis"] },
      { text: "Maintained 100% assignment submission rate across 4 semesters — no late submissions.", keywords: ["attention to detail", "compliance"] },
      { text: "Organised end-of-year campus music festival (300 attendees).", keywords: [] },
      { text: "Conducted a risk assessment for a case study on micro-lending in township communities.", keywords: ["risk"] },
      { text: "Social media manager for NWU Economics Society — 1,200 followers.", keywords: [] },
      { text: "Completed BCom Financial Management with distinction in Financial Accounting.", keywords: ["financial modelling", "data analysis"] },
      { text: "Volunteered as tutor for Grade 12 mathematics learners.", keywords: [] },
      { text: "Identified and flagged a data discrepancy in a group project's shared spreadsheet, preventing a reporting error.", keywords: ["compliance", "attention to detail", "excel"] },
    ],
  },
  {
    name: "GreenSpace NGO — Programme Coordinator",
    description: "Environmental education NGO. Seeking community-oriented, communication-focused candidates.",
    keywords: ["community", "stakeholder engagement", "report writing", "project coordination", "communication", "research"],
    blocks: [
      { text: "Coordinated a township environmental awareness campaign reaching 400 residents over 3 weekends.", keywords: ["community", "stakeholder engagement", "project coordination"] },
      { text: "Wrote monthly progress reports for university research project shared with faculty panel.", keywords: ["report writing", "research"] },
      { text: "Presented Excel financial projections to corporate banking stakeholders during a competition.", keywords: [] },
      { text: "Facilitated focus groups with rural community members to gather input on water access issues.", keywords: ["community", "stakeholder engagement", "research", "communication"] },
      { text: "Played goalkeeper in NWU men's soccer team, Vaal Triangle league.", keywords: [] },
      { text: "Drafted funding proposal for student-run environmental project; awarded R8,000 grant.", keywords: ["report writing", "project coordination", "research"] },
      { text: "Built a trading algorithm using Python and backtested it on JSE data.", keywords: [] },
      { text: "Maintained bilingual communication (English/Setswana) with community partners throughout internship.", keywords: ["community", "communication"] },
    ],
  },
  {
    name: "Shoprite Operations Internship",
    description: "Retail chain operations team. Needs reliability, efficiency, and customer-facing skills.",
    keywords: ["customer service", "teamwork", "efficiency", "stock management", "problem-solving", "reliability"],
    blocks: [
      { text: "Worked part-time at Pick n Pay for 14 months — cashier and shelf packer, zero disciplinary incidents.", keywords: ["customer service", "reliability", "teamwork"] },
      { text: "Developed a Python web scraper to collect competitor pricing data for a research project.", keywords: [] },
      { text: "Identified a stock shelving process inefficiency; proposed a rotation system that reduced overstock by 20%.", keywords: ["efficiency", "stock management", "problem-solving"] },
      { text: "Served as floor manager during a night shift when supervisor was absent — managed 6 colleagues.", keywords: ["teamwork", "reliability", "problem-solving"] },
      { text: "Completed a dissertation on consumer behaviour in low-income households (Distinction).", keywords: [] },
      { text: "Resolved a recurring customer complaint about queue times by proposing a second till be opened at peak hours.", keywords: ["customer service", "problem-solving", "efficiency"] },
      { text: "Maintained stock records using spreadsheet system, flagging discrepancies weekly.", keywords: ["stock management", "reliability"] },
      { text: "Recipient of the Faculty of Commerce Dean's Merit Award 2024.", keywords: [] },
    ],
  },
  {
    name: "NWU Research Position — Research Assistant",
    description: "Academic research unit. Needs literature review skills, data integrity, and academic writing.",
    keywords: ["research", "data integrity", "academic writing", "literature review", "statistics", "critical thinking"],
    blocks: [
      { text: "Conducted a systematic literature review of 45 peer-reviewed articles on food security in SA.", keywords: ["research", "literature review", "academic writing"] },
      { text: "Cleaned and validated a 2,000-row dataset using SPSS, identifying and correcting 14 data entry errors.", keywords: ["data integrity", "statistics", "research"] },
      { text: "Event coordinator for campus SRC elections — logistics and voter registration.", keywords: [] },
      { text: "Co-authored a conference paper submitted to the Southern African Business Review (under review).", keywords: ["academic writing", "research", "critical thinking"] },
      { text: "Used STATA to run regression analyses on household income data for honours dissertation.", keywords: ["statistics", "data integrity"] },
      { text: "Earned 'Student of the Year' in the Economics department, 2023.", keywords: [] },
      { text: "Critically evaluated competing theoretical frameworks in an economics essay — awarded 87%.", keywords: ["critical thinking", "academic writing", "literature review"] },
      { text: "Captained university badminton team to regional finals.", keywords: [] },
    ],
  },
  {
    name: "City of Tshwane — Administrative Internship",
    description: "Municipal government office. Values compliance, document management, and public service orientation.",
    keywords: ["administration", "compliance", "document management", "public service", "attention to detail", "communication"],
    blocks: [
      { text: "Processed 200+ citizen query forms weekly during a local government simulation module with zero processing errors.", keywords: ["administration", "attention to detail", "document management"] },
      { text: "Drafted formal correspondence on behalf of an NGO to three government departments.", keywords: ["communication", "public service", "document management"] },
      { text: "Built a Shopify store generating R4,200/month selling handmade goods.", keywords: [] },
      { text: "Maintained a compliance tracking spreadsheet for a research ethics clearance process, flagging overdue items.", keywords: ["compliance", "administration", "attention to detail"] },
      { text: "Completed a Public Administration elective with 82% average — covered municipal budgets and service delivery frameworks.", keywords: ["public service", "compliance", "administration"] },
      { text: "Served as class representative — liaison between 280 students and faculty administration.", keywords: ["communication", "administration"] },
      { text: "Designed a branded pitch deck for a startup competition finalist.", keywords: [] },
      { text: "Ensured document version control during a group research project; maintained a shared log of all revisions.", keywords: ["document management", "compliance", "attention to detail"] },
    ],
  },
];

const ROUND_SECONDS = 60;

type Phase = "idle" | "playing" | "done";

export default function CvOptimizerPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [roundIdx, setRoundIdx] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [roundScores, setRoundScores] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const employer = EMPLOYERS[roundIdx];

  const calcAts = (sel: Set<number>): number => {
    const matchedKeywords = new Set<string>();
    sel.forEach((i) => {
      employer.blocks[i].keywords.forEach((k) => matchedKeywords.add(k));
    });
    const matched = employer.keywords.filter((k) => matchedKeywords.has(k)).length;
    return Math.round((matched / employer.keywords.length) * 100);
  };

  const ats = calcAts(selected);

  const endRound = useCallback(async (finalSelected: Set<number>) => {
    const atsPct = calcAts(finalSelected);
    const timeBonus = timeLeft > 0 ? Math.floor((timeLeft / ROUND_SECONDS) * 30) : 0;
    const roundScore = Math.round((atsPct / 100) * 70) + timeBonus;
    const newScores = [...roundScores, roundScore];
    setRoundScores(newScores);

    if (roundIdx + 1 >= EMPLOYERS.length) {
      setPhase("done");
      const total = newScores.reduce((a, b) => a + b, 0);
      if (!submitted) {
        setSubmitted(true);
        await fetch("/api/games/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameType: "cv_optimizer",
            score: total,
            metadata: { employers: EMPLOYERS.length, avgAts: Math.round(newScores.reduce((a, b) => a + b, 0) / newScores.length) },
          }),
        }).catch(() => {});
      }
    } else {
      setRoundIdx((r) => r + 1);
      setSelected(new Set());
      setTimeLeft(ROUND_SECONDS);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundIdx, roundScores, submitted, timeLeft]);

  useEffect(() => {
    if (phase !== "playing") return;
    if (timeLeft <= 0) { endRound(selected); return; }
    const id = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [phase, timeLeft, selected, endRound]);

  const toggle = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const startGame = () => {
    setRoundIdx(0); setSelected(new Set()); setTimeLeft(ROUND_SECONDS);
    setRoundScores([]); setSubmitted(false); setPhase("playing");
  };

  if (phase === "idle") {
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.intro}>
            <Link className="button" href="/community/games">← Games</Link>
            <h1>CV Optimizer</h1>
            <p className="subtitle">Select the best CV blocks for 5 different employers. Watch your ATS match score rise in real time.</p>
            <div className={styles.howTo}>
              <h3>How to play</h3>
              <ul>
                <li>An employer profile appears with their key requirements.</li>
                <li>Click CV blocks to include or exclude them from your application.</li>
                <li>The ATS score shows how well your CV matches their keywords.</li>
                <li>Submit or wait for time to run out — then move to the next employer.</li>
                <li>60 seconds per employer · 5 employers total.</li>
              </ul>
            </div>
            <button className="button" onClick={startGame}>Start game</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "playing") {
    const timerClass = timeLeft <= 15 ? `${styles.timer} ${styles.timerUrgent}` : styles.timer;
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.header}>
            <span className={styles.round}>Employer {roundIdx + 1} / {EMPLOYERS.length}</span>
            <span className={timerClass}>{timeLeft}s</span>
            <span className={styles.score}>{roundScores.reduce((a, b) => a + b, 0)} pts</span>
          </div>

          <div className={styles.employerCard}>
            <h3>{employer.name}</h3>
            <p>{employer.description}</p>
            <div className={styles.keywords}>
              {employer.keywords.map((k) => <span key={k} className={styles.keyword}>{k}</span>)}
            </div>
          </div>

          <div className={styles.atsBar}>
            <div className={styles.atsLabel}>
              <span>ATS Match Score</span>
              <span>{ats}%</span>
            </div>
            <div className={styles.atsTrack}>
              <div className={styles.atsFill} style={{ width: `${ats}%` }} />
            </div>
          </div>

          <div className={styles.blocksGrid}>
            {employer.blocks.map((block, i) => (
              <div
                key={i}
                className={selected.has(i) ? `${styles.block} ${styles.blockSelected}` : styles.block}
                onClick={() => toggle(i)}
              >
                <span className={styles.blockLabel}>{block.text}</span>
                <span className={styles.blockCheck}>{selected.has(i) ? "✓" : "+"}</span>
              </div>
            ))}
          </div>

          <button className="button" onClick={() => endRound(selected)}>
            {roundIdx + 1 < EMPLOYERS.length ? "Submit & next employer →" : "Submit & finish"}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const total = roundScores.reduce((a, b) => a + b, 0);
    const maxPerRound = 100;
    const max = EMPLOYERS.length * maxPerRound;
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.done}>
            <h1>{total >= 400 ? "Hired 🎉" : total >= 280 ? "Strong Candidate" : "Keep Practising"}</h1>
            <p className={styles.finalScore}>{total} / {max} pts</p>
            <p className="subtitle">
              Tailoring your CV to each employer's keywords — without lying — is the single highest-impact job application skill. Recruiters spend 6 seconds on an initial scan.
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
