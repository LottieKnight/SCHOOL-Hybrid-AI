import { BookstoreCartClient } from "@/components/bookstore/BookstoreCartClient";
import { EquipmentCartSection } from "@/components/equipment/EquipmentCartSection";
import { StoreCartClient } from "@/components/store/StoreCartClient";
import { RouteHeader } from "@/components/ui/RouteHeader";

export default function CartPage() {
  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <RouteHeader
        eyebrow="Cart"
        title="Review what you’re about to buy."
        description="Bookstore lines, marketplace-store products, and equipment requests now sit under the same branded purchase flow."
      />
      <StoreCartClient />
      <BookstoreCartClient />
      <EquipmentCartSection />
    </div>
  );
}
