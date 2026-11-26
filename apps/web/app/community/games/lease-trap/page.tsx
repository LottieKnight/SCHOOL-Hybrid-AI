"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import styles from "./page.module.css";

type Sentence = {
  id: number;
  text: string;
  isTrap: boolean;
  explanation: string;
};

type LeaseTemplate = {
  name: string;
  tag: string;
  title: string;
  paragraphs: Sentence[][];
};

const TEMPLATES: LeaseTemplate[] = [
  {
    name: "Student Digs",
    tag: "student_digs",
    title: "STUDENT ACCOMMODATION LEASE AGREEMENT",
    paragraphs: [
      [
        { id: 0, text: "This agreement is entered into between the Landlord and the Tenant for the premises situated at 14 Voortrekker Road, Vanderbijlpark.", isTrap: false, explanation: "" },
        { id: 1, text: "The lease commences on 1 February 2025 and terminates on 31 January 2026.", isTrap: false, explanation: "" },
        { id: 2, text: "A security deposit equal to three (3) months' rent shall be paid by the Tenant prior to occupation and shall be non-refundable under all circumstances.", isTrap: true, explanation: "Two traps in one: the Rental Housing Act caps deposits at 2 months' rent, and deposits must be refundable minus legitimate deductions." },
      ],
      [
        { id: 3, text: "Monthly rental is R3,500 payable on or before the 1st of each month.", isTrap: false, explanation: "" },
        { id: 4, text: "In the event of any rental payment being late by more than three days, the Tenant shall be liable for a penalty charge equal to 25% of the monthly rental for each day of delay.", isTrap: true, explanation: "SA law limits penalties to reasonable amounts. A 25%-per-day penalty is unconscionable and unenforceable under the National Credit Act and Consumer Protection Act." },
        { id: 5, text: "The Tenant shall be responsible for electricity and water consumption as metered.", isTrap: false, explanation: "" },
      ],
      [
        { id: 6, text: "The Landlord reserves the right to enter the premises at any time and without prior notice for the purposes of inspection, maintenance, or showing the property to prospective tenants.", isTrap: true, explanation: "The Rental Housing Act §4(2) requires 24-hours' written notice before entry except in genuine emergencies. Entry without notice is a violation of your right to privacy." },
        { id: 7, text: "The Tenant shall not sublet the premises or any part thereof without the written consent of the Landlord.", isTrap: false, explanation: "" },
        { id: 8, text: "The Tenant is responsible for keeping the premises clean and returning it in the same condition as received, fair wear and tear excepted.", isTrap: false, explanation: "" },
      ],
      [
        { id: 9, text: "Should the Tenant wish to terminate this agreement early, one month's written notice shall be provided and a cancellation penalty equal to three months' rent shall be immediately payable.", isTrap: true, explanation: "Cancellation penalties must be reasonable and proportionate. Three months' rent as a flat cancellation fee is excessive and likely unenforceable under the Consumer Protection Act §14." },
        { id: 10, text: "This agreement shall be governed by the laws of the Republic of South Africa.", isTrap: false, explanation: "" },
        { id: 11, text: "By signing below, the Tenant waives all rights afforded to them under the Rental Housing Act and the Consumer Protection Act.", isTrap: true, explanation: "You cannot contract out of statutory protections. This clause is void — the Rental Housing Act and CPA rights apply regardless of what any lease says." },
      ],
    ],
  },
  {
    name: "City Flat",
    tag: "city_flat",
    title: "RESIDENTIAL LEASE AGREEMENT — SECTIONAL TITLE UNIT",
    paragraphs: [
      [
        { id: 0, text: "The property described herein is Unit 7B, Greenfields Sectional Title Scheme, 22 Commissioner Street, Johannesburg.", isTrap: false, explanation: "" },
        { id: 1, text: "A refundable security deposit of two months' rental shall be paid before commencement of occupation.", isTrap: false, explanation: "" },
        { id: 2, text: "The deposit shall be held by the Landlord in a personal savings account and interest accrued shall belong exclusively to the Landlord.", isTrap: true, explanation: "The Rental Housing Act §5(3) requires deposits to be held in an interest-bearing account and the interest belongs to the Tenant, not the Landlord." },
      ],
      [
        { id: 3, text: "Monthly rental is R8,200 for a period of 12 months commencing 1 March 2025.", isTrap: false, explanation: "" },
        { id: 4, text: "The Landlord may increase rental at any time by any amount at his sole discretion with 7 days' notice.", isTrap: true, explanation: "The Rental Housing Act requires reasonable notice for increases (typically aligned with the lease period). Unilateral increases without contractual basis are not permitted." },
        { id: 5, text: "The Tenant may keep one domestic pet with prior written consent of the Body Corporate.", isTrap: false, explanation: "" },
      ],
      [
        { id: 6, text: "The Landlord may inspect the property monthly on the first Saturday of each month between 9am and 12pm upon 24 hours' written notice.", isTrap: false, explanation: "" },
        { id: 7, text: "The Tenant shall not make any alterations to the property without written consent. Any improvements made by the Tenant shall become the property of the Landlord without compensation.", isTrap: true, explanation: "While requiring consent for alterations is lawful, automatically retaining improvements without compensation is an unfair term under the Consumer Protection Act §48." },
        { id: 8, text: "The Tenant is liable for all rates, taxes and levies associated with the unit.", isTrap: false, explanation: "" },
      ],
      [
        { id: 9, text: "In the event of a dispute, the Tenant agrees that the Landlord's valuation of any damage shall be final and binding without any right of appeal.", isTrap: true, explanation: "This removes your right to dispute damage claims independently. The Rental Housing Tribunal exists precisely for these disputes — you cannot waive access to it." },
        { id: 10, text: "This lease may be renewed by mutual written agreement of both parties.", isTrap: false, explanation: "" },
        { id: 11, text: "Should any provision of this agreement be found to be unlawful, the remaining provisions shall continue in full force.", isTrap: false, explanation: "" },
      ],
    ],
  },
  {
    name: "House Share",
    tag: "house_share",
    title: "SHARED DWELLING LEASE AGREEMENT",
    paragraphs: [
      [
        { id: 0, text: "This agreement governs the occupation of one private bedroom in a shared dwelling at 45 Oak Avenue, Potchefstroom, with shared use of common areas.", isTrap: false, explanation: "" },
        { id: 1, text: "A holding deposit of R1,500 is required to reserve the room. This holding deposit is strictly non-refundable regardless of whether the Tenant takes occupation.", isTrap: true, explanation: "Holding deposits must be refunded if a landlord withdraws or materially misrepresents the property. A blanket non-refundable holding deposit clause may violate the CPA." },
        { id: 2, text: "The security deposit of one month's rent is refundable within 14 days of the lease end date, subject to an inspection.", isTrap: false, explanation: "" },
      ],
      [
        { id: 3, text: "Monthly rental per room is R2,800 inclusive of water and refuse removal. Electricity is prepaid.", isTrap: false, explanation: "" },
        { id: 4, text: "The Landlord shall have a master key and may enter any room in the dwelling, including the Tenant's private bedroom, at any time without notice for security purposes.", isTrap: true, explanation: "Even in shared accommodation, a private bedroom is your home. The Rental Housing Act protects your right to privacy and quiet enjoyment — entry requires notice except in emergencies." },
        { id: 5, text: "Guests may stay overnight for a maximum of 3 consecutive nights per month with prior notice to the Landlord.", isTrap: false, explanation: "" },
      ],
      [
        { id: 6, text: "The Tenant agrees that in the event of any dispute with housemates, the Landlord's decision shall be final and may include immediate eviction of any party the Landlord deems responsible.", isTrap: true, explanation: "Eviction requires a court order under the Prevention of Illegal Eviction Act (PIE). A landlord cannot evict you based on their own unilateral decision — this clause is illegal." },
        { id: 7, text: "The Tenant is responsible for maintaining their bedroom and cleaning their allocated kitchen shelves.", isTrap: false, explanation: "" },
        { id: 8, text: "All Tenants are jointly liable for damage to common areas if individual responsibility cannot be determined.", isTrap: false, explanation: "" },
      ],
      [
        { id: 9, text: "This lease shall automatically renew on a month-to-month basis unless either party provides one calendar month's written notice of termination.", isTrap: false, explanation: "" },
        { id: 10, text: "The Tenant shall pay a monthly 'administration fee' of R350 directly to the Landlord in addition to rental. This fee covers the Landlord's costs of managing the property.", isTrap: true, explanation: "Additional fees on top of rent (beyond what the lease clearly specifies) are not permitted under the Rental Housing Act unless agreed in the lease from the start. Hidden admin fees are a common trap." },
        { id: 11, text: "By taking occupation, the Tenant confirms they have read and understood this agreement.", isTrap: false, explanation: "" },
      ],
    ],
  },
];

const TIMER_MAX = 120;
const LIVES_MAX = 3;
const TRAPS_PER_TEMPLATE = 5;

type Phase = "idle" | "playing" | "done";

export default function LeaseTrapPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [templateIdx, setTemplateIdx] = useState(0);
  const [lives, setLives] = useState(LIVES_MAX);
  const [timeLeft, setTimeLeft] = useState(TIMER_MAX);
  const [score, setScore] = useState(0);
  const [highlighted, setHighlighted] = useState<Set<number>>(new Set());
  const [correct, setCorrect] = useState<Set<number>>(new Set());
  const [wrong, setWrong] = useState<Set<number>>(new Set());
  const [clausesFound, setClausesFound] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<{ id: number; text: string } | null>(null);

  const template = TEMPLATES[templateIdx];
  const allSentences = template.paragraphs.flat();

  const endGame = useCallback(async (finalScore: number, foundCount: number, livesLeft: number) => {
    setPhase("done");
    if (!submitted) {
      setSubmitted(true);
      await fetch("/api/games/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameType: "lease_trap",
          score: finalScore,
          metadata: { template: TEMPLATES[templateIdx].tag, clausesFound: foundCount, lives: livesLeft },
        }),
      }).catch(() => {});
    }
  }, [submitted, templateIdx]);

  useEffect(() => {
    if (phase !== "playing") return;
    if (timeLeft <= 0) {
      endGame(score, clausesFound, lives);
      return;
    }
    const id = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [phase, timeLeft, score, clausesFound, lives, endGame]);

  const startGame = (tIdx: number) => {
    setTemplateIdx(tIdx);
    setLives(LIVES_MAX);
    setTimeLeft(TIMER_MAX);
    setScore(0);
    setHighlighted(new Set());
    setCorrect(new Set());
    setWrong(new Set());
    setClausesFound(0);
    setSubmitted(false);
    setFeedback(null);
    setPhase("playing");
  };

  const handleSentenceClick = (sentence: Sentence) => {
    if (phase !== "playing") return;
    if (correct.has(sentence.id) || wrong.has(sentence.id)) return;

    if (sentence.isTrap) {
      const newCorrect = new Set(correct).add(sentence.id);
      const newFound = clausesFound + 1;
      const timeBonus = Math.floor(timeLeft / 10);
      const newScore = score + 20 + timeBonus;
      setCorrect(newCorrect);
      setClausesFound(newFound);
      setScore(newScore);
      setFeedback({ id: sentence.id, text: sentence.explanation });
      if (newFound >= TRAPS_PER_TEMPLATE) {
        setTimeout(() => endGame(newScore, newFound, lives), 1200);
      }
    } else {
      const newWrong = new Set(wrong).add(sentence.id);
      const newLives = lives - 1;
      const newScore = Math.max(0, score - 10);
      setWrong(newWrong);
      setLives(newLives);
      setScore(newScore);
      setFeedback({ id: sentence.id, text: "Not a trap clause — this is standard lease language." });
      if (newLives <= 0) {
        setTimeout(() => endGame(newScore, clausesFound, 0), 800);
      }
    }

    setHighlighted((prev) => new Set(prev).add(sentence.id));
    setTimeout(() => {
      setFeedback(null);
    }, 3000);
  };

  const getSentenceClass = (id: number) => {
    if (correct.has(id)) return `${styles.sentence} ${styles.sentenceCorrect}`;
    if (wrong.has(id)) return `${styles.sentence} ${styles.sentenceWrong}`;
    if (highlighted.has(id)) return `${styles.sentence} ${styles.sentenceHighlighted}`;
    return styles.sentence;
  };

  if (phase === "idle") {
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.intro}>
            <Link className="button" href="/community/games">← Games</Link>
            <h1>Lease Trap</h1>
            <p className="subtitle">Three real SA lease templates with illegal clauses buried in legalese. Find them before time runs out.</p>
            <div className={styles.howTo}>
              <h3>How to play</h3>
              <ul>
                <li>Read the lease and click on suspicious sentences.</li>
                <li>Correct trap = 20 points + time bonus.</li>
                <li>Wrong click = lose a life (you have 3).</li>
                <li>Find all 5 illegal clauses to win the template.</li>
                <li>You have 120 seconds.</li>
              </ul>
            </div>
            <p style={{ fontSize: "0.85rem", fontWeight: 600 }}>Choose a lease template:</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {TEMPLATES.map((t, i) => (
                <button key={i} className="button" onClick={() => startGame(i)}>{t.name}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "playing") {
    const timerClass = timeLeft <= 20 ? `${styles.timer} ${styles.timerUrgent}` : styles.timer;
    const heartsDisplay = "❤️".repeat(lives) + "🖤".repeat(LIVES_MAX - lives);
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.header}>
            <span className={styles.templateTag}>{template.name}</span>
            <span className={styles.lives}>{heartsDisplay}</span>
            <span className={timerClass}>{timeLeft}s</span>
            <span className={styles.score}>{score} pts · {clausesFound}/{TRAPS_PER_TEMPLATE} found</span>
          </div>

          <div className={styles.instruction}>
            Click on sentences that contain illegal or unfair lease clauses under South African law.
          </div>

          {feedback && (
            <div className={styles.instruction} style={{ background: "rgba(34,197,94,0.1)", borderColor: "rgba(34,197,94,0.3)", marginTop: -8 }}>
              {feedback.text}
            </div>
          )}

          <div className={styles.leaseDoc}>
            <div className={styles.leaseTitle}>{template.title}</div>
            {template.paragraphs.map((para, pi) => (
              <p key={pi} className={styles.paragraph}>
                {para.map((sentence) => (
                  <span
                    key={sentence.id}
                    className={getSentenceClass(sentence.id)}
                    onClick={() => handleSentenceClick(sentence)}
                  >
                    {sentence.text}{" "}
                  </span>
                ))}
              </p>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const traps = allSentences.filter((s) => s.isTrap);
    const missedIds = traps.filter((s) => !correct.has(s.id));
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.done}>
            <h1>{clausesFound >= 5 ? "Sharp Tenant 🏆" : clausesFound >= 3 ? "Getting There" : "The Landlord Won This Time"}</h1>
            <p className={styles.finalScore}>{score} points · {clausesFound}/{TRAPS_PER_TEMPLATE} traps found</p>
          </div>

          <div className={styles.resultList}>
            {traps.map((sentence) => {
              const wasFound = correct.has(sentence.id);
              return (
                <div key={sentence.id} className={`${styles.resultRow} ${wasFound ? styles.correct : styles.missed}`}>
                  <div>
                    <strong style={{ fontSize: "0.8rem" }}>"{sentence.text.slice(0, 80)}…"</strong>
                    <p>{sentence.explanation}</p>
                  </div>
                  <span className={styles.tick}>{wasFound ? "✓" : "○"}</span>
                </div>
              );
            })}
          </div>

          <div className={styles.doneActions}>
            {TEMPLATES.map((t, i) => (
              <button key={i} className="button" onClick={() => startGame(i)}>{t.name}</button>
            ))}
            <Link className="button" href="/community/games">All games</Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
