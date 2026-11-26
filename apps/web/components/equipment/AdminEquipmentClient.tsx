"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "@/components/SessionProvider";
import {
  deleteAdminEquipmentProduct,
  fetchAdminEquipmentCatalog,
  formatEquipmentCurrency,
  formatEquipmentFulfillment,
  getEquipmentHttpErrorMessage,
  importAdminEquipmentSeed,
  saveAdminEquipmentProduct,
  type EquipmentCategory,
  type EquipmentProduct,
} from "@/lib/equipment";
import styles from "./Equipment.module.css";

const API = "/api";

type SeedResult = {
  inserted: number;
  updated: number;
  failed: Array<{ slug: string; reason: string }>;
  totals?: Record<string, number>;
} | null;

type AdminForm = {
  id: string;
  slug: string;
  title: string;
  description: string;
  brand: string;
  sku: string;
  categorySlug: string;
  phaseTagsCsv: string;
  gradeMin: string;
  gradeMax: string;
  subjectTagsCsv: string;
  tagsCsv: string;
  priceCents: string;
  currency: string;
  imagesCsv: string;
  fulfillmentType: EquipmentProduct["fulfillmentType"];
  stockQty: string;
  leadTimeDays: string;
  isBundle: boolean;
  bundleItemsJson: string;
  attributesJson: string;
};

function emptyForm(defaultCategorySlug = ""): AdminForm {
  return {
    id: "",
    slug: "",
    title: "",
    description: "",
    brand: "",
    sku: "",
    categorySlug: defaultCategorySlug,
    phaseTagsCsv: "FOUNDATION",
    gradeMin: "1",
    gradeMax: "1",
    subjectTagsCsv: "General",
    tagsCsv: "",
    priceCents: "0",
    currency: "ZAR",
    imagesCsv: "",
    fulfillmentType: "STOCKED",
    stockQty: "",
    leadTimeDays: "",
    isBundle: false,
    bundleItemsJson: "[]",
    attributesJson: "{}",
  };
}

function productToForm(product: EquipmentProduct): AdminForm {
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    brand: product.brand || "",
    sku: product.sku || "",
    categorySlug: product.category?.slug || "",
    phaseTagsCsv: product.phaseTags.join(", "),
    gradeMin: String(product.gradeMin),
    gradeMax: String(product.gradeMax),
    subjectTagsCsv: product.subjectTags.join(", "),
    tagsCsv: (product.tags || []).join(", "),
    priceCents: String(product.priceCents),
    currency: product.currency || "ZAR",
    imagesCsv: (product.images || []).join(", "),
    fulfillmentType: product.fulfillmentType,
    stockQty: product.stockQty == null ? "" : String(product.stockQty),
    leadTimeDays: product.leadTimeDays == null ? "" : String(product.leadTimeDays),
    isBundle: Boolean(product.isBundle),
    bundleItemsJson: JSON.stringify(product.bundleItems || [], null, 2),
    attributesJson: JSON.stringify(product.attributes || {}, null, 2),
  };
}

export function AdminEquipmentClient() {
  const { session, loading: sessionLoading } = useSession();
  const [categories, setCategories] = useState<EquipmentCategory[]>([]);
  const [products, setProducts] = useState<EquipmentProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [seedResult, setSeedResult] = useState<SeedResult>(null);
  const [form, setForm] = useState<AdminForm>(emptyForm());

  const defaultCategorySlug = useMemo(() => categories[0]?.slug || "", [categories]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminEquipmentCatalog(API);
      setCategories(data.categories || []);
      setProducts(data.products || []);
      setForm((prev) => (prev.categorySlug ? prev : emptyForm(data.categories?.[0]?.slug || "")));
    } catch (err) {
      setError(getEquipmentHttpErrorMessage(err, "Unable to load equipment admin catalog."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const patch = <K extends keyof AdminForm>(key: K, value: AdminForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleImport = async () => {
    if (!session?.csrfToken) {
      setError("Missing CSRF token.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await importAdminEquipmentSeed(API, session.csrfToken);
      setSeedResult(result);
      setNotice(`Seed import complete. Inserted ${result.inserted}, updated ${result.updated}.`);
      await load();
    } catch (err) {
      setError(getEquipmentHttpErrorMessage(err, "Equipment seed import failed."));
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!session?.csrfToken) {
      setError("Missing CSRF token.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const attributes = JSON.parse(form.attributesJson || "{}");
      const bundleItems = JSON.parse(form.bundleItemsJson || "[]");
      const payload = {
        id: form.id || undefined,
        slug: form.slug,
        title: form.title,
        description: form.description,
        brand: form.brand || null,
        sku: form.sku || null,
        categorySlug: form.categorySlug,
        phaseTags: form.phaseTagsCsv.split(",").map((s) => s.trim()).filter(Boolean),
        gradeMin: Number(form.gradeMin || 0),
        gradeMax: Number(form.gradeMax || 0),
        subjectTags: form.subjectTagsCsv.split(",").map((s) => s.trim()).filter(Boolean),
        tags: form.tagsCsv.split(",").map((s) => s.trim()).filter(Boolean),
        priceCents: Number(form.priceCents || 0),
        currency: (form.currency || "ZAR").toUpperCase(),
        images: form.imagesCsv.split(",").map((s) => s.trim()).filter(Boolean),
        fulfillmentType: form.fulfillmentType,
        stockQty: form.stockQty === "" ? null : Number(form.stockQty),
        leadTimeDays: form.leadTimeDays === "" ? null : Number(form.leadTimeDays),
        attributes,
        isBundle: form.isBundle,
        bundleItems: form.isBundle ? bundleItems : null,
      };
      const result = await saveAdminEquipmentProduct(API, session.csrfToken, payload);
      setNotice(`${result.created ? "Created" : "Updated"} ${result.product.title}`);
      setForm(productToForm(result.product));
      await load();
    } catch (err) {
      setError(getEquipmentHttpErrorMessage(err, "Unable to save equipment product."));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (slug: string) => {
    if (!session?.csrfToken) return;
    if (!window.confirm(`Delete ${slug}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAdminEquipmentProduct(API, session.csrfToken, slug);
      setNotice(`Deleted ${slug}`);
      if (form.slug === slug) setForm(emptyForm(defaultCategorySlug));
      await load();
    } catch (err) {
      setError(getEquipmentHttpErrorMessage(err, "Unable to delete equipment product."));
    } finally {
      setBusy(false);
    }
  };

  if (sessionLoading) {
    return <p className={styles.status}>Checking session...</p>;
  }

  return (
    <div className={styles.page}>
      <section className={`${styles.hero} glass card card-with-back`}>
        <div className={styles.heroTop}>
          <div>
            <h1 className="title">Admin Equipment</h1>
            <p className="subtitle">Manage equipment catalog entries and import the curated equipment seed file.</p>
          </div>
          <div className={styles.toolbar}>
            <Link className="button" href="/admin/equipment/quotes">
              Manage quotes
            </Link>
            <button className="button" type="button" onClick={handleImport} disabled={busy}>
              {busy ? "Working..." : "Import Seed"}
            </button>
            <button className="button" type="button" onClick={() => setForm(emptyForm(defaultCategorySlug))}>
              New product
            </button>
          </div>
        </div>
      </section>

      {error ? <p className={`${styles.notice} ${styles.noticeError}`}>{error}</p> : null}
      {notice ? <p className={`${styles.notice} ${styles.noticeSuccess}`}>{notice}</p> : null}
      {seedResult ? (
        <section className={styles.sectionCard}>
          <div className={styles.toolbar}>
            <strong>Seed import summary</strong>
            <span className={styles.pill}>Inserted {seedResult.inserted}</span>
            <span className={styles.pill}>Updated {seedResult.updated}</span>
            <span className={styles.pill}>Failed {seedResult.failed.length}</span>
            {seedResult.totals?.products != null ? <span className={styles.pill}>Catalog {seedResult.totals.products}</span> : null}
          </div>
          {seedResult.failed.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Slug</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {seedResult.failed.slice(0, 20).map((row, idx) => (
                    <tr key={`${row.slug}-${idx}`}>
                      <td>{row.slug}</td>
                      <td>{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className={styles.adminGrid}>
        <section className={styles.sectionCard}>
          <div className={styles.toolbar}>
            <strong>{form.id ? "Edit equipment product" : "Create equipment product"}</strong>
            {form.id ? <span className={styles.pill}>{form.id}</span> : null}
          </div>
          <div className={`${styles.compactForm} ${styles.filterGrid}`}>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              Title
              <input value={form.title} onChange={(e) => patch("title", e.target.value)} />
            </label>
            <label className={styles.field}>
              Slug
              <input value={form.slug} onChange={(e) => patch("slug", e.target.value)} />
            </label>
            <label className={styles.field}>
              Category
              <select value={form.categorySlug} onChange={(e) => patch("categorySlug", e.target.value)}>
                <option value="">Select</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              Description
              <textarea rows={3} value={form.description} onChange={(e) => patch("description", e.target.value)} />
            </label>
            <label className={styles.field}>
              Brand
              <input value={form.brand} onChange={(e) => patch("brand", e.target.value)} />
            </label>
            <label className={styles.field}>
              SKU
              <input value={form.sku} onChange={(e) => patch("sku", e.target.value)} />
            </label>
            <label className={styles.field}>
              Phase tags (CSV)
              <input value={form.phaseTagsCsv} onChange={(e) => patch("phaseTagsCsv", e.target.value)} />
            </label>
            <label className={styles.field}>
              Subject tags (CSV)
              <input value={form.subjectTagsCsv} onChange={(e) => patch("subjectTagsCsv", e.target.value)} />
            </label>
            <label className={styles.field}>
              Grade min
              <input type="number" min={0} max={12} value={form.gradeMin} onChange={(e) => patch("gradeMin", e.target.value)} />
            </label>
            <label className={styles.field}>
              Grade max
              <input type="number" min={0} max={12} value={form.gradeMax} onChange={(e) => patch("gradeMax", e.target.value)} />
            </label>
            <label className={styles.field}>
              Price (cents)
              <input type="number" min={0} value={form.priceCents} onChange={(e) => patch("priceCents", e.target.value)} />
            </label>
            <label className={styles.field}>
              Currency
              <input value={form.currency} onChange={(e) => patch("currency", e.target.value)} />
            </label>
            <label className={styles.field}>
              Fulfillment
              <select value={form.fulfillmentType} onChange={(e) => patch("fulfillmentType", e.target.value as any)}>
                {["STOCKED", "SHIP_FROM_SUPPLIER", "DROPSHIP", "AFFILIATE_LINK", "QUOTE_REQUIRED"].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Stock qty
              <input type="number" min={0} value={form.stockQty} onChange={(e) => patch("stockQty", e.target.value)} />
            </label>
            <label className={styles.field}>
              Lead time days
              <input type="number" min={0} value={form.leadTimeDays} onChange={(e) => patch("leadTimeDays", e.target.value)} />
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              Images (CSV)
              <input value={form.imagesCsv} onChange={(e) => patch("imagesCsv", e.target.value)} />
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              Tags (CSV)
              <input value={form.tagsCsv} onChange={(e) => patch("tagsCsv", e.target.value)} />
            </label>
            <label className={styles.field} style={{ alignContent: "end" }}>
              <span className={styles.toolbar}>
                <input type="checkbox" checked={form.isBundle} onChange={(e) => patch("isBundle", e.target.checked)} />
                Bundle product
              </span>
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              Bundle items JSON
              <textarea rows={4} value={form.bundleItemsJson} onChange={(e) => patch("bundleItemsJson", e.target.value)} />
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              Attributes JSON
              <textarea rows={4} value={form.attributesJson} onChange={(e) => patch("attributesJson", e.target.value)} />
            </label>
          </div>
          <div className={styles.toolbar}>
            <button className="button" type="button" onClick={handleSave} disabled={busy}>
              {busy ? "Saving..." : form.id ? "Save changes" : "Create product"}
            </button>
            <button className="button" type="button" onClick={() => setForm(emptyForm(defaultCategorySlug))}>
              Reset
            </button>
          </div>
        </section>

        <section className={styles.sectionCard}>
          <div className={styles.toolbar}>
            <strong>Catalog ({products.length})</strong>
            {loading ? <span className={styles.muted}>Loading...</span> : null}
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Fulfillment</th>
                  <th>Tags</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div><strong>{product.title}</strong></div>
                      <div className={styles.muted}>{product.slug}</div>
                    </td>
                    <td>{product.category?.name || "-"}</td>
                    <td>{formatEquipmentCurrency(product.priceCents, product.currency)}</td>
                    <td>{formatEquipmentFulfillment(product.fulfillmentType)}</td>
                    <td className={styles.muted}>
                      {product.isBundle ? "Bundle | " : ""}
                      {product.subjectTags.slice(0, 2).join(", ")}
                    </td>
                    <td>
                      <div className={styles.toolbar}>
                        <button className="button" type="button" onClick={() => setForm(productToForm(product))}>
                          Edit
                        </button>
                        <button className="button" type="button" onClick={() => handleDelete(product.slug)} disabled={busy}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!products.length ? (
                  <tr>
                    <td colSpan={6} className={styles.muted}>
                      No equipment products yet. Import the seed to populate the catalog.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </div>
  );
}
