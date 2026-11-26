import { config } from "../config.js";

type WalletBundleSeed = {
  id: "starter" | "growth" | "mastery";
  name: string;
  description: string;
  amountZar: number;
  bonusRate: number;
};

export type WalletBundleId = WalletBundleSeed["id"];

export type WalletCreditBundle = {
  id: WalletBundleId;
  name: string;
  description: string;
  amountZar: number;
  bonusPercent: number;
  baseCredits: number;
  bonusCredits: number;
  totalCredits: number;
};

const walletBundleSeeds: WalletBundleSeed[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Entry bundle for one or two detailed report unlocks.",
    amountZar: 10,
    bonusRate: 0,
  },
  {
    id: "growth",
    name: "Growth",
    description: "Most popular bundle with bonus credits for weekly progress loops.",
    amountZar: 25,
    bonusRate: 0.1,
  },
  {
    id: "mastery",
    name: "Mastery",
    description: "Best value bundle with the largest bonus credit boost.",
    amountZar: 50,
    bonusRate: 0.2,
  },
];

function toWalletBundle(seed: WalletBundleSeed): WalletCreditBundle {
  const baseCredits = Math.max(1, Math.round(seed.amountZar * config.walletCreditsPerZar));
  const bonusCredits = Math.max(0, Math.round(baseCredits * seed.bonusRate));
  return {
    id: seed.id,
    name: seed.name,
    description: seed.description,
    amountZar: Number(seed.amountZar.toFixed(2)),
    bonusPercent: Math.round(seed.bonusRate * 100),
    baseCredits,
    bonusCredits,
    totalCredits: baseCredits + bonusCredits,
  };
}

const walletBundles: WalletCreditBundle[] = walletBundleSeeds.map(toWalletBundle);

export const pricingConfig = {
  currency: "ZAR" as const,
  wallet: {
    creditsPerZar: config.walletCreditsPerZar,
    minTopupZar: 0.1,
    maxTopupZar: 2000,
    bundles: walletBundles,
  },
  features: {
    detailedReportCredits: Math.max(1, Math.trunc(config.walletDetailedReportCredits)),
  },
};

export function getDetailedReportCredits() {
  return pricingConfig.features.detailedReportCredits;
}

export function findWalletCreditBundle(bundleId: string | null | undefined) {
  if (typeof bundleId !== "string") return null;
  const normalized = bundleId.trim().toLowerCase();
  if (!normalized) return null;
  return pricingConfig.wallet.bundles.find((bundle) => bundle.id === normalized) ?? null;
}
