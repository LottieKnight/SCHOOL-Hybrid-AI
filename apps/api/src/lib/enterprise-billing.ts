// apps/api/src/lib/enterprise-billing.ts
//
// Enterprise institutional pricing catalogue (E1 -> G1) and quoting engine.
//
// Pricing model (from the Institutional Pricing Calculator):
//   E1  School Basic      R50,000    /yr  (<=500 learners, <=10 educators)
//   E2  School Pro        R150,000   /yr  (<=2,000 learners, <=50 educators)
//   E3  School Enterprise R500,000   /yr  (unlimited learners)
//   U1  University Basic  R1,000,000 /yr  (<=5,000 students)
//   U2  University Pro    R3,000,000 /yr  (<=25,000 students)
//   U3  University Ent.   R5,000,000 /yr  (unlimited students)
//   G1  Government        R5,000,000 /yr  (100,000+ learners, negotiated)
//
// Discounts:
//   annual (vs monthly)           10%
//   multi-year (2-yr)             15%
//   multi-year (3-yr)             20%
//   eligibility for bursary/ED on E1 (public/historical disadvantaged)
//
// Quote engine computes annual/monthly cost, per-learner price, savings vs a
// user-supplied current-cost baseline, ROI and payback - mirroring the sales
// calculator so institutional quotes are consistent across channels.

export type EnterpriseTier =
  | "E1" | "E2" | "E3"
  | "U1" | "U2" | "U3"
  | "G1";

export interface TierDefinition {
  tier: EnterpriseTier;
  name: string;
  market: "school" | "university" | "government";
  annualPriceZar: number;
  monthlyPriceZar: number;
  maxLearners: number | null; // null = unlimited
  maxEducators: number | null;
  perLearnerAnnual: number; // at full seat capacity
  features: string[];
}

export const ENTERPRISE_TIERS: Record<EnterpriseTier, TierDefinition> = {
  E1: {
    tier: "E1", name: "School Basic", market: "school",
    annualPriceZar: 50_000, monthlyPriceZar: 4_167,
    maxLearners: 500, maxEducators: 10,
    perLearnerAnnual: 100,
    features: ["Core LMS", "AI tutor", "Bulk CSV user import", "Standard support"],
  },
  E2: {
    tier: "E2", name: "School Pro", market: "school",
    annualPriceZar: 150_000, monthlyPriceZar: 12_500,
    maxLearners: 2_000, maxEducators: 50,
    perLearnerAnnual: 75,
    features: ["Everything in E1", "SAML / OIDC SSO", "Advanced analytics", "Priority support"],
  },
  E3: {
    tier: "E3", name: "School Enterprise", market: "school",
    annualPriceZar: 500_000, monthlyPriceZar: 41_667,
    maxLearners: null, maxEducators: null,
    perLearnerAnnual: 50,
    features: ["Everything in E2", "Unlimited seats", "Custom branding", "Dedicated success manager"],
  },
  U1: {
    tier: "U1", name: "University Basic", market: "university",
    annualPriceZar: 1_000_000, monthlyPriceZar: 83_333,
    maxLearners: 5_000, maxEducators: null,
    perLearnerAnnual: 200,
    features: ["Everything in E3", "Programme-level administration", "SCIM provisioning", "Research analytics"],
  },
  U2: {
    tier: "U2", name: "University Pro", market: "university",
    annualPriceZar: 3_000_000, monthlyPriceZar: 250_000,
    maxLearners: 25_000, maxEducators: null,
    perLearnerAnnual: 120,
    features: ["Everything in U1", "Multiple faculties", "Advanced RLS tenancy", "SLA with uptime guarantee"],
  },
  U3: {
    tier: "U3", name: "University Enterprise", market: "university",
    annualPriceZar: 5_000_000, monthlyPriceZar: 416_667,
    maxLearners: null, maxEducators: null,
    perLearnerAnnual: 100,
    features: ["Everything in U2", "Unlimited students", "Custom integrations", "On-site cohort governance"],
  },
  G1: {
    tier: "G1", name: "Government / SETA", market: "government",
    annualPriceZar: 5_000_000, monthlyPriceZar: 416_667,
    maxLearners: null, maxEducators: null,
    perLearnerAnnual: 50,
    features: ["Everything in U3", "Provincial/national roll-out", "Low-touch per-learner pricing", "Tender & POPIA alignment"],
  },
};

export type BillingCycle = "monthly" | "annual" | "multi_year";

export type BillingMode = "flat_tier" | "per_seat";

/** Compute sticker price for a tier under a given purchase option. */
export function initQuote(input: {
  tier: EnterpriseTier;
  learners?: number;
  cycle?: BillingCycle;
  years?: number;
  eligibleForEd?: boolean; // public/historical disadvantaged on E1
}): Required<Pick<typeof input, "tier" | "cycle" | "years">> & { priceZar: number; notes: string[] } {
  const tier = input.tier;
  const cycle: BillingCycle = input.cycle ?? "annual";
  const years = Math.min(Math.max(Math.floor(input.years ?? 1), 1), 3);
  const def = ENTERPRISE_TIERS[tier];
  const notes: string[] = [];

  const learners = Math.max(input.learners ?? 1, 1);
  if (def.maxLearners !== null && learners > def.maxLearners) {
    notes.push(`Enrollment of ${learners} exceeds ${tier} capacity (${def.maxLearners}); a higher tier is recommended.`);
  }

  let annualPrice = def.annualPriceZar;
  if (cycle === "monthly") {
    annualPrice = def.annualPriceZar * 1.1111; // undiscounted = monthly x12 vs annual offers 10%
  } else if (cycle === "multi_year" && years > 1) {
    const discount = years >= 3 ? 0.20 : 0.15;
    annualPrice = def.annualPriceZar * (1 - discount);
    notes.push(`Multi-year ${years}-yr contract: applied ${Math.round(discount * 100)}% discount.`);
  } else {
    notes.push("Annual contract: 10% discount vs monthly applied.");
  }

  if (input.eligibleForEd && tier === "E1") {
    annualPrice *= 0.7; // 30% public-sector / B-BBEE alignment discount
    notes.push("E1 public/ed discount (30%) applied.");
  }

  return { tier, cycle, years, priceZar: Math.round(annualPrice), notes };
}

/**
 * Full ROI-style quote consistent with the Institutional Pricing Calculator:
 * computes per-learner cost, savings against a baseline, ROI and payback.
 */
export function buildQuote(input: {
  tier: EnterpriseTier;
  learners: number;
  educators?: number;
  cycle?: BillingCycle;
  years?: number;
  currentAnnualCostZar?: number;
  eligibleForEd?: boolean;
}) {
  const pricing = initQuote(input);
  const tier = ENTERPRISE_TIERS[input.tier];
  const learners = Math.max(input.learners, 1);
  const educators = Math.max(input.educators ?? 0, 1);
  const perLearnerAnnual = tier.perLearnerAnnual;
  const monthlyPrice = Math.round(pricing.priceZar / 12);

  const baseline = Math.max(input.currentAnnualCostZar ?? pricing.priceZar * 3, 0);
  const directSavings = Math.max(baseline - pricing.priceZar, 0);
  const efficiency = educators * 8.5 * 52 * 300; // 8.5 hrs/wk saved, R300/hr avg
  const totalBenefit = directSavings + efficiency;
  const roi = pricing.priceZar > 0 ? ((totalBenefit - pricing.priceZar) / pricing.priceZar) * 100 : 0;
  const paybackMonths = totalBenefit > 0 ? (pricing.priceZar / (totalBenefit / 12)) : null;

  return {
    tier: input.tier,
    tierName: tier.name,
    cycle: pricing.cycle,
    years: pricing.years,
    learners,
    educators,
    annualPriceZar: pricing.priceZar,
    monthlyPriceZar: monthlyPrice,
    perLearnerAnnual,
    baselineCostZar: baseline,
    directSavingsZar: Math.round(directSavings),
    efficiencyValueZar: Math.round(efficiency),
    totalBenefitZar: Math.round(totalBenefit),
    roiPercent: Math.round(roi),
    paybackMonths: paybackMonths ? Number(paybackMonths.toFixed(1)) : null,
    notes: pricing.notes,
  };
}

export function tierCatalog(): TierDefinition[] {
  return Object.values(ENTERPRISE_TIERS);
}
