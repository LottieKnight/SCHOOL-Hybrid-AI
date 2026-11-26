export const POD_PRODUCT_KINDS = ["workbook", "textbook", "color"] as const;

export type PodProductKind = (typeof POD_PRODUCT_KINDS)[number];

export type PodPricingInput = {
  printCostCents: number;
  shippingCostCents: number;
  fixedFeesCents: number;
  paymentFeeRate: number;
  riskBufferRate: number;
  targetMarginRate: number;
  vatRate?: number;
  vatInclusive?: boolean;
  roundingStepCents?: number;
};

export type PodPricingBreakdown = {
  costBaseCents: number;
  denominator: number;
  recommendedRetailCentsExVat: number;
  recommendedRetailCentsIncVat: number;
  roundedRecommendedCentsExVat: number;
  roundedRecommendedCentsIncVat: number;
  vatRate: number;
  vatInclusive: boolean;
};

export function defaultTargetMarginRate(kind: PodProductKind) {
  switch (kind) {
    case "workbook":
      return 0.4;
    case "textbook":
      return 0.3;
    case "color":
      return 0.25;
    default:
      return 0.3;
  }
}

function clampRate(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(0.94, value));
}

function roundUpToStep(cents: number, stepCents: number) {
  const step = Math.max(1, Math.floor(stepCents || 1));
  return Math.ceil(Math.max(0, cents) / step) * step;
}

export function recommendPodRetailPrice(input: PodPricingInput): PodPricingBreakdown {
  const printCost = Math.max(0, Math.floor(input.printCostCents || 0));
  const shippingCost = Math.max(0, Math.floor(input.shippingCostCents || 0));
  const fixedFees = Math.max(0, Math.floor(input.fixedFeesCents || 0));
  const paymentFeeRate = clampRate(input.paymentFeeRate);
  const riskBufferRate = clampRate(input.riskBufferRate);
  const targetMarginRate = clampRate(input.targetMarginRate);
  const vatRate = clampRate(input.vatRate ?? 0.15);
  const vatInclusive = input.vatInclusive ?? true;
  const roundingStepCents = Math.max(1, Math.floor(input.roundingStepCents ?? 100));

  const denominator = 1 - paymentFeeRate - riskBufferRate - targetMarginRate;
  if (!(denominator > 0)) {
    throw new Error("Combined fee, risk, and margin rates must be less than 100%.");
  }

  const costBaseCents = printCost + shippingCost + fixedFees;
  const recommendedRetailCentsExVat = Math.ceil(costBaseCents / denominator);
  const recommendedRetailCentsIncVat = Math.ceil(recommendedRetailCentsExVat * (1 + vatRate));
  const roundedRecommendedCentsExVat = roundUpToStep(recommendedRetailCentsExVat, roundingStepCents);
  const roundedRecommendedCentsIncVat = roundUpToStep(recommendedRetailCentsIncVat, roundingStepCents);

  return {
    costBaseCents,
    denominator,
    recommendedRetailCentsExVat,
    recommendedRetailCentsIncVat,
    roundedRecommendedCentsExVat,
    roundedRecommendedCentsIncVat,
    vatRate,
    vatInclusive,
  };
}
