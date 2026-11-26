"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

type Difficulty = "easy" | "normal" | "hard";

type Expense = {
  name: string;
  amount: number;
  note: string;
  essential: boolean;
};

type Event = {
  description: string;
  delta: number;
};

const DIFFICULTIES: Record<Difficulty, { label: string; budget: number; multiplier: number }> = {
  easy:   { label: "Easy",   budget: 5500, multiplier: 1 },
  normal: { label: "Normal", budget: 4500, multiplier: 1.5 },
  hard:   { label: "Hard",   budget: 3800, multiplier: 2 },
};

const EXPENSES: Expense[] = [
  { name: "Rent / Digs",         amount: 3200, note: "Monthly room or flat rental",             essential: true },
  { name: "Mobile data",         amount: 199,  note: "10GB prepaid bundle",                     essential: false },
  { name: "Taxi / transport",    amount: 450,  note: "Return trips to campus for the month",    essential: true },
  { name: "Groceries & food",    amount: 800,  note: "Basic groceries, no eating out",          essential: true },
  { name: "Textbooks & printing",amount: 600,  note: "Prescribed texts and module prints",      essential: false },
  { name: "Medical / toiletries",amount: 350,  note: "Toiletries, medication, and health costs",essential: false },
  { name: "Electricity (prepaid)",amount: 250, note: "Prepaid units for the month",             essential: true },
  { name: "Airtime",             amount: 79,   note: "Voice calls not covered by data",         essential: false },
  { name: "Stationery",         amount: 120,   note: "Pens, notebooks, file folders",           essential: false },
  { name: "Laundry",            amount: 90,    note: "Laundromat or washing powder",            essential: true },
];

const EVENTS: Event[] = [
  { description: "🎉 Bursary top-up arrived! +R500 added to your budget.", delta: 500 },
  { description: "⚡ Load-shedding damaged your laptop charger. Emergency replacement: –R280.", delta: -280 },
  { description: "🚌 Taxi strike this week — Uber alternative costs extra: –R200.", delta: -200 },
  { description: "📚 Lecturer added a new prescribed textbook: –R180.", delta: -180 },
  { description: "🍕 Friends birthday dinner — you chip in: –R120.", delta: -120 },
  { description: "💸 NSFAS allowance paid early! +R350 bonus this month.", delta: 350 },
  { description: "🏥 Stomach bug — pharmacy visit and meds: –R150.", delta: -150 },
  { description: "📱 Your phone screen cracked. Repair: –R320.", delta: -320 },
];

type HistoryItem = { name: string; amount: number; paid: boolean; isEvent?: boolean };
type Phase = "idle" | "playing" | "done";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function BudgetBlockPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [balance, setBalance] = useState(0);
  const [initialBudget, setInitialBudget] = useState(0);
  const [queue, setQueue] = useState<Expense[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [pendingEvent, setPendingEvent] = useState<Event | null>(null);
  const [eventIdx, setEventIdx] = useState(0);
  const [shuffledEvents, setShuffledEvents] = useState<Event[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [finalBalance, setFinalBalance] = useState(0);

  const startGame = (diff: Difficulty) => {
    setDifficulty(diff);
    const budget = DIFFICULTIES[diff].budget;
    setBalance(budget);
    setInitialBudget(budget);
    setQueue(shuffle(EXPENSES));
    setHistory([]);
    setShuffledEvents(shuffle(EVENTS));
    setEventIdx(0);
    setPendingEvent(null);
    setSubmitted(false);
    setPhase("playing");
  };

  const maybeSpawnEvent = (currentQueue: Expense[], currentEventIdx: number, events: Event[]) => {
    // Trigger an event roughly every 3 expenses
    if (currentQueue.length % 3 === 0 && currentEventIdx < events.length) {
      setPendingEvent(events[currentEventIdx]);
      return currentEventIdx + 1;
    }
    return currentEventIdx;
  };

  const handlePay = () => {
    if (!queue.length) return;
    const expense = queue[0];
    const newBalance = balance - expense.amount;
    const newQueue = queue.slice(1);

    if (newBalance < 0) {
      setFinalBalance(newBalance);
      endGame(newBalance, [...history, { name: expense.name, amount: expense.amount, paid: true }]);
      return;
    }

    const newHistory = [...history, { name: expense.name, amount: expense.amount, paid: true }];
    setBalance(newBalance);
    setHistory(newHistory);
    setQueue(newQueue);

    if (!newQueue.length) {
      setFinalBalance(newBalance);
      endGame(newBalance, newHistory);
      return;
    }

    const newEventIdx = maybeSpawnEvent(newQueue, eventIdx, shuffledEvents);
    setEventIdx(newEventIdx);
  };

  const handleSkip = () => {
    if (!queue.length) return;
    const expense = queue[0];
    const newQueue = queue.slice(1);
    const newHistory = [...history, { name: expense.name, amount: expense.amount, paid: false }];
    setHistory(newHistory);
    setQueue(newQueue);

    if (!newQueue.length) {
      setFinalBalance(balance);
      endGame(balance, newHistory);
      return;
    }

    const newEventIdx = maybeSpawnEvent(newQueue, eventIdx, shuffledEvents);
    setEventIdx(newEventIdx);
  };

  const dismissEvent = () => {
    if (!pendingEvent) return;
    const newBalance = balance + pendingEvent.delta;
    setBalance(Math.max(0, newBalance));
    setHistory((h) => [...h, { name: pendingEvent.description, amount: Math.abs(pendingEvent.delta), paid: pendingEvent.delta < 0, isEvent: true }]);
    setPendingEvent(null);
    if (newBalance < 0) {
      setFinalBalance(newBalance);
      endGame(newBalance, history);
    }
  };

  const endGame = async (bal: number, hist: HistoryItem[]) => {
    setPhase("done");
    const mult = DIFFICULTIES[difficulty].multiplier;
    const score = bal > 0 ? Math.round(200 + bal * mult * 0.05) : Math.max(0, Math.round(200 + bal * 0.5));
    const paidCount = hist.filter((h) => h.paid && !h.isEvent).length;
    if (!submitted) {
      setSubmitted(true);
      await fetch("/api/games/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameType: "budget_block",
          score,
          metadata: { difficulty, monthsSurvived: bal >= 0 ? 1 : 0, finalBalance: bal, paidCount },
        }),
      }).catch(() => {});
    }
  };

  if (phase === "idle") {
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.intro}>
            <Link className="button" href="/community/games">← Games</Link>
            <h1>Budget Block</h1>
            <p className="subtitle">Survive a student month on a NSFAS budget. Pay or skip each expense — but run out of money and it's game over.</p>
            <div className={styles.howTo}>
              <h3>How to play</h3>
              <ul>
                <li>Expenses appear one at a time. Click Pay or Skip for each.</li>
                <li>Random events (bursary, strikes, emergencies) adjust your balance.</li>
                <li>If your balance hits R0 — game over.</li>
                <li>Whatever is left at the end is your score (×difficulty multiplier).</li>
              </ul>
            </div>
            <p style={{ fontSize: "0.85rem", fontWeight: 600 }}>Choose difficulty:</p>
            <div className={styles.difficultyRow}>
              {(["easy", "normal", "hard"] as Difficulty[]).map((d) => (
                <button key={d} className="button" onClick={() => startGame(d)}>
                  {DIFFICULTIES[d].label} (R{DIFFICULTIES[d].budget.toLocaleString()})
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "playing") {
    const usedPct = Math.min(100, Math.round(((initialBudget - balance) / initialBudget) * 100));
    const fillColor = usedPct > 85 ? "#dc2626" : usedPct > 60 ? "#f59e0b" : "#10b981";
    const expense = queue[0];

    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.budgetBar}>
            <div className={styles.budgetLabels}>
              <span>Balance</span>
              <span style={{ fontWeight: 700 }}>R{balance.toLocaleString()}</span>
            </div>
            <div className={styles.budgetTrack}>
              <div className={styles.budgetFill} style={{ width: `${100 - usedPct}%`, background: fillColor }} />
            </div>
          </div>

          {pendingEvent ? (
            <>
              <div className={styles.eventBanner}>{pendingEvent.description}</div>
              <button className="button" onClick={dismissEvent}>Continue →</button>
            </>
          ) : expense ? (
            <>
              <div className={styles.expenseCard}>
                <p className={styles.expenseName}>{expense.name}</p>
                <p className={styles.expenseAmount}>R{expense.amount.toLocaleString()}</p>
                <p className={styles.expenseNote}>{expense.note}</p>
              </div>
              <div className={styles.actions}>
                <button className={`button ${styles.actionPay}`} onClick={handlePay}>Pay — R{expense.amount}</button>
                <button className={`button ${styles.actionSkip}`} onClick={handleSkip}>Skip</button>
              </div>
            </>
          ) : null}

          {history.length > 0 && (
            <div className={styles.history}>
              {[...history].reverse().slice(0, 5).map((h, i) => (
                <div key={i} className={`${styles.historyRow} ${h.paid ? styles.historyPaid : styles.historySkipped}`}>
                  <span>{h.name}</span>
                  <span>{h.paid ? `–R${h.amount}` : "skipped"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const survived = finalBalance >= 0;
    const mult = DIFFICULTIES[difficulty].multiplier;
    const score = survived
      ? Math.round(200 + finalBalance * mult * 0.05)
      : Math.max(0, Math.round(200 + finalBalance * 0.5));
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.done}>
            <h1>{survived ? "Month Survived! 💪" : "Budget Overrun"}</h1>
            <p className={styles.finalScore}>{score} points</p>
            <p className={styles.balanceDisplay}>
              {survived
                ? `R${finalBalance.toLocaleString()} left over · ${DIFFICULTIES[difficulty].label} difficulty`
                : `Ran R${Math.abs(finalBalance).toLocaleString()} over budget`}
            </p>
            <p className="subtitle">
              {survived
                ? "Well done — you navigated a student budget without falling short. Every rand saved is financial resilience built."
                : "Many students face this reality every month. Understanding where cuts are possible vs. essential is a life skill."}
            </p>
            <div className={styles.doneActions}>
              {(["easy", "normal", "hard"] as Difficulty[]).map((d) => (
                <button key={d} className="button" onClick={() => startGame(d)}>{DIFFICULTIES[d].label}</button>
              ))}
              <Link className="button" href="/community/games">All games</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
