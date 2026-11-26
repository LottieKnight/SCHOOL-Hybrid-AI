"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  EQUIPMENT_FULFILLMENT_TYPES,
  EQUIPMENT_PHASES,
  addEquipmentCartItem,
  fetchEquipmentCategories,
  fetchEquipmentProducts,
  formatEquipmentCurrency,
  formatEquipmentFulfillment,
  formatEquipmentGradeBand,
  getEquipmentCart,
  getEquipmentCartCount,
  getEquipmentHttpErrorMessage,
  type EquipmentCatalogFilters,
  type EquipmentCategory,
  type EquipmentProduct,
} from "@/lib/equipment";
import styles from "./Equipment.module.css";

const API = "/api";

export function EquipmentCatalogClient() {
  const [categories, setCategories] = useState<EquipmentCategory[]>([]);
  const [filters, setFilters] = useState<EquipmentCatalogFilters>({
    q: "",
    category: "",
    phase: "",
    grade: "",
    subject: "",
    fulfillment: "",
    priceType: "all",
    page: 1,
    pageSize: 24,
  });
  const [products, setProducts] = useState<EquipmentProduct[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 24, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const deferredQuery = useDeferredValue(filters.q || "");

  const topCategories = useMemo(
    () => categories.filter((category) => !category.parentId).sort((a, b) => a.sortOrder - b.sortOrder),
    [categories]
  );
  const childrenByParent = useMemo(() => {
    const map = new Map<string, EquipmentCategory[]>();
    for (const category of categories) {
      if (!category.parentId) continue;
      const list = map.get(category.parentId) ?? [];
      list.push(category);
      map.set(category.parentId, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);
    return map;
  }, [categories]);

  useEffect(() => {
    setCartCount(getEquipmentCartCount(getEquipmentCart()));
    const onStorage = () => setCartCount(getEquipmentCartCount(getEquipmentCart()));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    let active = true;
    void fetchEquipmentCategories(API)
      .then((data) => {
        if (!active) return;
        setCategories(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(getEquipmentHttpErrorMessage(err, "Unable to load equipment categories."));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setNotice(null);
    void fetchEquipmentProducts(API, { ...filters, q: deferredQuery })
      .then((data) => {
        if (!active) return;
        setProducts(data.products || []);
        setPagination(data.pagination || { page: 1, pageSize: 24, total: 0, totalPages: 1 });
      })
      .catch((err) => {
        if (!active) return;
        setError(getEquipmentHttpErrorMessage(err, "Unable to load equipment catalog."));
        setProducts([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    filters.category,
    filters.phase,
    filters.grade,
    filters.subject,
    filters.fulfillment,
    filters.priceType,
    filters.page,
    filters.pageSize,
    deferredQuery,
  ]);

  const setField = (key: keyof EquipmentCatalogFilters, value: string | number) =>
    setFilters((prev) => ({ ...prev, [key]: value, page: key === "page" ? Number(value) : 1 }));

  const addToCart = (product: EquipmentProduct) => {
    addEquipmentCartItem(product.slug, 1);
    setCartCount(getEquipmentCartCount(getEquipmentCart()));
    setNotice(`Added "${product.title}" to your quote basket.`);
  };

  return (
    <div className={styles.page}>
      <section className={`${styles.hero} glass card card-with-back`}>
        <div className={styles.heroTop}>
          <div>
            <h1 className="title">Equipment Store</h1>
            <p className="subtitle">
              Classroom equipment, stationery, kits, and non-hazardous school supplies for Grades 1-12.
            </p>
          </div>
          <div className={styles.toolbar}>
            <Link className="button" href="/cart">
              Quote Basket ({cartCount})
            </Link>
            <Link className="button" href="/bookstore">
              Bookstore
            </Link>
          </div>
        </div>
      </section>

      {notice ? <p className={`${styles.notice} ${styles.noticeSuccess}`}>{notice}</p> : null}
      {error ? <p className={`${styles.notice} ${styles.noticeError}`}>{error}</p> : null}

      <section className={styles.split}>
        <aside className={styles.sidebar}>
          <label className={styles.field}>
            Search
            <input
              value={filters.q || ""}
              onChange={(e) => setField("q", e.target.value)}
              placeholder="Search equipment, kits, brands..."
            />
          </label>

          <div>
            <div className={styles.muted} style={{ fontSize: "0.82rem", marginBottom: 6 }}>
              Categories
            </div>
            <div className={styles.categoryList}>
              <button
                type="button"
                className={`${styles.categoryButton} ${!filters.category ? styles.categoryButtonActive : ""}`}
                onClick={() => setField("category", "")}
              >
                <span>All categories</span>
                <span>{categories.reduce((sum, c) => sum + (c.productCount || 0), 0)}</span>
              </button>
              {topCategories.map((parent) => (
                <div key={parent.id}>
                  <button
                    type="button"
                    className={`${styles.categoryButton} ${filters.category === parent.slug ? styles.categoryButtonActive : ""}`}
                    onClick={() => setField("category", parent.slug)}
                  >
                    <span>{parent.name}</span>
                    <span>{parent.productCount || 0}</span>
                  </button>
                  {(childrenByParent.get(parent.id) || []).map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      className={`${styles.categoryButton} ${styles.subCategory} ${filters.category === child.slug ? styles.categoryButtonActive : ""}`}
                      onClick={() => setField("category", child.slug)}
                    >
                      <span>{child.name}</span>
                      <span>{child.productCount || 0}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div style={{ display: "grid", gap: 14 }}>
          <section className={styles.filtersCard}>
            <div className={styles.filterGrid}>
              <label className={styles.field}>
                Phase
                <select value={filters.phase || ""} onChange={(e) => setField("phase", e.target.value)}>
                  <option value="">All phases</option>
                  {EQUIPMENT_PHASES.map((phase) => (
                    <option key={phase} value={phase}>
                      {formatEquipmentFulfillment(phase)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Grade
                <select
                  value={filters.grade === "" ? "" : String(filters.grade || "")}
                  onChange={(e) => setField("grade", e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">All grades</option>
                  <option value="0">Grade R</option>
                  {Array.from({ length: 12 }, (_, idx) => idx + 1).map((grade) => (
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
                  onChange={(e) => setField("subject", e.target.value)}
                  placeholder="Maths, Science, Sport..."
                />
              </label>
              <label className={styles.field}>
                Fulfillment
                <select value={filters.fulfillment || ""} onChange={(e) => setField("fulfillment", e.target.value)}>
                  <option value="">All types</option>
                  {EQUIPMENT_FULFILLMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {formatEquipmentFulfillment(type)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Price
                <select value={filters.priceType || "all"} onChange={(e) => setField("priceType", e.target.value)}>
                  <option value="all">All</option>
                  <option value="free">Free only</option>
                  <option value="paid">Paid only</option>
                </select>
              </label>
              <label className={styles.field}>
                Page size
                <select value={String(filters.pageSize || 24)} onChange={(e) => setField("pageSize", Number(e.target.value))}>
                  {[12, 24, 48].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className={styles.toolbar}>
              <button
                className="button"
                type="button"
                onClick={() =>
                  setFilters({
                    q: "",
                    category: "",
                    phase: "",
                    grade: "",
                    subject: "",
                    fulfillment: "",
                    priceType: "all",
                    page: 1,
                    pageSize: filters.pageSize || 24,
                  })
                }
              >
                Reset filters
              </button>
              <span className={styles.muted}>{loading ? "Loading..." : `${pagination.total} products`}</span>
            </div>
          </section>

          {loading ? <p className={styles.status}>Loading equipment catalog...</p> : null}

          {!loading && products.length === 0 ? (
            <section className={styles.empty}>
              <h2 className="title" style={{ margin: 0, fontSize: "1.15rem" }}>
                No equipment matches your filters
              </h2>
              <p className="subtitle">
                Try a broader category, remove a subject filter, or reset the search query.
              </p>
            </section>
          ) : null}

          {!loading && products.length > 0 ? (
            <>
              <section className={styles.grid}>
                {products.map((product) => (
                  <article key={product.id} className={styles.card}>
                    <div className={`${styles.image}`} aria-hidden>
                      {product.images?.[0] ? product.images[0].split("/").pop() : "Equipment"}
                    </div>
                    <div className={styles.titleRow}>
                      <h3>{product.title}</h3>
                      <span className={styles.price}>{formatEquipmentCurrency(product.priceCents, product.currency)}</span>
                    </div>
                    <p className={styles.muted} style={{ margin: 0 }}>
                      {product.description}
                    </p>
                    <div className={styles.meta}>
                      <span className={styles.pill}>{formatEquipmentGradeBand(product)}</span>
                      <span className={styles.pill}>{formatEquipmentFulfillment(product.fulfillmentType)}</span>
                      {product.isBundle ? <span className={styles.pill}>Bundle</span> : null}
                      {product.subjectTags.slice(0, 2).map((tag) => (
                        <span key={tag} className={styles.pill}>
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className={styles.toolbar}>
                      <Link className="button" href={`/store/equipment/${product.slug}`}>
                        View
                      </Link>
                      <button className="button" type="button" onClick={() => addToCart(product)}>
                        Add to quote basket
                      </button>
                    </div>
                  </article>
                ))}
              </section>

              <div className={styles.pagination}>
                <button
                  className="button"
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => setField("page", Math.max(1, pagination.page - 1))}
                >
                  Previous
                </button>
                <span className={styles.muted}>
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  className="button"
                  type="button"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setField("page", Math.min(pagination.totalPages, pagination.page + 1))}
                >
                  Next
                </button>
              </div>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
