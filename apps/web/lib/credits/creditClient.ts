// Browser client + shared vocabulary for the unified Scholar Credits economy.
//
// Mirrors apps/api/src/lib/credit-rules.ts (single source of truth for the API)
// and apps/api/src/routes/credits.ts response shapes, so the PWA renders the
// same UPPER_SNAKE enums with no case-mapping bugs.

import { API_BASE } from "@/lib/apiBase";

export type CreditVenture =
  | "SCHOOL"
  | "AURA"
  | "SPHERE"
  | "NPC"
  | "ROCKIT"
  | "SCENE"
  | "LOGISTICS"
  | "V4NTAG3"
  | "DITSHGO_VENTURES";

export type CreditWallet = {
  id: string;
  userId: string;
  venture: string;
  balance: number;
  locked: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CreditTransaction = {
  id: string;
  userId: string;
  walletId: string;
  venture: string;
  type: string;
  source: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  idempotencyKey: string | null;
  referenceId: string | null;
  referenceType: string | null;
  processedAt: string;
  createdAt: string;
};

export type CreditsBalance = {
  success: boolean;
  balance: number;
  wallets: CreditWallet[];
  lifetimeEarned: number;
  lifetimeSpent: number;
  currentStreak: number;
  longestStreak: number;
  recentTransactions: CreditTransaction[];
};

export const VENTURE_ORDER: readonly CreditVenture[] = [
  "SCHOOL",
  "AURA",
  "SPHERE",
  "NPC",
  "ROCKIT",
  "SCENE",
  "LOGISTICS",
  "V4NTAG3",
  "DITSHGO_VENTURES",
];

const VENTURE_DISPLAY_NAMES: Record<CreditVenture, string> = {
  SCHOOL: "SCHOOL Technologies",
  AURA: "AURA AI Laboratories",
  SPHERE: "Cryptic SPHERE",
  NPC: "Getting Started NPC",
  ROCKIT: "ROCKit Records",
  SCENE: "SCENE Media",
  LOGISTICS: "Ditshego Trade & Logistics",
  V4NTAG3: "V4NTAG3 Esports",
  DITSHGO_VENTURES: "Ditshego Ventures",
};

export function getVentureDisplayName(venture: string): string {
  return VENTURE_DISPLAY_NAMES[venture as CreditVenture] ?? venture;
}

const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  QUESTION_ACCEPTED: "Answer Accepted",
  ANSWER_POSTED: "Answer Posted",
  DAILY_QUIZ_COMPLETE: "Daily Quiz Completed",
  DAILY_QUIZ_STREAK: "Daily Quiz Streak",
  PAST_PAPER_UPLOAD: "Past Paper Uploaded",
  MODULE_ROOM_PARTICIPATION: "Module Room Participation",
  GAME_BRAZIL_COMPLETE: "BRAZIL Game Completed",
  GAME_EXAM_DASH_HIGH_SCORE: "Exam Dash High Score",
  STUDY_PLANNER_TASK_COMPLETE: "Study Task Completed",
  REFERRAL_SIGNUP: "Referral Signup",
  CONTENT_CONTRIBUTION: "Content Contribution",
  INCUBATOR_APPLICATION: "Incubator Application",
  INCUBATOR_ACCEPTANCE: "Incubator Accepted",
  MENTORSHIP_SESSION: "Mentorship Session",
  WORKSHOP_ATTENDANCE: "Workshop Attended",
  PITCH_EVENT_PARTICIPATION: "Pitch Event",
  FUNDING_MILESTONE: "Funding Milestone",
  TOURNAMENT_PARTICIPATION: "Tournament Participation",
  TOURNAMENT_WIN: "Tournament Winner",
  TOURNAMENT_PLACEMENT: "Tournament Placement",
  ESPORTS_TEAM_JOIN: "Esports Team Joined",
  STREAM_VIEWERSHIP: "Stream Viewership",
  PAPER_TRADE_PROFIT: "Paper Trade Profit",
  STRATEGY_SUBMISSION: "Strategy Submitted",
  BACKTEST_VALIDATION: "Backtest Validated",
  RISK_MANAGEMENT_PASS: "Risk Management Passed",
  MODEL_FEEDBACK: "Model Feedback",
  TRANSLATION_CONTRIBUTION: "Translation Contribution",
  BENCHMARK_RUN: "Benchmark Run",
  DATASET_CONTRIBUTION: "Dataset Contribution",
  CROSS_VENTURE_BONUS: "Cross-Venture Bonus",
  LOYALTY_MILESTONE: "Loyalty Milestone",
  FOUNDER_RECOGNITION: "Founder Recognition",
  COMMUNITY_CHAMPION: "Community Champion",
  DATA_BUNDLE_PURCHASE: "Data Bundle Purchase",
  MERCHANDISE_PURCHASE: "Merchandise Purchase",
  WORKSHOP_FEE: "Workshop Fee",
  TOURNAMENT_ENTRY: "Tournament Entry",
  PREMIUM_FEATURE_UNLOCK: "Premium Feature Unlock",
  BURSARY_APPLICATION_BOOST: "Bursary Application Boost",
  MENTORSHIP_CREDITS: "Mentorship Credits",
};

export function getSourceDisplayName(source: string): string {
  return SOURCE_DISPLAY_NAMES[source] ?? source;
}

export class CreditsApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, detail: unknown) {
    super(`Credits API error ${status}`);
    this.name = "CreditsApiError";
    this.status = status;
    this.detail = detail;
  }
}

function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)saedu_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export const CREDITS_BALANCE_URL = () => `${API_BASE}/credits/balance`;

export async function fetchCreditsBalance(): Promise<CreditsBalance> {
  const response = await fetch(CREDITS_BALANCE_URL(), { credentials: "include" });
  if (!response.ok) {
    let detail: unknown = null;
    try {
      detail = await response.json();
    } catch {
      // non-JSON error body — ignore
    }
    throw new CreditsApiError(response.status, detail);
  }
  return (await response.json()) as CreditsBalance;
}

export async function postCreditsEarn(body: {
  venture: CreditVenture;
  source: string;
  amount?: number;
  description?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
  referenceId?: string;
  referenceType?: string;
}): Promise<{ success: boolean; account?: { balance?: number }; alreadyProcessed?: boolean }> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const csrfToken = getCsrfToken();
  if (csrfToken) headers["x-csrf-token"] = csrfToken;
  const response = await fetch(`${API_BASE}/credits/earn`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let detail: unknown = null;
    try {
      detail = await response.json();
    } catch {
      // ignore
    }
    throw new CreditsApiError(response.status, detail);
  }
  return (await response.json()) as { success: boolean; account?: { balance?: number }; alreadyProcessed?: boolean };
}
