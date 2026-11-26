import { StoreCatalogClient } from "@/components/store/StoreCatalogClient";
import { RouteHeader } from "@/components/ui/RouteHeader";

export default async function StorePage({ params }: { params: Promise<{ store: string }> }) {
  const resolved = await params;
  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <RouteHeader
        eyebrow="Store"
        title="Browse the store catalog."
        description="Products, categories, and pricing come live from the SCHOOL store engine."
      />
      <StoreCatalogClient storeSlug={resolved.store} />
    </div>
  );
}
