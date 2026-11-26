import Link from "next/link";
import JsonLd from "@/components/JsonLd";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://school.ditshego-ventures.co.za";

export const metadata = {
  title: "iPhone Store — Certified Devices on the SCHOOL Marketplace",
  description:
    "The SCHOOL iPhone supplier lists certified pre-owned and new iPhones via the marketplace. Demo storefront — live on contract finalisation.",
  openGraph: {
    title: "iPhone Store | SCHOOL Marketplace",
    description: "Certified iPhones for students and parents, listed through SCHOOL.",
    url: `${SITE_URL}/store/iphone`,
  },
};

const PRODUCTS = [
  { name: "iPhone 13 (128GB)", price: "R 7 499", note: "Certified pre-owned, 12-month warranty." },
  { name: "iPhone 14 (128GB)", price: "R 9 999", note: "New, sealed, student finance available." },
  { name: "iPhone SE (64GB)", price: "R 4 299", note: "Entry-level, ideal for first-year students." },
];

export default function IphoneStorePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: "SCHOOL iPhone Supplier",
    url: `${SITE_URL}/store/iphone`,
    description: "Certified new and pre-owned iPhones sold via the SCHOOL marketplace.",
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
      <h1 className="title">iPhone Store</h1>
      <p className="subtitle">
        Certified new and pre-owned iPhones for students and parents. Demo storefront — goes live
        on contract finalisation with the SCHOOL platform fee applied per transaction.
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
