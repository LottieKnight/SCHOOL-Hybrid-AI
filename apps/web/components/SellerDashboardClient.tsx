import Link from "next/link";

interface SellerDashboardClientProps {
  sellerName: string;
  owner: string;
  commissionNote: string;
  accent?: string;
}

/**
 * Demo seller dashboard shell. Pre-built ahead of contract finalisation.
 * Shows the layout sellers will use to manage listings, orders and payouts.
 */
export default function SellerDashboardClient({
  sellerName,
  owner,
  commissionNote,
  accent = "#c9a84c",
}: SellerDashboardClientProps) {
  const stats = [
    { label: "Active listings", value: "0 (demo)" },
    { label: "Pending orders", value: "0 (demo)" },
    { label: "Lifetime sales", value: "R 0.00" },
    { label: "SCHOOL share", value: commissionNote },
  ];

  return (
    <div className="glass card" style={{ borderTop: `4px solid ${accent}` }}>
      <h1 className="title">{sellerName} — Seller Dashboard</h1>
      <p className="subtitle">
        Demo environment for {owner}. Listings, orders and payouts will activate on contract
        finalisation.
      </p>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        {stats.map((s) => (
          <div className="list-item" key={s.label}>
            <h3>{s.label}</h3>
            <p className="subtitle">
              <strong>{s.value}</strong>
            </p>
          </div>
        ))}
      </div>

      <div className="spacer" />
      <div className="outline-actions">
        <button type="button" disabled>
          + Add product (demo)
        </button>
        <button type="button" disabled>
          View orders (demo)
        </button>
        <Link className="button" href="/sellers">
          Back to sellers
        </Link>
      </div>
    </div>
  );
}
