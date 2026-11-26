"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addStoreCartItem,
  fetchStoreCatalog,
  formatZarCents,
  getHttpErrorMessage,
  type StoreCatalogFilters,
  type StoreCategory,
  type StoreProduct,
  type StoreVendor,
} from "@/lib/stores";
import { StateCard } from "@/components/ui/StateCard";
import { StoreBreakevenCard } from "./StoreBreakevenCard";
import styles from "./Store.module.css";

const API = "/api";

type Props = {
  storeSlug: string;
};

export function StoreCatalogClient({ storeSlug }: Props) {
  const [store, setStore] = useState<StoreVendor | null>(null);
  const [filters, setFilters] = useState<StoreCatalogFilters>({});
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setNotFound(false);
    void fetchStoreCatalog(API, storeSlug, { ...filters, page })
      .then((data) => {
        if (!active) return;
        setStore(data.store);
        setCategories(data.categories);
        setProducts(data.products);
        setTotal(data.pagination.total);
      })
      .catch((err) => {
        if (!active) return;
        const message = getHttpErrorMessage(err, "Unable to load the store catalog.");
        setError(message);
        setNotFound(message.toLowerCase().includes("not found"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [storeSlug, filters, page]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / 24)), [total]);

  const setField = (key: keyof StoreCatalogFilters, value: string | number | undefined) => {
    setPage(1);
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (!value) delete next[key];
      return next;
    });
  };

  const handleAdd = (product: StoreProduct) => {
    addStoreCartItem(product.id, 1);
    setAdded(product.id);
    window.setTimeout(() => setAdded((current) => (current === product.id ? null : current)), 1500);
  };

  if (loading && !store) {
    return <StateCard title="Store" description="Loading store catalog..." />;
  }

  if (notFound || (!loading && !store)) {
    return (
      <StateCard title="Store not found" description={error || "This store may have been removed."}>
        <Link className="button" href="/marketplace">
          Back to marketplace
        </Link>
      </StateCard>
    );
  }

  return (
    <div className={styles.page}>
      <section className={`${styles.hero} glass card card-with-back`}>
        <div className={styles.heroTop}>
          <div>
            <h1 className="title" style={{ "--accent": store!.accent } as React.CSSProperties}>
              {store!.name}
            </h1>
            <p className="subtitle">{store!.tagline}</p>
            <p>{store!.description}</p>
          </div>
          <div className={styles.toolbar}>
            <Link className="button" href="/marketplace">
              Marketplace
            </Link>
            <Link className="button" href="/cart">
              Cart
            </Link>
          </div>
        </div>
      </section>

      {error ? <p className={`${styles.notice} ${styles.noticeError}`}>{error}</p> : null}

      <div className={styles.split}>
        <aside className={styles.sidebar}>
          <div className={`${styles.filtersCard} glass card`}>
            <label className={styles.field}>
              Search
              <input
                placeholder="Search this store..."
                defaultValue=""
                onKeyDown={(e) => {
                  if (e.key === "Enter") setField("q", (e.target as HTMLInputElement).value || undefined);
                }}
              />
            </label>
            <div className={styles.categoryList}>
              <button
                type="button"
                className={`${styles.categoryButton} ${!filters.category ? styles.categoryButtonActive : ""}`}
                onClick={() => setField("category", undefined)}
              >
                <span>All products</span>
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={`${styles.categoryButton} ${
                    filters.category === category.slug ? styles.categoryButtonActive : ""
                  }`}
                  onClick={() => setField("category", category.slug)}
                >
                  <span>{category.name}</span>
                </button>
              ))}
            </div>
            <label className={styles.field}>
              Price
              <select value={filters.priceType || "all"} onChange={(e) => setField("priceType", e.target.value)}>
                <option value="all">All prices</option>
                <option value="free">Free</option>
                <option value="paid">Paid</option>
              </select>
            </label>
          </div>
        </aside>

        <section>
          {loading ? <p className={styles.status}>Loading products...</p> : null}

          {!loading && products.length === 0 ? (
            <StateCard title="No products found" description="Try a different filter or search." />
          ) : null}

          {!loading && products.length > 0 ? (
            <>
              <div className={styles.grid}>
                {products.map((product) => (
                  <Link key={product.id} className={styles.card} href={`/store/${storeSlug}/${product.slug}`}>
                    <div className={styles.image}>
                      {product.images?.[0] ? (
                        <img src={product.images[0]} alt={product.title} loading="lazy" />
                      ) : (
                        <span>{product.title.slice(0, 3).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "1rem", lineHeight: 1.3 }}>{product.title}</h3>
                      <p className={styles.muted} style={{ marginTop: 4 }}>
                        {product.description.length > 110
                          ? `${product.description.slice(0, 110)}…`
                          : product.description}
                      </p>
                    </div>
                    <div className={styles.titleRow}>
                      <span className={styles.price}>
                        {product.priceCents > 0
                          ? formatZarCents(product.priceCents, product.currency)
                          : "Free"}
                      </span>
                      <span className={styles.pill}>
                        {product.stockQty == null ? "Made to order" : product.stockQty > 0 ? "In stock" : "Sold out"}
                      </span>
                    </div>
                    <button
                      className="button"
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleAdd(product);
                      }}
                    >
                      {added === product.id ? "Added to cart" : "Add to cart"}
                    </button>
                  </Link>
                ))}
              </div>

              {pageCount > 1 ? (
                <div className={styles.pagination}>
                  <button
                    className="button"
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    Previous
                  </button>
                  <span className={styles.muted}>
                    Page {page} of {pageCount}
                  </span>
                  <button
                    className="button"
                    type="button"
                    disabled={page >= pageCount}
                    onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      </div>

      {storeSlug === "school-academic-supplies" ? <StoreBreakevenCard /> : null}
    </div>
  );
}
