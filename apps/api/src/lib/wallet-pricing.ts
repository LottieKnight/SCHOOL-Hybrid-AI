import { findWalletCreditBundle, pricingConfig, type WalletCreditBundle } from "./pricing-config.js";

export const walletPricing = {
  currency: pricingConfig.currency,
  creditsPerZar: pricingConfig.wallet.creditsPerZar,
  minTopupZar: pricingConfig.wallet.minTopupZar,
  maxTopupZar: pricingConfig.wallet.maxTopupZar,
  detailedReportCredits: pricingConfig.features.detailedReportCredits,
  featurePrices: {
    detailedReportCredits: pricingConfig.features.detailedReportCredits,
  },
  bundles: pricingConfig.wallet.bundles.map((bundle) => ({ ...bundle })),
};

export function creditsFromZar(amountZar: number) {
  const credits = Math.round(amountZar * walletPricing.creditsPerZar);
  return Math.max(1, credits);
}

export function clampTopupZar(amountZar: number) {
  return Math.max(walletPricing.minTopupZar, Math.min(walletPricing.maxTopupZar, amountZar));
}

export function zarFromCredits(credits: number) {
  return credits / walletPricing.creditsPerZar;
}

export type WalletTopupSelection = {
  bundle: WalletCreditBundle | null;
  amountZar: number;
  baseCredits: number;
  bonusCredits: number;
  totalCredits: number;
};

export function resolveWalletTopupSelection(input: {
  amountZar?: number | null;
  bundleId?: string | null;
}): WalletTopupSelection | null {
  const bundle = findWalletCreditBundle(input.bundleId);
  if (bundle) {
    return {
      bundle,
      amountZar: bundle.amountZar,
      baseCredits: bundle.baseCredits,
      bonusCredits: bundle.bonusCredits,
      totalCredits: bundle.totalCredits,
    };
  }

  if (typeof input.amountZar !== "number" || !Number.isFinite(input.amountZar) || input.amountZar <= 0) {
    return null;
  }

  const normalizedAmountZar = Number(input.amountZar.toFixed(2));
  const baseCredits = creditsFromZar(normalizedAmountZar);
  return {
    bundle: null,
    amountZar: normalizedAmountZar,
    baseCredits,
    bonusCredits: 0,
    totalCredits: baseCredits,
  };
}
