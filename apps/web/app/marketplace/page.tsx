import type { Metadata } from "next";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { MarketplaceClient } from "@/components/marketplace/MarketplaceClient";

export const metadata: Metadata = {
  title: "Marketplace | SCHOOL",
  description:
    "The SCHOOL marketplace — bookstore, clothing, cosmetics, and courses. Browse the campus economy from one shelf of stores.",
  openGraph: {
    title: "Marketplace | SCHOOL",
    description:
      "The SCHOOL marketplace — bookstore, clothing, cosmetics, and courses. Browse the campus economy from one shelf of stores.",
    url: "/marketplace",
    images: ["/images/icons/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Marketplace | SCHOOL",
    description:
      "The SCHOOL marketplace — bookstore, clothing, cosmetics, and courses. Browse the campus economy from one shelf of stores.",
    images: ["/images/icons/og-image.png"],
  },
};

export default function MarketplacePage() {
  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <RouteHeader
        eyebrow="Marketplace"
        title="Four stores. One campus economy."
        description="Hover a store to step inside — books, threads, glow, and knowledge all live under one roof."
      />
      <MarketplaceClient />
    </div>
  );
}
