import type { Metadata } from "next";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { LibraryCatalogClient } from "@/components/library/LibraryCatalogClient";

export const metadata: Metadata = {
  title: "Library",
  description: "Browse articles, books, journals, publications, past papers, and video lessons on SCHOOL.",
  openGraph: {
    title: "Library | SCHOOL",
    description: "Browse articles, books, journals, publications, past papers, and video lessons on SCHOOL.",
    url: "/library",
    images: ["/images/icons/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Library | SCHOOL",
    description: "Browse articles, books, journals, publications, past papers, and video lessons on SCHOOL.",
    images: ["/images/icons/og-image.png"],
  },
};

export default function LibraryPage() {
  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <RouteHeader
        eyebrow="Resources"
        title="Library"
        description="Articles, books, journals, publications, past papers, and video lessons — organised by content type, subject, and grade band."
      />
      <LibraryCatalogClient />
    </div>
  );
}
