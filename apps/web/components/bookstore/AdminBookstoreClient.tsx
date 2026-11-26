"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/apiBase";
import { useSession } from "@/components/SessionProvider";
import {
  BOOKSTORE_FORMATS,
  BOOKSTORE_FULFILLMENT_TYPES,
  BOOKSTORE_LICENSE_TYPES,
  BOOKSTORE_PHASES,
  BOOKSTORE_SOURCE_PROVIDERS,
  fetchAdminBookstoreDashboard,
  formatLabel,
  formatZarCents,
  getHttpErrorMessage,
  recommendPodBookstorePrice,
  runBookstoreOerIngest,
  runBookstoreSupplierSync,
  saveAdminBookstoreProduct,
  updateAdminBookstoreOrderStatus,
  type AdminBookstoreProductInput,
  type BookstoreOerIngestResult,
  type BookstoreProduct,
} from "@/lib/bookstore";
import { LicenseBadge } from "./BookstoreShared";
import styles from "./Bookstore.module.css";

type AdminOrderRow = {
  id: string;
  user_email?: string | null;
  status: string;
  payment_status: string;
  fulfillment_status: string;
  total_cents: number;
  currency: string;
  created_at: string;
  items?: Array<{ id: string; product_title: string; quantity: number }>;
};

type IngestJobRow = {
  id: string;
  job_type: string;
  source: string;
  status: string;
  created_at: string;
  result_json?: Record<string, unknown>;
};

type PodQuote = {
  recommendedPriceCents: number;
  targetMarginRate: number;
  vatDisplayMode: "inclusive" | "exclusive";
  breakdown?: Record<string, unknown>;
};

type AdminFormState = {
  id: string;
  slug: string;
  title: string;
  description: string;
  phase: AdminBookstoreProductInput["phase"];
  grade_min: string;
  grade_max: string;
  subjects_csv: string;
  format: AdminBookstoreProductInput["format"];
  price_cents: string;
  currency: string;
  license_type: AdminBookstoreProductInput["license_type"];
  license_url: string;
  attribution_html: string;
  source_url: string;
  source_provider: AdminBookstoreProductInput["source_provider"];
  supplier_id: string;
  is_adapted: boolean;
  is_excerpt: boolean;
  is_partial_product: boolean;
  storage_key: string;
  delivery_mode: "" | "LINK_ONLY" | "FILE_DOWNLOAD";
  file_type: "PDF" | "EPUB" | "ZIP" | "LINK_ONLY";
  file_size: string;
  checksum: string;
  external_download_url: string;
  fulfillment_type: AdminBookstoreProductInput["fulfillment_type"];
  pod_spec_json: string;
  pod_base_cost_cents: string;
  target_margin_rate: string;
  vat_inclusive: boolean;
  stock_qty: string;
  tags_csv: string;
  is_active: boolean;
};

function emptyForm(): AdminFormState {
  return {
    id: "",
    slug: "",
    title: "",
    description: "",
    phase: "INTERMEDIATE",
    grade_min: "4",
    grade_max: "4",
    subjects_csv: "",
    format: "DIGITAL",
    price_cents: "0",
    currency: "ZAR",
    license_type: "CC_BY",
    license_url: "",
    attribution_html: "",
    source_url: "",
    source_provider: "MANUAL",
    supplier_id: "",
    is_adapted: false,
    is_excerpt: false,
    is_partial_product: false,
    storage_key: "",
    delivery_mode: "",
    file_type: "LINK_ONLY",
    file_size: "",
    checksum: "",
    external_download_url: "",
    fulfillment_type: "LINK_ONLY",
    pod_spec_json: "{}",
    pod_base_cost_cents: "",
    target_margin_rate: "",
    vat_inclusive: true,
    stock_qty: "",
    tags_csv: "",
    is_active: true,
  };
}

function productToForm(product: BookstoreProduct): AdminFormState {
  return {
    id: product.id,
    slug: product.slug || "",
    title: product.title || "",
    description: product.description || "",
    phase: product.phase,
    grade_min: String(product.grade_min ?? 0),
    grade_max: String(product.grade_max ?? 0),
    subjects_csv: (product.subjects || []).join(", "),
    format: product.format,
    price_cents: String(product.price_cents ?? 0),
    currency: product.currency || "ZAR",
    license_type: product.license_type,
    license_url: product.license_url || "",
    attribution_html: product.attribution_html || "",
    source_url: product.source_url || "",
    source_provider: product.source_provider,
    supplier_id: product.supplier_id || "",
    is_adapted: Boolean(product.is_adapted),
    is_excerpt: Boolean(product.is_excerpt),
    is_partial_product: Boolean(product.is_partial_product),
    storage_key: product.digital_asset?.storage_key || "",
    delivery_mode: (product.delivery_mode as any) || "",
    file_type: ((product.digital_asset?.file_type as any) || "LINK_ONLY"),
    file_size: product.digital_asset?.file_size ? String(product.digital_asset.file_size) : "",
    checksum: product.digital_asset?.checksum || "",
    external_download_url: product.external_download_url || "",
    fulfillment_type: product.fulfillment_type,
    pod_spec_json: JSON.stringify(product.pod_spec_json || {}, null, 2),
    pod_base_cost_cents:
      product.pod_base_cost_cents == null ? "" : String(product.pod_base_cost_cents),
    target_margin_rate:
      product.target_margin_rate == null ? "" : String(product.target_margin_rate),
    vat_inclusive: product.vat_inclusive ?? true,
    stock_qty: product.stock_qty == null ? "" : String(product.stock_qty),
    tags_csv: (product.tags || []).join(", "),
    is_active: Boolean(product.is_active),
  };
}

export function AdminBookstoreClient() {
  const { session } = useSession();
  const [products, setProducts] = useState<BookstoreProduct[]>([]);
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [jobs, setJobs] = useState<IngestJobRow[]>([]);
  const [form, setForm] = useState<AdminFormState>(emptyForm());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [licenseWarnings, setLicenseWarnings] = useState<string[]>([]);
  const [licenseNotes, setLicenseNotes] = useState<string[]>([]);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [oerSeedFormat, setOerSeedFormat] = useState<"all" | "json" | "csv">("all");
  const [oerIngestResults, setOerIngestResults] = useState<BookstoreOerIngestResult[]>([]);
  const [podQuote, setPodQuote] = useState<PodQuote | null>(null);
  const [podCalcBusy, setPodCalcBusy] = useState(false);
  const [podCalc, setPodCalc] = useState({
    productKind: "textbook" as "workbook" | "textbook" | "color",
    printCostCents: "",
    shippingCostCents: "0",
    fixedFeesCents: "0",
    paymentFeeRate: "0.029",
    riskBufferRate: "0.03",
    targetMarginRate: "",
    vatRate: "0.15",
    vatInclusive: true,
    roundingStepCents: "100",
  });

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminBookstoreDashboard(API_BASE);
      setProducts(data.products || []);
      setOrders((data.orders || []) as AdminOrderRow[]);
      setJobs((data.ingestJobs || []) as IngestJobRow[]);
    } catch (err) {
      setError(getHttpErrorMessage(err, "Unable to load admin bookstore data."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const patchForm = <K extends keyof AdminFormState>(key: K, value: AdminFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!session?.csrfToken) {
      setError("Missing session/CSRF token.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    setLicenseWarnings([]);
    setLicenseNotes([]);
    try {
      let podSpecJson: Record<string, unknown> = {};
      try {
        podSpecJson = form.pod_spec_json.trim() ? (JSON.parse(form.pod_spec_json) as Record<string, unknown>) : {};
      } catch {
        setError("POD spec JSON is invalid.");
        return;
      }
      const payload: AdminBookstoreProductInput = {
        id: form.id || undefined,
        slug: form.slug || undefined,
        title: form.title.trim(),
        description: form.description.trim(),
        phase: form.phase,
        grade_min: Number(form.grade_min || 0),
        grade_max: Number(form.grade_max || 0),
        subjects: form.subjects_csv
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        format: form.format,
        price_cents: Number(form.price_cents || 0),
        currency: (form.currency || "ZAR").toUpperCase(),
        license_type: form.license_type,
        license_url: form.license_url || undefined,
        attribution_html: form.attribution_html || "",
        source_url: form.source_url || undefined,
        source_provider: form.source_provider,
        supplier_id: form.supplier_id || undefined,
        is_adapted: form.is_adapted,
        is_excerpt: form.is_excerpt,
        is_partial_product: form.is_partial_product,
        storage_key: form.storage_key || undefined,
        delivery_mode: form.delivery_mode || undefined,
        file_type: form.file_type || undefined,
        file_size: form.file_size ? Number(form.file_size) : undefined,
        checksum: form.checksum || undefined,
        external_download_url: form.external_download_url || undefined,
        fulfillment_type: form.fulfillment_type,
        pod_spec_json: podSpecJson,
        pod_base_cost_cents: form.pod_base_cost_cents ? Number(form.pod_base_cost_cents) : null,
        target_margin_rate: form.target_margin_rate ? Number(form.target_margin_rate) : null,
        vat_inclusive: form.vat_inclusive,
        stock_qty: form.stock_qty === "" ? null : Number(form.stock_qty),
        tags: form.tags_csv
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        metadata_json: {
          admin_ui: "bookstore_v1",
          ...(podQuote
            ? {
                pod_pricing_recommendation: {
                  recommendedPriceCents: podQuote.recommendedPriceCents,
                  targetMarginRate: podQuote.targetMarginRate,
                  vatDisplayMode: podQuote.vatDisplayMode,
                  breakdown: podQuote.breakdown,
                },
              }
            : {}),
        },
        is_active: form.is_active,
      };
      const result = await saveAdminBookstoreProduct(API_BASE, session.csrfToken, payload);
      setLicenseWarnings(result.warnings ?? []);
      setLicenseNotes(result.notes ?? []);
      setNotice(result.product ? `Saved ${result.product.title}` : "Saved product");
      if (result.product) {
        setForm(productToForm(result.product));
      }
      await loadDashboard();
    } catch (err) {
      setError(getHttpErrorMessage(err, "Unable to save product."));
    } finally {
      setBusy(false);
    }
  };

  const handleOerIngest = async () => {
    if (!session?.csrfToken) return;
    setBusy(true);
    setError(null);
    try {
      const result = await runBookstoreOerIngest(API_BASE, session.csrfToken, { seedFormat: oerSeedFormat });
      setOerIngestResults(result.results || []);
      setNotice(
        `OER ingest (${result.seedFormat || oerSeedFormat}) completed. Imported ${result.imported} item(s)` +
          `${result.failed ? `, failed ${result.failed}` : ""}.`
      );
      await loadDashboard();
    } catch (err) {
      setError(getHttpErrorMessage(err, "OER ingest failed."));
    } finally {
      setBusy(false);
    }
  };

  const handlePodRecommend = async () => {
    if (!session?.csrfToken) {
      setError("Missing session/CSRF token.");
      return;
    }
    setPodCalcBusy(true);
    setError(null);
    try {
      const result = await recommendPodBookstorePrice(API_BASE, session.csrfToken, {
        productKind: podCalc.productKind,
        printCostCents: Number(podCalc.printCostCents || 0),
        shippingCostCents: Number(podCalc.shippingCostCents || 0),
        fixedFeesCents: Number(podCalc.fixedFeesCents || 0),
        paymentFeeRate: Number(podCalc.paymentFeeRate || 0),
        riskBufferRate: Number(podCalc.riskBufferRate || 0),
        targetMarginRate: podCalc.targetMarginRate === "" ? undefined : Number(podCalc.targetMarginRate),
        vatRate: Number(podCalc.vatRate || 0.15),
        vatInclusive: podCalc.vatInclusive,
        roundingStepCents: Number(podCalc.roundingStepCents || 100),
      });
      setPodQuote(result);
      patchForm("price_cents", String(result.recommendedPriceCents));
      patchForm("pod_base_cost_cents", String(Number(podCalc.printCostCents || 0)));
      patchForm("target_margin_rate", String(result.targetMarginRate));
      patchForm("vat_inclusive", podCalc.vatInclusive);
    } catch (err) {
      setError(getHttpErrorMessage(err, "Unable to calculate POD price."));
    } finally {
      setPodCalcBusy(false);
    }
  };

  const handleSupplierSync = async (provider: "WHOLESALER" | "PUBLISHER_DIRECT") => {
    if (!session?.csrfToken) return;
    setBusy(true);
    setError(null);
    try {
      const result = await runBookstoreSupplierSync(API_BASE, session.csrfToken, provider);
      setNotice(result.message || `${provider} sync finished.`);
      await loadDashboard();
    } catch (err) {
      setError(getHttpErrorMessage(err, "Supplier sync failed."));
    } finally {
      setBusy(false);
    }
  };

  const handleOrderStatusUpdate = async (orderId: string, status: string) => {
    if (!session?.csrfToken) return;
    setUpdatingOrderId(orderId);
    setError(null);
    try {
      await updateAdminBookstoreOrderStatus(API_BASE, session.csrfToken, orderId, status);
      setNotice(`Updated order ${orderId} to ${status}.`);
      await loadDashboard();
    } catch (err) {
      setError(getHttpErrorMessage(err, "Unable to update order status."));
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return (
    <div className={styles.page}>
      <section className={`${styles.heroCard} glass card card-with-back`}>
        <div className={styles.heroTop}>
          <div>
            <h1 className="title">Admin Bookstore</h1>
            <p className="subtitle">
              Manage catalog listings, curated OER ingestion, supplier sync jobs, and order statuses.
            </p>
          </div>
          <div className={styles.toolbar}>
            <Link className="button" href="/bookstore">
              Open storefront
            </Link>
            <button className="button" type="button" onClick={() => setForm(emptyForm())}>
              New product
            </button>
          </div>
        </div>

        <div className={styles.toolbar}>
          <label className={styles.inlineField}>
            Seed format
            <select value={oerSeedFormat} onChange={(e) => setOerSeedFormat(e.target.value as any)}>
              <option value="all">JSON + CSV</option>
              <option value="json">JSON only</option>
              <option value="csv">CSV only</option>
            </select>
          </label>
          <button className="button" type="button" onClick={handleOerIngest} disabled={busy}>
            {busy ? "Working..." : "Import curated OER seed"}
          </button>
          <button
            className="button"
            type="button"
            onClick={() => handleSupplierSync("WHOLESALER")}
            disabled={busy}
          >
            Sync wholesaler (stub)
          </button>
          <button
            className="button"
            type="button"
            onClick={() => handleSupplierSync("PUBLISHER_DIRECT")}
            disabled={busy}
          >
            Sync publisher direct (stub)
          </button>
        </div>
      </section>

      {error ? <p className={`${styles.notice} ${styles.noticeError}`}>{error}</p> : null}
      {notice ? <p className={`${styles.notice} ${styles.noticeSuccess}`}>{notice}</p> : null}
      {licenseWarnings.length ? (
        <p className={`${styles.notice} ${styles.noticeError}`}>{licenseWarnings.join(" | ")}</p>
      ) : null}
      {licenseNotes.length ? <p className={styles.notice}>{licenseNotes.join(" | ")}</p> : null}
      {oerIngestResults.length ? (
        <section className={`${styles.listCard} glass card`}>
          <div className={styles.row}>
            <h2 className="title" style={{ margin: 0, fontSize: "1.05rem" }}>
              Latest OER import results ({oerIngestResults.length})
            </h2>
          </div>
          <div className={styles.scrollBox}>
            <table className={styles.adminTable}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Title</th>
                  <th>Source</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {oerIngestResults.map((row, index) => (
                  <tr key={`${row.source_file}:${row.slug}:${index}`}>
                    <td>{row.status}</td>
                    <td>
                      <div><strong>{row.title}</strong></div>
                      <div className={styles.muted}>{row.slug}</div>
                    </td>
                    <td>
                      <div>{row.source_provider}</div>
                      <div className={styles.muted}>{row.source_file}</div>
                    </td>
                    <td className={styles.muted}>
                      {row.error || row.warnings?.join(" | ") || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className={styles.splitAdmin}>
        <div className={`${styles.formCard} glass card`}>
          <div className={styles.row}>
            <h2 className="title" style={{ margin: 0, fontSize: "1.05rem" }}>
              {form.id ? "Edit product" : "Create product"}
            </h2>
            {form.id ? <span className={styles.code}>{form.id}</span> : null}
          </div>

          <div className={styles.filterGrid}>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              Title
              <input value={form.title} onChange={(e) => patchForm("title", e.target.value)} />
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              Slug (optional)
              <input value={form.slug} onChange={(e) => patchForm("slug", e.target.value)} />
            </label>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              Description
              <textarea rows={4} value={form.description} onChange={(e) => patchForm("description", e.target.value)} />
            </label>

            <label className={styles.field}>
              Phase
              <select value={form.phase} onChange={(e) => patchForm("phase", e.target.value as any)}>
                {BOOKSTORE_PHASES.map((phase) => (
                  <option key={phase} value={phase}>
                    {formatLabel(phase)}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Grade min
              <input type="number" min={0} max={12} value={form.grade_min} onChange={(e) => patchForm("grade_min", e.target.value)} />
            </label>
            <label className={styles.field}>
              Grade max
              <input type="number" min={0} max={12} value={form.grade_max} onChange={(e) => patchForm("grade_max", e.target.value)} />
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              Subjects (comma separated)
              <input
                value={form.subjects_csv}
                onChange={(e) => patchForm("subjects_csv", e.target.value)}
                placeholder="Mathematics, English Home Language"
              />
            </label>

            <label className={styles.field}>
              Format
              <select value={form.format} onChange={(e) => patchForm("format", e.target.value as any)}>
                {BOOKSTORE_FORMATS.map((format) => (
                  <option key={format} value={format}>
                    {formatLabel(format)}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Fulfillment
              <select value={form.fulfillment_type} onChange={(e) => patchForm("fulfillment_type", e.target.value as any)}>
                {BOOKSTORE_FULFILLMENT_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {formatLabel(item)}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Price (cents)
              <input type="number" min={0} value={form.price_cents} onChange={(e) => patchForm("price_cents", e.target.value)} />
            </label>
            <label className={styles.field}>
              Currency
              <input value={form.currency} onChange={(e) => patchForm("currency", e.target.value.toUpperCase())} />
            </label>

            <label className={styles.field}>
              License
              <select value={form.license_type} onChange={(e) => patchForm("license_type", e.target.value as any)}>
                {BOOKSTORE_LICENSE_TYPES.map((license) => (
                  <option key={license} value={license}>
                    {formatLabel(license)}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              License URL
              <input value={form.license_url} onChange={(e) => patchForm("license_url", e.target.value)} />
            </label>
            <label className={styles.field}>
              Source provider
              <select value={form.source_provider} onChange={(e) => patchForm("source_provider", e.target.value as any)}>
                {BOOKSTORE_SOURCE_PROVIDERS.map((provider) => (
                  <option key={provider} value={provider}>
                    {formatLabel(provider)}
                  </option>
                ))}
              </select>
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              Source URL
              <input value={form.source_url} onChange={(e) => patchForm("source_url", e.target.value)} />
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              External download URL (link-only OER)
              <input
                value={form.external_download_url}
                onChange={(e) => patchForm("external_download_url", e.target.value)}
              />
            </label>
            <label className={styles.field}>
              Delivery mode (digital)
              <select value={form.delivery_mode} onChange={(e) => patchForm("delivery_mode", e.target.value as any)}>
                <option value="">Auto</option>
                <option value="LINK_ONLY">Link only</option>
                <option value="FILE_DOWNLOAD">File download</option>
              </select>
            </label>
            <label className={styles.field}>
              Supplier ID (optional)
              <input value={form.supplier_id} onChange={(e) => patchForm("supplier_id", e.target.value)} />
            </label>

            <label className={`${styles.field} ${styles.fieldFull}`}>
              Attribution HTML (required for licensed content)
              <textarea
                rows={4}
                value={form.attribution_html}
                onChange={(e) => patchForm("attribution_html", e.target.value)}
              />
            </label>

            <label className={styles.field}>
              File type
              <select value={form.file_type} onChange={(e) => patchForm("file_type", e.target.value as any)}>
                {["PDF", "EPUB", "ZIP", "LINK_ONLY"].map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Storage key
              <input value={form.storage_key} onChange={(e) => patchForm("storage_key", e.target.value)} />
            </label>
            <label className={styles.field}>
              File size (bytes)
              <input type="number" min={0} value={form.file_size} onChange={(e) => patchForm("file_size", e.target.value)} />
            </label>
            <label className={styles.field}>
              Checksum
              <input value={form.checksum} onChange={(e) => patchForm("checksum", e.target.value)} />
            </label>
            <label className={styles.field}>
              Stock qty (blank for POD/link-only)
              <input type="number" min={0} value={form.stock_qty} onChange={(e) => patchForm("stock_qty", e.target.value)} />
            </label>
            <label className={styles.field}>
              POD base cost (cents)
              <input
                type="number"
                min={0}
                value={form.pod_base_cost_cents}
                onChange={(e) => patchForm("pod_base_cost_cents", e.target.value)}
              />
            </label>
            <label className={styles.field}>
              Target margin rate
              <input
                type="number"
                min={0}
                max={0.94}
                step="0.01"
                value={form.target_margin_rate}
                onChange={(e) => patchForm("target_margin_rate", e.target.value)}
              />
            </label>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              POD spec JSON
              <textarea
                rows={4}
                value={form.pod_spec_json}
                onChange={(e) => patchForm("pod_spec_json", e.target.value)}
                placeholder='{"trim_size":"A4","binding":"saddle_stitch","page_count":64,"color_mode":"bw"}'
              />
            </label>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              Tags (comma separated)
              <input value={form.tags_csv} onChange={(e) => patchForm("tags_csv", e.target.value)} />
            </label>

            <label className={styles.checkboxField}>
              <input type="checkbox" checked={form.is_adapted} onChange={(e) => patchForm("is_adapted", e.target.checked)} />
              Mark as adapted resource (triggers SA/changes notices)
            </label>
            <label className={styles.checkboxField}>
              <input type="checkbox" checked={form.is_excerpt} onChange={(e) => patchForm("is_excerpt", e.target.checked)} />
              Excerpt / partial preview product (blocked for ND licenses)
            </label>
            <label className={styles.checkboxField}>
              <input
                type="checkbox"
                checked={form.is_partial_product}
                onChange={(e) => patchForm("is_partial_product", e.target.checked)}
              />
              Partial/remixed product (blocked for ND licenses)
            </label>
            <label className={styles.checkboxField}>
              <input
                type="checkbox"
                checked={form.vat_inclusive}
                onChange={(e) => patchForm("vat_inclusive", e.target.checked)}
              />
              VAT inclusive display
            </label>
            <label className={styles.checkboxField}>
              <input type="checkbox" checked={form.is_active} onChange={(e) => patchForm("is_active", e.target.checked)} />
              Active listing
            </label>
          </div>

          <section className={styles.calcCard}>
            <div className={styles.row}>
              <h3 className={styles.calcTitle}>POD pricing recommendation</h3>
              <button className="button" type="button" onClick={handlePodRecommend} disabled={podCalcBusy}>
                {podCalcBusy ? "Calculating..." : "Recommend retail"}
              </button>
            </div>
            <div className={styles.miniGrid}>
              <label className={styles.field}>
                Product kind
                <select
                  value={podCalc.productKind}
                  onChange={(e) => setPodCalc((prev) => ({ ...prev, productKind: e.target.value as any }))}
                >
                  <option value="workbook">Workbook</option>
                  <option value="textbook">Textbook</option>
                  <option value="color">Color book</option>
                </select>
              </label>
              <label className={styles.field}>
                Print cost (cents)
                <input
                  type="number"
                  min={0}
                  value={podCalc.printCostCents}
                  onChange={(e) => setPodCalc((prev) => ({ ...prev, printCostCents: e.target.value }))}
                />
              </label>
              <label className={styles.field}>
                Shipping cost (cents)
                <input
                  type="number"
                  min={0}
                  value={podCalc.shippingCostCents}
                  onChange={(e) => setPodCalc((prev) => ({ ...prev, shippingCostCents: e.target.value }))}
                />
              </label>
              <label className={styles.field}>
                Fixed fees (cents)
                <input
                  type="number"
                  min={0}
                  value={podCalc.fixedFeesCents}
                  onChange={(e) => setPodCalc((prev) => ({ ...prev, fixedFeesCents: e.target.value }))}
                />
              </label>
              <label className={styles.field}>
                Payment fee rate
                <input
                  type="number"
                  min={0}
                  max={0.94}
                  step="0.001"
                  value={podCalc.paymentFeeRate}
                  onChange={(e) => setPodCalc((prev) => ({ ...prev, paymentFeeRate: e.target.value }))}
                />
              </label>
              <label className={styles.field}>
                Risk buffer rate
                <input
                  type="number"
                  min={0}
                  max={0.94}
                  step="0.001"
                  value={podCalc.riskBufferRate}
                  onChange={(e) => setPodCalc((prev) => ({ ...prev, riskBufferRate: e.target.value }))}
                />
              </label>
              <label className={styles.field}>
                Target margin rate (optional)
                <input
                  type="number"
                  min={0}
                  max={0.94}
                  step="0.01"
                  value={podCalc.targetMarginRate}
                  onChange={(e) => setPodCalc((prev) => ({ ...prev, targetMarginRate: e.target.value }))}
                />
              </label>
              <label className={styles.field}>
                VAT rate
                <input
                  type="number"
                  min={0}
                  max={0.5}
                  step="0.01"
                  value={podCalc.vatRate}
                  onChange={(e) => setPodCalc((prev) => ({ ...prev, vatRate: e.target.value }))}
                />
              </label>
              <label className={styles.field}>
                Rounding step (cents)
                <input
                  type="number"
                  min={1}
                  value={podCalc.roundingStepCents}
                  onChange={(e) => setPodCalc((prev) => ({ ...prev, roundingStepCents: e.target.value }))}
                />
              </label>
              <label className={styles.checkboxField}>
                <input
                  type="checkbox"
                  checked={podCalc.vatInclusive}
                  onChange={(e) => setPodCalc((prev) => ({ ...prev, vatInclusive: e.target.checked }))}
                />
                VAT inclusive retail recommendation
              </label>
            </div>
            {podQuote ? (
              <div className={styles.notice}>
                Recommended retail: {formatZarCents(podQuote.recommendedPriceCents)} ({podQuote.vatDisplayMode}, target margin{" "}
                {Math.round(podQuote.targetMarginRate * 100)}%)
              </div>
            ) : null}
          </section>

          <div className={styles.toolbar}>
            <button className="button" type="button" onClick={handleSave} disabled={busy}>
              {busy ? "Saving..." : form.id ? "Save changes" : "Create product"}
            </button>
            <button className="button" type="button" onClick={() => setForm(emptyForm())}>
              Reset form
            </button>
          </div>
          <p className={styles.muted}>
            CC BY-ND warning: if you upload/attach a file, keep the original source unchanged and store checksum + source URL.
          </p>
        </div>

        <div className={styles.list}>
          <section className={`${styles.listCard} glass card`}>
            <div className={styles.row}>
              <h2 className="title" style={{ margin: 0, fontSize: "1.05rem" }}>
                Products ({products.length})
              </h2>
              {loading ? <span className={styles.muted}>Loading...</span> : null}
            </div>
            <div className={styles.scrollBox}>
              <table className={styles.adminTable}>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Phase/Grades</th>
                    <th>Price</th>
                    <th>License</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <div>
                          <strong>{product.title}</strong>
                          <div className={styles.muted}>{product.subjects.slice(0, 2).join(", ")}</div>
                        </div>
                      </td>
                      <td>
                        {formatLabel(product.phase)} {product.grade_min === product.grade_max ? product.grade_min : `${product.grade_min}-${product.grade_max}`}
                      </td>
                      <td>{product.is_free ? "Free" : formatZarCents(product.price_cents, product.currency)}</td>
                      <td>
                        <LicenseBadge product={product} />
                      </td>
                      <td>{product.is_active ? "Active" : "Hidden"}</td>
                      <td>
                        <div className={styles.toolbar}>
                          <button className="button" type="button" onClick={() => setForm(productToForm(product))}>
                            Edit
                          </button>
                          <Link className="button" href={`/bookstore/${product.slug}`} target="_blank">
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!products.length ? (
                    <tr>
                      <td colSpan={6} className={styles.muted}>
                        No products yet. Import the curated OER seed or create a manual listing.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className={`${styles.listCard} glass card`}>
            <div className={styles.row}>
              <h2 className="title" style={{ margin: 0, fontSize: "1.05rem" }}>
                Orders ({orders.length})
              </h2>
            </div>
            <div className={styles.scrollBox}>
              <table className={styles.adminTable}>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>User</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Items</th>
                    <th>Update</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <div className={styles.code}>{order.id}</div>
                        <div className={styles.muted}>{new Date(order.created_at).toLocaleString()}</div>
                      </td>
                      <td>{order.user_email || "Unknown user"}</td>
                      <td>{formatZarCents(order.total_cents, order.currency)}</td>
                      <td>
                        <div className={styles.muted}>Order: {order.status}</div>
                        <div className={styles.muted}>Payment: {order.payment_status}</div>
                        <div className={styles.muted}>Fulfillment: {order.fulfillment_status}</div>
                      </td>
                      <td className={styles.muted}>
                        {(order.items || [])
                          .slice(0, 3)
                          .map((item) => `${item.product_title} x${item.quantity}`)
                          .join(" | ") || "—"}
                      </td>
                      <td>
                        <select
                          defaultValue={order.status}
                          onChange={(e) => void handleOrderStatusUpdate(order.id, e.target.value)}
                          disabled={updatingOrderId === order.id}
                        >
                          {["pending", "awaiting_payment", "paid", "canceled", "fulfilled", "failed"].map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                  {!orders.length ? (
                    <tr>
                      <td colSpan={6} className={styles.muted}>
                        No orders yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className={`${styles.listCard} glass card`}>
            <div className={styles.row}>
              <h2 className="title" style={{ margin: 0, fontSize: "1.05rem" }}>
                Ingestion jobs ({jobs.length})
              </h2>
            </div>
            <div className={styles.scrollBox}>
              <table className={styles.adminTable}>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Type</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id}>
                      <td>{new Date(job.created_at).toLocaleString()}</td>
                      <td>{job.job_type}</td>
                      <td>{job.source}</td>
                      <td>{job.status}</td>
                      <td className={styles.muted}>
                        {job.result_json ? JSON.stringify(job.result_json).slice(0, 140) : "—"}
                      </td>
                    </tr>
                  ))}
                  {!jobs.length ? (
                    <tr>
                      <td colSpan={5} className={styles.muted}>
                        No ingest/sync jobs recorded yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
