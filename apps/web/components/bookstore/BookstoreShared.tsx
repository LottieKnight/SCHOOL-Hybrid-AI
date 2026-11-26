"use client";

import Link from "next/link";
import styles from "./Bookstore.module.css";
import {
  buildPublicBookstoreDownloadUrl,
  formatGradeRange,
  formatLabel,
  formatZarCents,
  getLicenseBadgeLabel,
  isCommerciallyAllowedForProduct,
  phaseLabel,
  productHasDownload,
  sanitizeAttributionHtml,
  type BookstoreOrderItem,
  type BookstoreProduct,
} from "@/lib/bookstore";

function logMemoryResourceEvent(
  product: BookstoreProduct,
  eventType: "resource_open" | "recommendation_clicked"
) {
  const moduleCode = typeof product.metadata_json?.moduleCode === "string" ? product.metadata_json.moduleCode : null;
  const conceptKey = Array.isArray(product.concepts) && product.concepts.length > 0 ? product.concepts[0] : null;

  void fetch("/api/memory/events", {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event_type: eventType,
      source_type: "resource",
      module_code: moduleCode,
      concept_key: conceptKey,
      metadata: {
        productId: product.id,
        productSlug: product.slug,
        recommendationReason: product.recommendation_reason ?? null,
      },
    }),
  }).catch(() => null);
}

type ProductCardProps = {
  product: BookstoreProduct;
  apiBase?: string;
  onAddToCart?: (product: BookstoreProduct) => void;
  addDisabled?: boolean;
  showInstitutionMeta?: boolean;
};

export function LicenseBadge({
  product,
  className,
}: {
  product:
    | Pick<BookstoreProduct, "license_type" | "nc_noncommercial" | "sa_sharealike" | "nd_no_derivatives">
    | (Pick<BookstoreOrderItem, "product_license_type"> & {
        nc_noncommercial?: boolean;
        sa_sharealike?: boolean;
        nd_no_derivatives?: boolean;
      });
  className?: string;
}) {
  const licenseType = "license_type" in product ? product.license_type : product.product_license_type;
  const cls = [
    styles.licenseBadge,
    product.nc_noncommercial ? styles.licenseBadgeNc : "",
    product.sa_sharealike ? styles.licenseBadgeSa : "",
    product.nd_no_derivatives ? styles.licenseBadgeNd : "",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");
  return <span className={cls}>{getLicenseBadgeLabel({ license_type: licenseType as any })}</span>;
}

export function AttributionBlock({
  attributionHtml,
  title = "Attribution",
}: {
  attributionHtml?: string | null;
  title?: string;
}) {
  if (!attributionHtml) return null;
  const sanitized = sanitizeAttributionHtml(attributionHtml);
  if (!sanitized.trim()) return null;
  return (
    <div className={styles.attributionBlock}>
      <p className={styles.attributionTitle}>{title}</p>
      <div className={styles.attributionHtml} dangerouslySetInnerHTML={{ __html: sanitized }} />
    </div>
  );
}

export function ProductMetaPills({ product }: { product: BookstoreProduct }) {
  return (
    <div className={styles.metaRow}>
      <span className={styles.pill}>{phaseLabel(product.phase)} Phase</span>
      <span className={styles.pill}>{formatGradeRange(product)}</span>
      <span className={styles.pill}>{formatLabel(product.format)}</span>
      <span className={styles.pill}>{formatLabel(product.fulfillment_type)}</span>
      {product.subjects.slice(0, 3).map((subject) => (
        <span key={subject} className={styles.pill}>
          {subject}
        </span>
      ))}
      {product.subjects.length > 3 ? (
        <span className={styles.pill}>+{product.subjects.length - 3} subjects</span>
      ) : null}
    </div>
  );
}

export function ProductCard({ product, apiBase, onAddToCart, addDisabled, showInstitutionMeta }: ProductCardProps) {
  const priceLabel = product.is_free ? "Free" : formatZarCents(product.price_cents, product.currency);
  const priceClass = `${styles.priceTag} ${product.is_free ? styles.priceFree : styles.pricePaid}`;
  const hasDirectDownload =
    !!apiBase && product.is_free && product.fulfillment_type === "LINK_ONLY" && !!product.external_download_url;
  const coverUrl = typeof product.metadata_json?.coverUrl === "string" ? product.metadata_json.coverUrl : null;
  return (
    <article className={styles.productCard}>
      {coverUrl ? (
        <div className={styles.productCover}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt={`${product.title} cover`} loading="lazy" />
        </div>
      ) : null}
      <div className={styles.productHeader}>
        <div className={styles.productTitleRow}>
          <h3 className={styles.productTitle}>{product.title}</h3>
          <span className={priceClass}>{priceLabel}</span>
        </div>
      <div className={styles.metaRow}>
        {showInstitutionMeta ? (
          <span className={styles.pill}>{product.institution_name || "Universal"}</span>
        ) : null}
        <LicenseBadge product={product} />
        <span className={`${styles.pill} ${isCommerciallyAllowedForProduct(product) ? "" : styles.commercialBlocked}`}>
          {isCommerciallyAllowedForProduct(product) ? "Commercial use allowed" : "Non-commercial - not for sale"}
        </span>
      </div>
        <ProductMetaPills product={product} />
      </div>
      <p className={styles.description}>{product.description}</p>
      {product.recommendation_reason ? (
        <div className={styles.recommendationPanel}>
          <span className={styles.recommendationBadge}>Recommended for a reason</span>
          <p className={styles.recommendationReason}>{product.recommendation_reason}</p>
        </div>
      ) : null}
      <div className={styles.actions}>
        <Link
          className="button"
          href={`/bookstore/${product.slug}`}
          onClick={() => {
            if (!showInstitutionMeta) return;
            logMemoryResourceEvent(product, "resource_open");
            if (product.recommendation_reason) {
              logMemoryResourceEvent(product, "recommendation_clicked");
            }
          }}
        >
          View details
        </Link>
        {onAddToCart ? (
          <button className="button" type="button" onClick={() => onAddToCart(product)} disabled={addDisabled}>
            Add to cart
          </button>
        ) : null}
        {hasDirectDownload ? (
          <a
            className="button"
            href={buildPublicBookstoreDownloadUrl(apiBase!, product.id)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              if (!showInstitutionMeta) return;
              logMemoryResourceEvent(product, "resource_open");
              if (product.recommendation_reason) {
                logMemoryResourceEvent(product, "recommendation_clicked");
              }
            }}
          >
            Free download
          </a>
        ) : null}
      </div>
    </article>
  );
}

export function ProductLicenseSection({
  product,
  notes,
  warnings,
}: {
  product: BookstoreProduct;
  notes?: string[];
  warnings?: string[];
}) {
  return (
    <details className={styles.licenseSection} open>
      <summary>License &amp; Attribution</summary>
      <div className={styles.metaRow}>
        <LicenseBadge product={product} />
        <span className={`${styles.pill} ${isCommerciallyAllowedForProduct(product) ? "" : styles.commercialBlocked}`}>
          {isCommerciallyAllowedForProduct(product) ? "Commercial use allowed" : "Non-commercial - not for sale"}
        </span>
        <span className={`${styles.pill} ${product.nd_no_derivatives ? styles.commercialBlocked : ""}`}>
          {product.license_capabilities?.isDerivativeAllowed ?? !product.nd_no_derivatives
            ? "Derivatives allowed"
            : "Derivatives not allowed"}
        </span>
        {product.license_url ? (
          <a href={product.license_url} target="_blank" rel="noopener noreferrer" className="button">
            License text
          </a>
        ) : null}
        {product.source_url ? (
          <a href={product.source_url} target="_blank" rel="noopener noreferrer" className="button">
            Source
          </a>
        ) : null}
      </div>
      <p className={styles.muted}>
        Provider: {formatLabel(product.source_provider)} | Fulfillment: {formatLabel(product.fulfillment_type)}
      </p>
      {product.nd_no_derivatives ? (
        <p className={styles.notice}>
          NoDerivatives applies. Redistribution must use the original file. Editing/remixing flows are disabled.
        </p>
      ) : null}
      {product.nc_noncommercial ? (
        <p className={`${styles.notice} ${styles.noticeError}`}>
          Non-commercial - not for sale. Any printing/sale options are disabled for this item.
        </p>
      ) : null}
      {product.sa_sharealike && product.is_adapted ? (
        <p className={styles.notice}>
          This is an adaptation under ShareAlike. The adaptation must be published under the same license and changes
          must be indicated.
        </p>
      ) : null}
      {product.is_adapted && !product.sa_sharealike ? (
        <p className={styles.notice}>Adapted resource: indicate changes made when redistributing.</p>
      ) : null}
      {warnings?.length ? (
        <div className={`${styles.notice} ${styles.noticeError}`}>{warnings.join(" | ")}</div>
      ) : null}
      {notes?.length ? <div className={styles.notice}>{notes.join(" | ")}</div> : null}
      <AttributionBlock attributionHtml={product.attribution_html} title="Attribution (required)" />
    </details>
  );
}

export function OrderLineLicense({ item }: { item: BookstoreOrderItem }) {
  const snapshot = (item.product_snapshot_json || {}) as Record<string, unknown>;
  return (
    <div className={styles.lineItem}>
      <div className={styles.lineTop}>
        <div>
          <strong>{item.product_title}</strong>
          <div className={styles.muted}>
            Qty {item.quantity} | {formatLabel(item.fulfillment_type)}
          </div>
        </div>
        <div>{formatZarCents(item.line_total_cents)}</div>
      </div>
      <div className={styles.metaRow}>
        <LicenseBadge
          product={{
            product_license_type: item.product_license_type,
            nc_noncommercial: Boolean(snapshot.nc_noncommercial),
            sa_sharealike: Boolean(snapshot.sa_sharealike),
            nd_no_derivatives: Boolean(snapshot.nd_no_derivatives),
          }}
        />
        {item.product_license_url ? (
          <a href={item.product_license_url} target="_blank" rel="noopener noreferrer" className="button">
            License
          </a>
        ) : null}
      </div>
      <AttributionBlock attributionHtml={item.product_attribution_html} title="Attribution" />
    </div>
  );
}

export function HasProductDownloadBadge({ product }: { product: BookstoreProduct }) {
  if (!productHasDownload(product)) return null;
  return <span className={styles.pill}>Downloadable</span>;
}
