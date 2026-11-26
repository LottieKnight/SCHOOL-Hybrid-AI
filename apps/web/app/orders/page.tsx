import { BookstoreOrdersClient } from "@/components/bookstore/BookstoreOrdersClient";
import { StoreOrdersClient } from "@/components/store/StoreOrdersClient";
import { RouteHeader } from "@/components/ui/RouteHeader";

export default function OrdersPage() {
  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <RouteHeader
        eyebrow="Orders"
        title="See every purchase, download, and fulfillment signal."
        description="Marketplace-store orders, bookstore receipts, license-aware lines, and download states stay visible inside the SCHOOL shell."
      />
      <StoreOrdersClient />
      <BookstoreOrdersClient />
    </div>
  );
}
