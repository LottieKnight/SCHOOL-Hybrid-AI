import { BookstoreCheckoutClient } from "@/components/bookstore/BookstoreCheckoutClient";
import { EquipmentQuoteSection } from "@/components/equipment/EquipmentQuoteSection";
import { StoreCheckoutClient } from "@/components/store/StoreCheckoutClient";
import { RouteHeader } from "@/components/ui/RouteHeader";

export default function CheckoutPage() {
  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <RouteHeader
        eyebrow="Checkout"
        title="Complete the order without losing clarity."
        description="Marketplace-store lines, bookstore orders, and post-order equipment quoting now fit the same SCHOOL commerce shell."
      />
      <StoreCheckoutClient />
      <BookstoreCheckoutClient />
      <EquipmentQuoteSection />
    </div>
  );
}
