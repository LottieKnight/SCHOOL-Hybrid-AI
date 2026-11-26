import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { RouteHeader } from "@/components/ui/RouteHeader";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://school.ditshego-ventures.co.za";

export const metadata = {
  title: "Sellers — SCHOOL Marketplace",
  description:
    "Verified youth, family and SME sellers on the SCHOOL marketplace: Cosmic Cotton, AquaQuick, the SCHOOL iPhone supplier and more. Demo dashboards ready ahead of contract finalisation.",
  openGraph: {
    title: "Sellers — SCHOOL Marketplace",
    description: "Curated, POPIA-compliant sellers serving the SCHOOL community.",
    url: `${SITE_URL}/sellers`,
  },
};

const SELLERS = [
  {
    name: "Cosmic Cotton",
    href: "/store/clothing",
    blurb: "School uniforms and Flightmode streetwear by Justin.",
  },
  {
    name: "AquaQuick",
    href: "/store/aquaquick",
    blurb: "Water tanks, purifiers and dispensers by Khuliso.",
  },
  {
    name: "SCHOOL iPhone Supplier",
    href: "/store/iphone",
    blurb: "Certified new and pre-owned iPhones.",
  },
  {
    name: "Equipment Store",
    href: "/store/equipment",
    blurb: "Lab and study equipment, quote-based.",
  },
];

export default function SellersPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "SCHOOL Marketplace Sellers",
    itemListElement: SELLERS.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: s.name,
      url: `${SITE_URL}${s.href}`,
    })),
  };

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <JsonLd data={jsonLd} />
      <RouteHeader
        eyebrow="Marketplace"
        title="Sellers on SCHOOL"
        description="A curated, POPIA-compliant marketplace where verified youth and family brands sell to the SCHOOL community."
      />

      <div className="glass card">
        <div className="grid">
          {SELLERS.map((s) => (
            <div className="list-item" key={s.name}>
              <h3>{s.name}</h3>
              <p className="subtitle">{s.blurb}</p>
              <div className="outline-actions">
                <Link className="button" href={s.href}>
                  Visit store
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass card">
        <h2 className="title">Seller dashboard (demo)</h2>
        <p className="subtitle">
          Each seller gets a themed dashboard to list products, manage orders and track the
          SCHOOL revenue share. The dashboards below are pre-built demo shells awaiting contract
          finalisation and payout setup.
        </p>
        <ul className="subtitle" style={{ lineHeight: 1.8 }}>
          <li>
            <Link href="/sellers/cosmic-cotton">Cosmic Cotton dashboard</Link>
          </li>
          <li>
            <Link href="/sellers/aquaquick">AquaQuick dashboard</Link>
          </li>
          <li>
            <Link href="/sellers/iphone">iPhone supplier dashboard</Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
