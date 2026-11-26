import Link from "next/link";
import JsonLd from "@/components/JsonLd";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://school.ditshego-ventures.co.za";

export const metadata = {
  title: "AquaQuick — Water Solutions on the SCHOOL Marketplace",
  description:
    "AquaQuick sells water tanks, purifiers and dispensers to students and families through the SCHOOL marketplace. Demo storefront — live on contract finalisation (6% platform fee).",
  openGraph: {
    title: "AquaQuick — Water Solutions | SCHOOL Marketplace",
    description: "Water tanks, purifiers and dispensers for the SCHOOL community.",
    url: `${SITE_URL}/store/aquaquick`,
  },
};

const PRODUCTS = [
  { name: "AquaQuick 500L Water Tank", price: "R 890", note: "UV-stable, BPA-free vertical tank." },
  { name: "AquaQuick Ceramic Purifier", price: "R 420", note: "Gravity-fed, no electricity needed." },
  { name: "AquaQuick Dispenser 18L", price: "R 310", note: "Bubble-top home/office dispenser." },
];

export default function AquaQuickStorePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: "AquaQuick",
    url: `${SITE_URL}/store/aquaquick`,
    description: "Water tanks, purifiers and dispensers sold via the SCHOOL marketplace.",
    founder: { "@type": "Person", name: "Khuliso" },
    parentOrganization: { "@type": "Organization", name: "SCHOOL (Pty) Ltd" },
    makesOffer: PRODUCTS.map((p) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Product", name: p.name, description: p.note },
      price: p.price.replace(/[^0-9]/g, ""),
      priceCurrency: "ZAR",
    })),
  };

  return (
    <div className="glass card">
      <JsonLd data={jsonLd} />
      <h1 className="title">AquaQuick</h1>
      <p className="subtitle">
        Water tanks, purifiers and dispensers for students and families. Demo storefront —
        goes live on contract finalisation with a negotiated 6% SCHOOL transaction fee.
      </p>

      <div className="spacer" />
      <div className="grid">
        {PRODUCTS.map((p) => (
          <div className="list-item" key={p.name}>
            <h3>{p.name}</h3>
            <p className="subtitle">{p.note}</p>
            <p className="subtitle">
              <strong>{p.price}</strong>
            </p>
            <div className="outline-actions">
              <button type="button" disabled>
                Coming soon
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="spacer" />
      <p className="subtitle">
        Sellers: manage listings in your <Link href="/sellers">seller dashboard</Link>.
      </p>
    </div>
  );
}
