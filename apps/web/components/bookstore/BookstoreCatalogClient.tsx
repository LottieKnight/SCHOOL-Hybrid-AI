"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/lib/apiBase";
import {
  BOOKSTORE_FORMATS,
  BOOKSTORE_LICENSE_TYPES,
  BOOKSTORE_PHASES,
  addBookstoreCartItem,
  fetchInstitutionResourceLibrary,
  fetchBookstoreProducts,
  formatLabel,
  getCartItemCount,
  getHttpErrorMessage,
  getBookstoreCart,
  type InstitutionResourceScope,
  type InstitutionResourceCatalogResponse,
  type BookstoreCatalogFilters,
  type BookstoreProduct,
} from "@/lib/bookstore";
import { ProductCard } from "./BookstoreShared";
import styles from "./Bookstore.module.css";

type CatalogState = {
  items: BookstoreProduct[];
  total: number;
  sections: InstitutionResourceCatalogResponse["sections"];
};

type DefaultInstitution = {
  id: string;
  name: string;
} | null;

type BookstoreCatalogClientProps = {
  mode?: "marketplace" | "resource-library";
  defaultInstitution?: DefaultInstitution;
};

const PRICE_TYPES = [
  { value: "all", label: "Free + Paid" },
  { value: "free", label: "Free only" },
  { value: "paid", label: "Paid only" },
] as const;

const RECOMMENDED_EMPTY_FILTERS = [
  { label: "Free Foundation OER", href: "/bookstore?phase=FOUNDATION&price=free" },
  { label: "FET Maths + Science", href: "/bookstore?phase=FET&subject=Mathematics" },
  { label: "Commercial only", href: "/bookstore?commercial=1" },
];

export function BookstoreCatalogClient({
  mode = "marketplace",
  defaultInstitution = null,
}: BookstoreCatalogClientProps) {
  const isResourceLibrary = mode === "resource-library";
  const [filters, setFilters] = useState<BookstoreCatalogFilters>({
    phase: "",
    grade: "",
    subject: "",
    format: "",
    priceType: "all",
    license: "",
    commercialAllowedOnly: false,
    q: "",
    page: 1,
    pageSize: 24,
  });
  const [institutionScope, setInstitutionScope] = useState<InstitutionResourceScope>(
    defaultInstitution ? "institution" : "all"
  );
  const deferredQuery = useDeferredValue(filters.q ?? "");
  const [catalog, setCatalog] = useState<CatalogState>({ items: [], total: 0, sections: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    setCartCount(getCartItemCount(getBookstoreCart()));
    const onStorage = () => setCartCount(getCartItemCount(getBookstoreCart()));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setNotice(null);
    const loader = isResourceLibrary
      ? fetchInstitutionResourceLibrary({
          ...filters,
          q: deferredQuery,
          institutionScope,
        })
      : fetchBookstoreProducts(API_BASE, {
          ...filters,
          q: deferredQuery,
        });

    void loader
      .then((data) => {
        if (!active) return;
        setCatalog({
          items: data.products || [],
          total: data.pagination?.total ?? 0,
          sections: isResourceLibrary ? (data as InstitutionResourceCatalogResponse).sections ?? [] : [],
        });
      })
      .catch((err) => {
        if (!active) return;
        setError(getHttpErrorMessage(err, "Unable to load bookstore catalog."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    filters.phase,
    filters.grade,
    filters.subject,
    filters.format,
    filters.priceType,
    filters.license,
    filters.commercialAllowedOnly,
    filters.page,
    filters.pageSize,
    deferredQuery,
    institutionScope,
    isResourceLibrary,
  ]);

  const subjectsHint = useMemo(() => {
    if (!filters.phase) return "Try Mathematics, English, Natural Sciences, Accounting";
    if (filters.phase === "FOUNDATION") return "Try Mathematics, English Home Language, Life Skills";
    if (filters.phase === "FET") return "Try Mathematics, Physical Sciences, Life Sciences, Accounting";
    return "Type a CAPS subject name";
  }, [filters.phase]);

  const setField = (key: keyof BookstoreCatalogFilters, value: string | number | boolean) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === "page" ? Number(value) : 1,
    }));
  };

  const resetFilters = () =>
    setFilters({
      phase: "",
      grade: "",
      subject: "",
      format: "",
      priceType: "all",
      license: "",
      commercialAllowedOnly: false,
      q: "",
      page: 1,
      pageSize: 24,
    });

  const recommendedEmptyFilters = isResourceLibrary
    ? [
        {
          label: defaultInstitution ? `${defaultInstitution.name} core material` : "Institution material",
          href: "/textbooks?institutionScope=institution",
        },
        { label: "Universal open resources", href: "/textbooks?institutionScope=universal&price=free" },
        { label: "All textbooks", href: "/textbooks?institutionScope=all" },
      ]
    : RECOMMENDED_EMPTY_FILTERS;

  const getScopeButtonStyle = (scope: InstitutionResourceScope) => ({
    background: institutionScope === scope ? "var(--gold-dim)" : "var(--surface-3)",
    border: institutionScope === scope ? "1px solid var(--gold-border)" : "1px solid var(--border)",
    color: institutionScope === scope ? "var(--gold)" : "var(--text-2)",
  });

  const addToCart = (product: BookstoreProduct) => {
    addBookstoreCartItem(product.id, 1);
    setCartCount(getCartItemCount(getBookstoreCart()));
    setNotice(`Added "${product.title}" to cart.`);
  };

  return (
    <div className={styles.page}>
      <section className={`${styles.heroCard} glass card card-with-back`}>
        <div className={styles.heroTop}>
          <div>
            <h1 className="title">{isResourceLibrary ? "Resource Library" : "Bookstore"}</h1>
            <p className="subtitle">
              {isResourceLibrary
                ? "Institution-aware learning resources. Start with your campus collection, switch to universal material, or browse everything."
                : "Browse open educational resources and commercial titles for Grades 1-12 with clear licensing information."}
            </p>
          </div>
          {isResourceLibrary ? (
            <Link className="button" href="/bookstore">
              Open marketplace
            </Link>
          ) : (
            <Link className={`button ${styles.cartLink}`} href="/cart">
              Cart <span className={styles.cartCount}>{cartCount}</span>
            </Link>
          )}
        </div>
      </section>

      <section className={`${styles.filtersCard} glass card`}>
        {isResourceLibrary ? (
          <div className={styles.metaRow} style={{ marginBottom: "16px" }}>
            {defaultInstitution ? (
              <button
                className="button"
                type="button"
                onClick={() => setInstitutionScope("institution")}
                style={getScopeButtonStyle("institution")}
              >
                {defaultInstitution.name}
              </button>
            ) : null}
            <button
              className="button"
              type="button"
              onClick={() => setInstitutionScope("universal")}
              style={getScopeButtonStyle("universal")}
            >
              Universal
            </button>
            <button
              className="button"
              type="button"
              onClick={() => setInstitutionScope("all")}
              style={getScopeButtonStyle("all")}
            >
              All resources
            </button>
          </div>
        ) : null}

        <div className={styles.filterGrid}>
          <label className={`${styles.field} ${styles.fieldWide}`}>
            Search title / description
            <input
              value={filters.q || ""}
              onChange={(event) => setField("q", event.target.value)}
              placeholder="Search books, readers, workbooks..."
            />
          </label>

          <label className={styles.field}>
            Phase
            <select value={filters.phase || ""} onChange={(event) => setField("phase", event.target.value)}>
              <option value="">All phases</option>
              {BOOKSTORE_PHASES.map((phase) => (
                <option key={phase} value={phase}>
                  {formatLabel(phase)}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            Grade
            <select
              value={filters.grade === "" ? "" : String(filters.grade ?? "")}
              onChange={(event) => setField("grade", event.target.value ? Number(event.target.value) : "")}
            >
              <option value="">All grades</option>
              <option value="0">Grade R</option>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((grade) => (
                <option key={grade} value={grade}>
                  Grade {grade}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            Subject
            <input
              value={filters.subject || ""}
              onChange={(event) => setField("subject", event.target.value)}
              placeholder={subjectsHint}
            />
          </label>

          <label className={styles.field}>
            Format
            <select value={filters.format || ""} onChange={(event) => setField("format", event.target.value)}>
              <option value="">All formats</option>
              {BOOKSTORE_FORMATS.map((format) => (
                <option key={format} value={format}>
                  {formatLabel(format)}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            Free / Paid
            <select
              value={filters.priceType || "all"}
              onChange={(event) => setField("priceType", event.target.value)}
            >
              {PRICE_TYPES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            License
            <select value={filters.license || ""} onChange={(event) => setField("license", event.target.value)}>
              <option value="">All licenses</option>
              {BOOKSTORE_LICENSE_TYPES.map((license) => (
                <option key={license} value={license}>
                  {formatLabel(license)}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.checkboxField}>
            <input
              type="checkbox"
              checked={Boolean(filters.commercialAllowedOnly)}
              onChange={(event) => setField("commercialAllowedOnly", event.target.checked)}
            />
            Commercial use allowed only
          </label>
        </div>

        <div className={styles.filterActions}>
          <button className="button" type="button" onClick={resetFilters}>
            Reset filters
          </button>
          <span className={styles.muted}>{loading ? "Loading..." : `${catalog.total} item(s)`}</span>
          <Link className="button" href={isResourceLibrary ? "/bookstore" : "/orders"}>
            {isResourceLibrary ? "Marketplace" : "My orders"}
          </Link>
        </div>
      </section>

      {notice ? <p className={`${styles.notice} ${styles.noticeSuccess}`}>{notice}</p> : null}
      {error ? <p className={`${styles.notice} ${styles.noticeError}`}>{error}</p> : null}

      {loading ? (
        <section className="state-card">
          <div className="state-card__title">Loading catalog</div>
          <div className="state-card__description">SCHOOL is arranging the current shelf and filtering the bookstore inventory.</div>
        </section>
      ) : catalog.items.length ? (
        catalog.sections && catalog.sections.length > 0 ? (
          <div className={styles.sectionStack}>
            {catalog.sections.map((section) => (
              <section key={section.id} className={styles.catalogSection}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2 className="title">{section.title}</h2>
                    <p className="subtitle">{section.description}</p>
                  </div>
                </div>
                <div className={styles.catalogGrid}>
                  {section.items.map((product) => (
                    <ProductCard
                      key={`${section.id}-${product.id}`}
                      product={product}
                      apiBase={API_BASE}
                      onAddToCart={isResourceLibrary ? undefined : addToCart}
                      showInstitutionMeta={isResourceLibrary}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <section className={styles.catalogGrid}>
            {catalog.items.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                apiBase={API_BASE}
                onAddToCart={isResourceLibrary ? undefined : addToCart}
                showInstitutionMeta={isResourceLibrary}
              />
            ))}
          </section>
        )
      ) : (
        <section className={styles.emptyState}>
          <h2 className="title" style={{ fontSize: "1.35rem", margin: 0 }}>
            No products match these filters
          </h2>
          <p className="subtitle">
            Try broader filters or jump to one of the recommended shelves below.
          </p>
          <div className={styles.recommendGrid}>
            {recommendedEmptyFilters.map((entry) => (
              <Link key={entry.href} className={`${styles.recommendCard} ${styles.linkLike}`} href={entry.href}>
                <strong>{entry.label}</strong>
                <span className={styles.muted}>Open this shelf</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
