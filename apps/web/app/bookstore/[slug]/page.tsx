import { BookstoreProductClient } from "@/components/bookstore/BookstoreProductClient";
import { RouteHeader } from "@/components/ui/RouteHeader";

export default async function BookstoreProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolved = await params;
  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <RouteHeader
        eyebrow="Bookstore Detail"
        title="Inspect the product before you commit."
        description="See the title, pricing, fulfillment, and license information inside the same SCHOOL shell."
      />
      <BookstoreProductClient slug={resolved.slug} />
    </div>
  );
}
