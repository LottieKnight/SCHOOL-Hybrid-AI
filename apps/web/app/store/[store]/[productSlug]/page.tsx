import { StoreProductClient } from "@/components/store/StoreProductClient";
import { RouteHeader } from "@/components/ui/RouteHeader";

export default async function StoreProductPage({
  params,
}: {
  params: Promise<{ store: string; productSlug: string }>;
}) {
  const resolved = await params;
  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <RouteHeader
        eyebrow="Store Product"
        title="Pick your options and add to cart."
        description="Variants, pricing, and fulfillment are drawn from the live store catalog."
      />
      <StoreProductClient storeSlug={resolved.store} productSlug={resolved.productSlug} />
    </div>
  );
}
