import type { Metadata } from "next";
import { BookstoreCatalogClient } from "@/components/bookstore/BookstoreCatalogClient";
import { RouteHeader } from "@/components/ui/RouteHeader";

export const metadata: Metadata = {
  title: "Bookstore",
  description: "Browse digital learning resources and curriculum-aligned books on SCHOOL.",
  openGraph: {
    title: "Bookstore | SCHOOL",
    description: "Browse digital learning resources and curriculum-aligned books on SCHOOL.",
    url: "/bookstore",
    images: ["/images/icons/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bookstore | SCHOOL",
    description: "Browse digital learning resources and curriculum-aligned books on SCHOOL.",
    images: ["/images/icons/og-image.png"],
  },
};

export default function BookstorePage() {
  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <RouteHeader
        eyebrow="Bookstore"
        title="Learning resources with clearer signal and cleaner shelves."
        description="Browse curriculum-aligned books, OER, and SCHOOL marketplace inventory without losing the premium shell."
      />
      <BookstoreCatalogClient />
    </div>
  );
}
