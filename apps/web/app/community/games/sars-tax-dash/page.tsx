"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

type Level = {
  title: string;
  description: string;
  income: number;
  paye: number;
  uif: number;
  medicalAid: number;
  travelAllowance: number;
  travelUsedForBusiness: number;
  sideIncome: number;
  medicalCreditMonths: number;
  fields: {
    grossIncome: number;
    taxableIncome: number;
    taxBeforeCredits: number;
    medicalCredit: number;
    refundOrPayable: number;
  };
};

// 2025/26 SA tax brackets (simplified)
function calcTax(taxableIncome: number): number {
  if (taxableIncome <= 237100) return taxableIncome * 0.18;
  if (taxableIncome <= 370500) return 42678 + (taxableIncome - 237100) * 0.26;
  if (taxableIncome <= 512800) return 77362 + (taxableIncome - 370500) * 0.31;
  if (taxableIncome <= 673000) return 121475 + (taxableIncome - 512800) * 0.36;
  if (taxableIncome <= 857900) return 179147 + (taxableIncome - 673000) * 0.39;
  if (taxableIncome <= 1817000) return 251258 + (taxableIncome - 857900) * 0.41;
  return 644489 + (taxableIncome - 1817000) * 0.45;
}

// Primary rebate 2025/26
const PRIMARY_REBATE = 17235;
// Medical credit: R364 per month for taxpayer + first dependent
const MEDICAL_CREDIT_RATE = 364;

const LEVELS: Level[] = (() => {
  // Level 1: Simple employment income only
  const l1_salary = 120000;
  const l1_paye = 18000;
  const l1_uif = 1200;
  const l1_medical = 3600;
  const l1_medMonths = 12;
  const l1_gross = l1_salary;
  const l1_taxable = l1_gross - l1_medical;
  const l1_taxRaw = calcTax(l1_taxable);
  const l1_taxAfterRebate = Math.max(0, l1_taxRaw - PRIMARY_REBATE);
  const l1_medCredit = l1_medMonths * MEDICAL_CREDIT_RATE;
  const l1_taxFinal = Math.max(0, l1_taxAfterRebate - l1_medCredit);
  const l1_refund = l1_paye - l1_taxFinal;

  // Level 2: Travel allowance added
  const l2_salary = 180000;
  const l2_paye = 30000;
  const l2_uif = 1800;
  const l2_medical = 4320;
  const l2_travel = 24000;
  const l2_travelBusiness = 12000;
  const l2_medMonths = 12;
  const l2_taxableTravel = l2_travel - l2_travelBusiness;
  const l2_gross = l2_salary + l2_taxableTravel;
  const l2_taxable = l2_gross - l2_medical;
  const l2_taxRaw = calcTax(l2_taxable);
  const l2_taxAfterRebate = Math.max(0, l2_taxRaw - PRIMARY_REBATE);
  const l2_medCredit = l2_medMonths * MEDICAL_CREDIT_RATE;
  const l2_taxFinal = Math.max(0, l2_taxAfterRebate - l2_medCredit);
  const l2_refund = l2_paye - l2_taxFinal;

  // Level 3: Side income + more complex
  const l3_salary = 240000;
  const l3_paye = 42000;
  const l3_uif = 2400;
  const l3_medical = 5040;
  const l3_side = 36000;
  const l3_medMonths = 12;
  const l3_gross = l3_salary + l3_side;
  const l3_taxable = l3_gross - l3_medical;
  const l3_taxRaw = calcTax(l3_taxable);
  const l3_taxAfterRebate = Math.max(0, l3_taxRaw - PRIMARY_REBATE);
  const l3_medCredit = l3_medMonths * MEDICAL_CREDIT_RATE;
  const l3_taxFinal = Math.max(0, l3_taxAfterRebate - l3_medCredit);
  const l3_refund = l3_paye - l3_taxFinal;

  return [
    {
      title: "Level 1: Basic Employment",
      description: "You have a single salary. No side income. Employer deducted PAYE and UIF. Calculate your refund or tax payable.",
      income: l1_salary,
      paye: l1_paye,
      uif: l1_uif,
      medicalAid: l1_medical,
      travelAllowance: 0,
      travelUsedForBusiness: 0,
      sideIncome: 0,
      medicalCreditMonths: l1_medMonths,
      fields: {
        grossIncome: Math.round(l1_gross),
        taxableIncome: Math.round(l1_taxable),
        taxBeforeCredits: Math.round(l1_taxAfterRebate),
        medicalCredit: Math.round(l1_medCredit),
        refundOrPayable: Math.round(l1_refund),
      },
    },
    {
      title: "Level 2: Travel Allowance",
      description: "You receive a travel allowance. Only the portion used for business travel is tax-deductible. Calculate your tax with the adjustment.",
      income: l2_salary,
      paye: l2_paye,
      uif: l2_uif,
      medicalAid: l2_medical,
      travelAllowance: l2_travel,
      travelUsedForBusiness: l2_travelBusiness,
      sideIncome: 0,
      medicalCreditMonths: l2_medMonths,
      fields: {
        grossIncome: Math.round(l2_gross),
        taxableIncome: Math.round(l2_taxable),
        taxBeforeCredits: Math.round(l2_taxAfterRebate),
        medicalCredit: Math.round(l2_medCredit),
        refundOrPayable: Math.round(l2_refund),
      },
    },
    {
      title: "Level 3: Side Income",
      description: "You also earned freelance income. Side income must be declared and added to your taxable income.",
      income: l3_salary,
      paye: l3_paye,
      uif: l3_uif,
      medicalAid: l3_medical,
      travelAllowance: 0,
      travelUsedForBusiness: 0,
      sideIncome: l3_side,
      medicalCreditMonths: l3_medMonths,
      fields: {
        grossIncome: Math.round(l3_gross),
        taxableIncome: Math.round(l3_taxable),
        taxBeforeCredits: Math.round(l3_taxAfterRebate),
        medicalCredit: Math.round(l3_medCredit),
        refundOrPayable: Math.round(l3_refund),
      },
    },
  ];
})();

type FormState = Record<string, string>;
type Phase = "idle" | "playing" | "result" | "done";

const FIELD_KEYS = ["grossIncome", "taxableIncome", "taxBeforeCredits", "medicalCredit", "refundOrPayable"] as const;
const FIELD_LABELS: Record<string, string> = {
  grossIncome: "Gross income (R)",
  taxableIncome: "Taxable income after deductions (R)",
  taxBeforeCredits: "Tax after primary rebate (R)",
  medicalCredit: "Medical tax credit (R)",
  refundOrPayable: "Refund (+) or Tax Payable (−) (R)",
};

function tolerance(actual: number, entered: number): boolean {
  return Math.abs(actual - entered) <= 5;
}

export default function SarsTaxDashPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [levelIdx, setLevelIdx] = useState(0);
  const [form, setForm] = useState<FormState>({});
  const [submitted, setSubmitted] = useState(false);
  const [totalScore, setTotalScore] = useState(0);
  const [levelResults, setLevelResults] = useState<{ key: string; correct: boolean; expected: number; entered: number }[][]>([]);

  const level = LEVELS[levelIdx];

  const startGame = () => {
    setLevelIdx(0);
    setForm({});
    setSubmitted(false);
    setTotalScore(0);
    setLevelResults([]);
    setPhase("playing");
  };

  const submitLevel = () => {
    const results = FIELD_KEYS.map((key) => {
      const expected = level.fields[key];
      const entered = parseFloat(form[key] ?? "");
      return { key, correct: !isNaN(entered) && tolerance(expected, entered), expected, entered: isNaN(entered) ? 0 : entered };
    });
    const score = results.filter((r) => r.correct).length * 20;
    setTotalScore((prev) => prev + score);
    setLevelResults((prev) => [...prev, results]);
    setPhase("result");
  };

  const nextLevel = async () => {
    const next = levelIdx + 1;
    if (next >= LEVELS.length) {
      setPhase("done");
      if (!submitted) {
        setSubmitted(true);
        await fetch("/api/games/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameType: "sars_tax_dash", score: totalScore, metadata: { levels: LEVELS.length } }),
        }).catch(() => {});
      }
    } else {
      setLevelIdx(next);
      setForm({});
      setPhase("playing");
    }
  };

  const fmt = (n: number) => `R ${n.toLocaleString("en-ZA")}`;

  if (phase === "idle") {
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.intro}>
            <Link className="button" href="/community/games">← Games</Link>
            <h1>SARS Tax Dash</h1>
            <p className="subtitle">Simulate the SA income tax return process. Use the 2025/26 tax tables to calculate your refund or tax payable.</p>
            <div className={styles.infoBox}>
              <h3>Tax rules used</h3>
              <ul>
                <li>2025/26 brackets (18%–45%)</li>
                <li>Primary rebate: R17,235</li>
                <li>Medical credit: R364/month per member</li>
                <li>UIF: 1% of salary (not tax-deductible by employee)</li>
                <li>Medical aid contributions: deductible as fringe benefit</li>
              </ul>
            </div>
            <button className="button" onClick={startGame}>Start filing</button>
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
            <span className={styles.levelTag}>{level.title}</span>
            <span className={styles.score}>{totalScore} pts</span>
          </div>
          <p className={styles.description}>{level.description}</p>

          <div className={styles.incomeSummary}>
            <h3 className={styles.sectionLabel}>Your IRP5 / Income Info</h3>
            <div className={styles.summaryGrid}>
              <span>Salary income</span><span>{fmt(level.income)}</span>
              <span>PAYE already deducted</span><span>{fmt(level.paye)}</span>
              <span>UIF deducted</span><span>{fmt(level.uif)}</span>
              <span>Medical aid contributions</span><span>{fmt(level.medicalAid)}</span>
              {level.travelAllowance > 0 && <>
                <span>Travel allowance received</span><span>{fmt(level.travelAllowance)}</span>
                <span>Portion used for business</span><span>{fmt(level.travelUsedForBusiness)}</span>
              </>}
              {level.sideIncome > 0 && <><span>Freelance / side income</span><span>{fmt(level.sideIncome)}</span></>}
              <span>Medical credit months</span><span>{level.medicalCreditMonths}</span>
            </div>
          </div>

          <div className={styles.formSection}>
            <h3 className={styles.sectionLabel}>Your eFiling return</h3>
            {FIELD_KEYS.map((key) => (
              <label key={key} className={styles.formField}>
                <span>{FIELD_LABELS[key]}</span>
                <input
                  type="number"
                  placeholder="Enter amount"
                  value={form[key] ?? ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </label>
            ))}
          </div>

          <button className="button" onClick={submitLevel}>Submit return</button>
        </div>
      </div>
    );
  }

  if (phase === "result") {
    const results = levelResults[levelResults.length - 1];
    const correct = results.filter((r) => r.correct).length;
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.header}>
            <span className={styles.levelTag}>{level.title}</span>
            <span className={styles.score}>{correct * 20} pts this level · {totalScore} total</span>
          </div>
          <div className={styles.resultGrid}>
            {results.map((r) => (
              <div key={r.key} className={`${styles.resultRow} ${r.correct ? styles.correct : styles.wrong}`}>
                <span className={styles.resultLabel}>{FIELD_LABELS[r.key]}</span>
                <div className={styles.resultValues}>
                  <span className={styles.expected}>Expected: {fmt(r.expected)}</span>
                  <span className={r.correct ? styles.yourCorrect : styles.yourWrong}>
                    You entered: {r.entered > 0 ? fmt(r.entered) : "—"}
                  </span>
                </div>
                <span className={styles.tick}>{r.correct ? "✓" : "✗"}</span>
              </div>
            ))}
          </div>
          <button className="button" onClick={nextLevel}>
            {levelIdx + 1 < LEVELS.length ? `Next: ${LEVELS[levelIdx + 1].title} →` : "See final score"}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const maxScore = LEVELS.length * FIELD_KEYS.length * 20;
    const pct = Math.round((totalScore / maxScore) * 100);
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.done}>
            <h1>{pct === 100 ? "SARS Certified" : pct >= 70 ? "Tax Savvy" : "Keep Practising"}</h1>
            <p className={styles.finalScore}>{totalScore} / {maxScore} pts · {pct}%</p>
            <p className="subtitle">Understanding your tax obligations is a fundamental life skill. SARS e-Filing is free and available to all South Africans.</p>
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
