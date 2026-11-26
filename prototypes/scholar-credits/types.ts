export type VentureType =
  | 'SCHOOL'
  | 'AURA'
  | 'SPHERE'
  | 'NPC'
  | 'ROCKIT'
  | 'SCENE'
  | 'LOGISTICS'
  | 'V4NTAG3'
  | 'DITSHGO_VENTURES';

// JSON-safe value type compatible with Prisma's Json fields (top-level null not allowed)
export type JsonValue = string | number | boolean | { [key: string]: JsonValue | null } | JsonValue[];

export type CreditTransactionType =
  | 'EARN'
  | 'SPEND'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'BONUS'
  | 'PENALTY'
  | 'REFUND'
  | 'ADJUSTMENT';

export type CreditSource =
  // SCHOOL
  | 'QUESTION_ACCEPTED'
  | 'ANSWER_POSTED'
  | 'DAILY_QUIZ_COMPLETE'
  | 'DAILY_QUIZ_STREAK'
  | 'PAST_PAPER_UPLOAD'
  | 'MODULE_ROOM_PARTICIPATION'
  | 'GAME_BRAZIL_COMPLETE'
  | 'GAME_EXAM_DASH_HIGH_SCORE'
  | 'STUDY_PLANNER_TASK_COMPLETE'
  | 'REFERRAL_SIGNUP'
  | 'CONTENT_CONTRIBUTION'
  // NPC
  | 'INCUBATOR_APPLICATION'
  | 'INCUBATOR_ACCEPTANCE'
  | 'MENTORSHIP_SESSION'
  | 'WORKSHOP_ATTENDANCE'
  | 'PITCH_EVENT_PARTICIPATION'
  | 'FUNDING_MILESTONE'
  // V4NTAG3
  | 'TOURNAMENT_PARTICIPATION'
  | 'TOURNAMENT_WIN'
  | 'TOURNAMENT_PLACEMENT'
  | 'ESPORTS_TEAM_JOIN'
  | 'STREAM_VIEWERSHIP'
  // SPHERE
  | 'PAPER_TRADE_PROFIT'
  | 'STRATEGY_SUBMISSION'
  | 'BACKTEST_VALIDATION'
  | 'RISK_MANAGEMENT_PASS'
  // AURA
  | 'MODEL_FEEDBACK'
  | 'TRANSLATION_CONTRIBUTION'
  | 'BENCHMARK_RUN'
  | 'DATASET_CONTRIBUTION'
  // Cross-venture
  | 'CROSS_VENTURE_BONUS'
  | 'LOYALTY_MILESTONE'
  | 'FOUNDER_RECOGNITION'
  | 'COMMUNITY_CHAMPION'
  // Redemption
  | 'DATA_BUNDLE_PURCHASE'
  | 'MERCHANDISE_PURCHASE'
  | 'WORKSHOP_FEE'
  | 'TOURNAMENT_ENTRY'
  | 'PREMIUM_FEATURE_UNLOCK'
  | 'BURSARY_APPLICATION_BOOST'
  | 'MENTORSHIP_CREDITS';

export interface CreditTransaction {
  id: string;
  userId: number;
  walletId?: number;
  venture: VentureType;
  type: CreditTransactionType;
  source: CreditSource;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  metadata?: JsonValue;
  idempotencyKey?: string;
  referenceId?: string;
  referenceType?: string;
  processedAt: Date;
  createdAt: Date;
}

export interface CreditWallet {
  id: number;
  userId: number;
  venture: VentureType;
  balance: number;
  locked: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserCredits {
  userId: number;
  totalBalance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  currentStreak: number;
  longestStreak: number;
  wallets: CreditWallet[];
  recentTransactions: CreditTransaction[];
}

export interface EarnCreditsRequest {
  userId: number;
  venture: VentureType;
  source: CreditSource;
  amount: number;
  description: string;
  metadata?: JsonValue;
  idempotencyKey?: string;
  referenceId?: string;
  referenceType?: string;
}

export interface SpendCreditsRequest {
  userId: number;
  venture: VentureType;
  source: CreditSource;
  amount: number;
  description: string;
  metadata?: JsonValue;
  idempotencyKey?: string;
  referenceId?: string;
  referenceType?: string;
}

export interface TransferCreditsRequest {
  fromUserId: number;
  toUserId: number;
  venture: VentureType;
  amount: number;
  description: string;
  metadata?: JsonValue;
  idempotencyKey?: string;
}

export interface RedemptionRequest {
  userId: number;
  venture: VentureType;
  source: CreditSource;
  amount: number;
  itemId: string;
  itemType: string;
  itemName: string;
  metadata?: JsonValue;
}

export interface CreditBalanceResponse {
  success: boolean;
  balance: number;
  wallets: CreditWallet[];
  lifetimeEarned: number;
  lifetimeSpent: number;
}

export interface TransactionResponse {
  success: boolean;
  transaction?: CreditTransaction;
  error?: string;
  code?: string;
}

export interface RedemptionResponse {
  success: boolean;
  redemptionId?: string;
  error?: string;
  code?: string;
}

export interface RateLimitInfo {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  maxCount: number;
}

// Credit earning rules configuration
export const CREDIT_RULES: Record<CreditSource, { amount: number; maxPerDay?: number; maxPerWeek?: number; cooldownMs?: number }> = {
  // SCHOOL
  QUESTION_ACCEPTED: { amount: 20, maxPerDay: 10 },
  ANSWER_POSTED: { amount: 5, maxPerDay: 50 },
  DAILY_QUIZ_COMPLETE: { amount: 10, maxPerDay: 1 },
  DAILY_QUIZ_STREAK: { amount: 50, maxPerDay: 1 },
  PAST_PAPER_UPLOAD: { amount: 100, maxPerDay: 5 },
  MODULE_ROOM_PARTICIPATION: { amount: 2, maxPerDay: 100 },
  GAME_BRAZIL_COMPLETE: { amount: 100, maxPerDay: 3 },
  GAME_EXAM_DASH_HIGH_SCORE: { amount: 50, maxPerDay: 10 },
  STUDY_PLANNER_TASK_COMPLETE: { amount: 5, maxPerDay: 20 },
  REFERRAL_SIGNUP: { amount: 500, maxPerDay: 10 },
  CONTENT_CONTRIBUTION: { amount: 200, maxPerDay: 10 },

  // NPC
  INCUBATOR_APPLICATION: { amount: 100 },
  INCUBATOR_ACCEPTANCE: { amount: 2000 },
  MENTORSHIP_SESSION: { amount: 50, maxPerDay: 5 },
  WORKSHOP_ATTENDANCE: { amount: 200, maxPerDay: 3 },
  PITCH_EVENT_PARTICIPATION: { amount: 500 },
  FUNDING_MILESTONE: { amount: 5000 },

  // V4NTAG3
  TOURNAMENT_PARTICIPATION: { amount: 100 },
  TOURNAMENT_WIN: { amount: 2000 },
  TOURNAMENT_PLACEMENT: { amount: 500 },
  ESPORTS_TEAM_JOIN: { amount: 200 },
  STREAM_VIEWERSHIP: { amount: 10, maxPerDay: 50 },

  // SPHERE
  PAPER_TRADE_PROFIT: { amount: 100, maxPerDay: 10 },
  STRATEGY_SUBMISSION: { amount: 200 },
  BACKTEST_VALIDATION: { amount: 300 },
  RISK_MANAGEMENT_PASS: { amount: 500 },

  // AURA
  MODEL_FEEDBACK: { amount: 20, maxPerDay: 50 },
  TRANSLATION_CONTRIBUTION: { amount: 100, maxPerDay: 20 },
  BENCHMARK_RUN: { amount: 500 },
  DATASET_CONTRIBUTION: { amount: 1000 },

  // Cross-venture
  CROSS_VENTURE_BONUS: { amount: 1000 },
  LOYALTY_MILESTONE: { amount: 5000 },
  FOUNDER_RECOGNITION: { amount: 10000 },
  COMMUNITY_CHAMPION: { amount: 2000 },

  // Redemption (negative amounts handled in spend logic)
  DATA_BUNDLE_PURCHASE: { amount: -50 },
  MERCHANDISE_PURCHASE: { amount: -500 },
  WORKSHOP_FEE: { amount: -2000 },
  TOURNAMENT_ENTRY: { amount: -100 },
  PREMIUM_FEATURE_UNLOCK: { amount: -1000 },
  BURSARY_APPLICATION_BOOST: { amount: -500 },
  MENTORSHIP_CREDITS: { amount: -1000 },
};

export function getCreditRule(source: CreditSource) {
  return CREDIT_RULES[source] || { amount: 0 };
}

export function isEarnSource(source: CreditSource): boolean {
  const rule = CREDIT_RULES[source];
  return rule.amount > 0;
}

export function isSpendSource(source: CreditSource): boolean {
  const rule = CREDIT_RULES[source];
  return rule.amount < 0;
}

export function getVentureDisplayName(venture: VentureType): string {
  const names: Record<VentureType, string> = {
    SCHOOL: 'SCHOOL Technologies',
    AURA: 'AURA AI Laboratories',
    SPHERE: 'Cryptic SPHERE',
    NPC: 'Getting Started NPC',
    ROCKIT: 'ROCKit Records',
    SCENE: 'SCENE Media',
    LOGISTICS: 'Ditshego Trade & Logistics',
    V4NTAG3: 'V4NTAG3 Esports',
    DITSHGO_VENTURES: 'Ditshego Ventures',
  };
  return names[venture] || venture;
}

export function getSourceDisplayName(source: CreditSource): string {
  const names: Record<CreditSource, string> = {
    QUESTION_ACCEPTED: 'Answer Accepted',
    ANSWER_POSTED: 'Answer Posted',
    DAILY_QUIZ_COMPLETE: 'Daily Quiz Completed',
    DAILY_QUIZ_STREAK: 'Daily Quiz Streak',
    PAST_PAPER_UPLOAD: 'Past Paper Uploaded',
    MODULE_ROOM_PARTICIPATION: 'Module Room Participation',
    GAME_BRAZIL_COMPLETE: 'BRAZIL Game Completed',
    GAME_EXAM_DASH_HIGH_SCORE: 'Exam Dash High Score',
    STUDY_PLANNER_TASK_COMPLETE: 'Study Task Completed',
    REFERRAL_SIGNUP: 'Referral Signup',
    CONTENT_CONTRIBUTION: 'Content Contribution',
    INCUBATOR_APPLICATION: 'Incubator Application',
    INCUBATOR_ACCEPTANCE: 'Incubator Accepted',
    MENTORSHIP_SESSION: 'Mentorship Session',
    WORKSHOP_ATTENDANCE: 'Workshop Attended',
    PITCH_EVENT_PARTICIPATION: 'Pitch Event',
    FUNDING_MILESTONE: 'Funding Milestone',
    TOURNAMENT_PARTICIPATION: 'Tournament Participation',
    TOURNAMENT_WIN: 'Tournament Winner',
    TOURNAMENT_PLACEMENT: 'Tournament Placement',
    ESPORTS_TEAM_JOIN: 'Esports Team Joined',
    STREAM_VIEWERSHIP: 'Stream Viewership',
    PAPER_TRADE_PROFIT: 'Paper Trade Profit',
    STRATEGY_SUBMISSION: 'Strategy Submitted',
    BACKTEST_VALIDATION: 'Backtest Validated',
    RISK_MANAGEMENT_PASS: 'Risk Management Passed',
    MODEL_FEEDBACK: 'Model Feedback',
    TRANSLATION_CONTRIBUTION: 'Translation Contribution',
    BENCHMARK_RUN: 'Benchmark Run',
    DATASET_CONTRIBUTION: 'Dataset Contribution',
    CROSS_VENTURE_BONUS: 'Cross-Venture Bonus',
    LOYALTY_MILESTONE: 'Loyalty Milestone',
    FOUNDER_RECOGNITION: 'Founder Recognition',
    COMMUNITY_CHAMPION: 'Community Champion',
    DATA_BUNDLE_PURCHASE: 'Data Bundle Purchase',
    MERCHANDISE_PURCHASE: 'Merchandise Purchase',
    WORKSHOP_FEE: 'Workshop Fee',
    TOURNAMENT_ENTRY: 'Tournament Entry',
    PREMIUM_FEATURE_UNLOCK: 'Premium Feature Unlock',
    BURSARY_APPLICATION_BOOST: 'Bursary Application Boost',
    MENTORSHIP_CREDITS: 'Mentorship Credits',
  };
  return names[source] || source;
}