"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchStores, type StoreVendor } from "@/lib/stores";
import styles from "./marketplace.module.css";

type StoreCardProps = {
  href: string;
  name: string;
  tagline: string;
  description: string;
  accent: string;
  badge: string;
  icon: (props: { size?: number }) => ReactNode;
};

function StoreCard({ href, name, tagline, description, accent, badge, icon }: StoreCardProps) {
  const Icon = icon;
  return (
    <Link
      className={`${styles.storeCard} ${styles.hoverCard}`}
      href={href}
      style={{ "--accent": accent } as CSSProperties}
    >
      <div className={styles.storeTop}>
        <span className={styles.emblem}>
          <Icon size={26} />
        </span>
        <span className={styles.badge}>{badge}</span>
      </div>
      <div className={styles.storeCopy}>
        <h2 className={styles.storeName}>{name}</h2>
        <p className={styles.tagline}>{tagline}</p>
        <p className={styles.description}>{description}</p>
      </div>
      <div className={styles.enterRow}>
        <span className={styles.enterLabel}>Enter store</span>
        <span className={styles.enterArrow} aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14"></path>
            <path d="m12 5 7 7-7 7"></path>
          </svg>
        </span>
      </div>
    </Link>
  );
}

function BookIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
      <path d="M9 7h7"></path>
      <path d="M9 11h7"></path>
    </svg>
  );
}

function ShirtIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"></path>
    </svg>
  );
}

function CosmeticsIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"></path>
      <path d="M8.5 15a3.5 3.5 0 0 0 3.5 3.5"></path>
    </svg>
  );
}

function CoursesIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 10 12 5 2 10l10 5 10-5z"></path>
      <path d="M6 12.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-3.5"></path>
      <path d="M22 10v6"></path>
    </svg>
  );
}

const ICON_BY_KEY: Record<string, (props: { size?: number }) => ReactNode> = {
  shirt: ShirtIcon,
  cosmetics: CosmeticsIcon,
  courses: CoursesIcon,
  store: BookIcon,
};

function vendorToCard(store: StoreVendor): StoreCardProps {
  const Icon = ICON_BY_KEY[store.iconKey] ?? BookIcon;
  return {
    href: `/store/${store.slug}`,
    name: store.name,
    tagline: store.tagline || "Enter the store",
    description: store.description || "Browse products from this SCHOOL marketplace store.",
    accent: store.accent,
    badge: store.badge || "Marketplace store",
    icon: Icon,
  };
}

export function MarketplaceClient() {
  const [stores, setStores] = useState<StoreVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchStores("/api")
      .then((data) => {
        if (!active) return;
        setStores(data);
      })
      .catch(() => {
        if (!active) return;
        setError("Unable to load marketplace stores.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const bookstoreCard: StoreCardProps = {
    href: "/bookstore",
    name: "Bookstore",
    tagline: "Open the shelf",
    description:
      "Curriculum-aligned books, OER, and digital study material. Now featuring Becoming El Matador by Moloti Ditshego.",
    accent: "#f5c04f",
    badge: "Featured title",
    icon: BookIcon,
  };

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      {error ? <p style={{ padding: "var(--space-3)" }}>{error}</p> : null}

      {loading ? (
        <p style={{ padding: "var(--space-3)" }}>Loading stores...</p>
      ) : (
        <section className={styles.storeGrid}>
          <StoreCard {...bookstoreCard} />
          {stores
            .filter((store) => store.isActive)
            .map((store) => (
              <StoreCard key={store.id} {...vendorToCard(store)} />
            ))}
        </section>
      )}

      <section className={`${styles.footStrip} glass card`}>
        <div>
          <h2 className="title">Manage the campus economy</h2>
          <p className="subtitle">
            Track what you buy and what you own — no matter which store you step into.
          </p>
        </div>
        <div className={styles.footLinks}>
          <Link className="button" href="/cart">
            Cart
          </Link>
          <Link className="button" href="/orders">
            My orders
          </Link>
          <Link className="button" href="/wallet">
            Wallet
          </Link>
        </div>
      </section>
    </div>
  );
}
