import type { Metadata } from "next";
import { WalletPageClient } from "@/components/WalletPageClient";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { DETAILED_REPORT_CREDIT_COST } from "@/lib/pastPapers/entitlements";

export const metadata: Metadata = {
  title: "Wallet",
  description: "Manage SCHOOL wallet credits, top-ups, and spend history.",
  openGraph: {
    title: "Wallet | SCHOOL",
    description: "Manage SCHOOL wallet credits, top-ups, and spend history.",
    url: "/wallet",
    images: ["/images/icons/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Wallet | SCHOOL",
    description: "Manage SCHOOL wallet credits, top-ups, and spend history.",
    images: ["/images/icons/og-image.png"],
  },
};

export default function WalletPage() {
  return (
    <section className="card glass" style={{ display: "grid", gap: "var(--space-4)" }}>
      <RouteHeader
        eyebrow="Wallet"
        title="Credits, top-ups, and spend without clutter."
        description="Review your balance, top up quickly, and track where SCHOOL credits are actually going."
        size={74}
      />
      <WalletPageClient detailedReportCredits={DETAILED_REPORT_CREDIT_COST} />
    </section>
  );
}

