import type { Metadata } from "next";
import { ScholarCreditsClient } from "@/components/ScholarCreditsClient";
import { RouteHeader } from "@/components/ui/RouteHeader";

export const metadata: Metadata = {
  title: "Scholar Credits",
  description: "Your unified Scholar Credits balance across every Ditshego venture.",
  openGraph: {
    title: "Scholar Credits | SCHOOL",
    description: "Your unified Scholar Credits balance across every Ditshego venture.",
    url: "/credits",
    images: ["/images/icons/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Scholar Credits | SCHOOL",
    description: "Your unified Scholar Credits balance across every Ditshego venture.",
    images: ["/images/icons/og-image.png"],
  },
};

export default function ScholarCreditsPage() {
  return (
    <section className="card glass" style={{ display: "grid", gap: "var(--space-4)" }}>
      <RouteHeader
        eyebrow="Scholar Credits"
        title="One economy across every venture."
        description="Earn credits for learning, competing, and contributing — then spend them on data bundles, tournament entries, and more."
        size={74}
      />
      <ScholarCreditsClient />
    </section>
  );
}
