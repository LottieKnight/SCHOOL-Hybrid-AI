// apps/api/src/services/pricing.ts
// Economic, South-Africa-first subscription pricing for SCHOOL.
// Goal: make quality CAPS education affordable for low-income SA learners while
// sustaining the platform (wallet/credit economy already exists for marketplace).
//
// Tiers (ZAR, monthly, VAT-inclusive pricing shown to users):
//   free    — R0      : core lessons + past papers + limited AI tutor (no paywall on learning)
//   scholar — R29/mo  : full access + unlimited AI tutor + spaced repetition + exam readiness
//   family  — R59/mo  : up to 4 learner profiles under one payer
//   school  — R199/mo : class management + teacher dashboard + analytics (per educator)
//   bursary — R0      : sponsored seat (NPO/school/bursary sponsor pays) — same access as scholar
//
// Design principle (per operator mandate): learning content itself is NEVER paywalled.
// Only convenience/AI/personalisation features are gated. This maximises access for
// students in need while monetising power features.

export type PlanTier = "free" | "scholar" | "family" | "school" | "bursary" | "trial";

export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  priceZAR: number; // per month, VAT-inclusive
  currency: "ZAR";
  maxLearners: number; // learner profiles allowed under one payer
  features: {
    fullLessons: boolean; // all CAPS lessons + past papers (always true — not paywalled)
    aiTutor: boolean; // RAG-grounded tutor
    spacedRepetition: boolean;
    examReadiness: boolean;
    adaptivePractice: boolean;
    offlineAccess: boolean;
    teacherDashboard: boolean;
    classManagement: boolean;
    noAds: boolean;
    sponsored: boolean; // paid by a third party, not the learner
  };
  payfastAmountCents: number; // PayFast expects cents
}

export const PLANS: Record<PlanTier, PlanDefinition> = {
  free: {
    tier: "free",
    name: "Free",
    priceZAR: 0,
    currency: "ZAR",
    maxLearners: 1,
    features: {
      fullLessons: true,
      aiTutor: false,
      spacedRepetition: false,
      examReadiness: false,
      adaptivePractice: false,
      offlineAccess: false,
      teacherDashboard: false,
      classManagement: false,
      noAds: false,
      sponsored: false,
    },
    payfastAmountCents: 0,
  },
  scholar: {
    tier: "scholar",
    name: "Scholar",
    priceZAR: 29,
    currency: "ZAR",
    maxLearners: 1,
    features: {
      fullLessons: true,
      aiTutor: true,
      spacedRepetition: true,
      examReadiness: true,
      adaptivePractice: true,
      offlineAccess: true,
      teacherDashboard: false,
      classManagement: false,
      noAds: true,
      sponsored: false,
    },
    payfastAmountCents: 2900,
  },
  family: {
    tier: "family",
    name: "Family",
    priceZAR: 59,
    currency: "ZAR",
    maxLearners: 4,
    features: {
      fullLessons: true,
      aiTutor: true,
      spacedRepetition: true,
      examReadiness: true,
      adaptivePractice: true,
      offlineAccess: true,
      teacherDashboard: false,
      classManagement: false,
      noAds: true,
      sponsored: false,
    },
    payfastAmountCents: 5900,
  },
  school: {
    tier: "school",
    name: "School",
    priceZAR: 199,
    currency: "ZAR",
    maxLearners: 40,
    features: {
      fullLessons: true,
      aiTutor: true,
      spacedRepetition: true,
      examReadiness: true,
      adaptivePractice: true,
      offlineAccess: true,
      teacherDashboard: true,
      classManagement: true,
      noAds: true,
      sponsored: false,
    },
    payfastAmountCents: 19900,
  },
  bursary: {
    tier: "bursary",
    name: "Bursary / Sponsored",
    priceZAR: 0,
    currency: "ZAR",
    maxLearners: 1,
    features: {
      fullLessons: true,
      aiTutor: true,
      spacedRepetition: true,
      examReadiness: true,
      adaptivePractice: true,
      offlineAccess: true,
      teacherDashboard: false,
      classManagement: false,
      noAds: true,
      sponsored: true,
    },
    payfastAmountCents: 0,
  },
  trial: {
    tier: "trial",
    name: "Trial",
    priceZAR: 0,
    currency: "ZAR",
    maxLearners: 1,
    features: {
      fullLessons: true,
      aiTutor: true,
      spacedRepetition: true,
      examReadiness: true,
      adaptivePractice: true,
      offlineAccess: false,
      teacherDashboard: false,
      classManagement: false,
      noAds: true,
      sponsored: false,
    },
    payfastAmountCents: 0,
  },
};

export const DEFAULT_TIER: PlanTier = "free";

/** Tiers that count as "paid" for gating (bursary is free-to-learner but full-access). */
export const PAID_TIERS: PlanTier[] = ["scholar", "family", "school", "bursary"];

export function isPaidTier(tier: string | null | undefined): boolean {
  if (!tier) return false;
  const t = tier.toLowerCase() as PlanTier;
  return PAID_TIERS.includes(t);
}

export function getPlan(tier: string | null | undefined): PlanDefinition {
  if (!tier) return PLANS[DEFAULT_TIER];
  const t = tier.toLowerCase() as PlanTier;
  return PLANS[t] ?? PLANS[DEFAULT_TIER];
}

/**
 * Calculate the subscription cost for a tenant (used by billing/admin reporting).
 * Returns ZAR. Token/API usage is NOT billed to end-users (platform absorbs infra
 * cost; monetisation is via flat tiers + marketplace credits).
 */
export const calculatePricing = async (
  tenantId: string,
  usage: { tokens: number; apiCalls: number },
  tier: PlanTier = DEFAULT_TIER
) => {
  const plan = getPlan(tier);
  // Flat tier price; usage not billed to learner. Kept for API compatibility.
  void tenantId;
  void usage;
  return {
    tenantId,
    cost: plan.priceZAR,
    currency: "ZAR" as const,
    tier: plan.tier,
    name: plan.name,
  };
};
