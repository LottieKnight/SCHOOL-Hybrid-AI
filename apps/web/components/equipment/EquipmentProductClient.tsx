"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  addEquipmentCartItem,
  fetchEquipmentProduct,
  formatEquipmentCurrency,
  formatEquipmentFulfillment,
  formatEquipmentGradeBand,
  getEquipmentHttpErrorMessage,
  type EquipmentProduct,
} from "@/lib/equipment";
import styles from "./Equipment.module.css";

const API = "/api";

export function EquipmentProductClient({ slug }: { slug: string }) {
  const [product, setProduct] = useState<EquipmentProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setNotice(null);
    void fetchEquipmentProduct(API, slug)
      .then((data) => {
        if (!active) return;
        setProduct(data.product);
      })
      .catch((err) => {
        if (!active) return;
        setError(getEquipmentHttpErrorMessage(err, "Unable to load equipment product."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className={styles.page}>
        <section className={`${styles.sectionCard} glass card card-with-back`}>
          <h1 className="title">Loading equipment...</h1>
          <p className="subtitle">Fetching product details and bundle information.</p>
        </section>
      </div>
    );
  }

  if (!product || error) {
    return (
      <div className={styles.page}>
        <section className={`${styles.sectionCard} glass card card-with-back`}>
          <h1 className="title">Equipment product</h1>
          <p className={`${styles.notice} ${styles.noticeError}`}>{error || "Product not found."}</p>
          <Link className="button" href="/store/equipment">
            Back to equipment store
          </Link>
        </section>
      </div>
    );
  }

  const addToCart = () => {
    addEquipmentCartItem(product.slug, 1);
    setNotice(
      product.isBundle
        ? `Added bundle "${product.title}" to your quote basket.`
        : `Added "${product.title}" to your quote basket.`
    );
  };

  return (
    <div className={styles.page}>
      <section className={`${styles.hero} glass card card-with-back`}>
        <div className={styles.heroTop}>
          <div>
            <h1 className="title">{product.title}</h1>
            <p className="subtitle">{product.description}</p>
          </div>
          <div className={styles.toolbar}>
            <Link className="button" href="/store/equipment">
              Back to catalog
            </Link>
            <Link className="button" href="/cart">
              Quote Basket
            </Link>
          </div>
        </div>
      </section>

      {notice ? <p className={`${styles.notice} ${styles.noticeSuccess}`}>{notice}</p> : null}

      <section className={styles.detailGrid}>
        <article className={`${styles.sectionCard} glass card`}>
          <div className={`${styles.image} ${styles.detailImage}`} aria-hidden>
            {product.images?.[0] ? product.images[0].split("/").pop() : "Equipment image"}
          </div>
          <div className={styles.meta}>
            <span className={styles.pill}>{formatEquipmentGradeBand(product)}</span>
            <span className={styles.pill}>{formatEquipmentFulfillment(product.fulfillmentType)}</span>
            <span className={styles.pill}>{product.category?.name || "Uncategorised"}</span>
            {product.phaseTags.map((phase) => (
              <span key={phase} className={styles.pill}>
                {formatEquipmentFulfillment(phase)}
              </span>
            ))}
          </div>
          <div className={styles.meta}>
            {product.subjectTags.map((tag) => (
              <span key={tag} className={styles.pill}>
                {tag}
              </span>
            ))}
            {product.tags.map((tag) => (
              <span key={tag} className={styles.pill}>
                {tag}
              </span>
            ))}
          </div>
          <div className={styles.toolbar}>
            <span className={styles.price}>{formatEquipmentCurrency(product.priceCents, product.currency)}</span>
            <button className="button" type="button" onClick={addToCart}>
              {product.isBundle ? "Add bundle to quote basket" : "Add to quote basket"}
            </button>
          </div>
          {product.brand || product.sku ? (
            <p className={styles.muted} style={{ margin: 0 }}>
              {product.brand ? `Brand: ${product.brand}` : ""}
              {product.brand && product.sku ? " | " : ""}
              {product.sku ? `SKU: ${product.sku}` : ""}
            </p>
          ) : null}
          {product.stockQty != null || product.leadTimeDays != null ? (
            <p className={styles.muted} style={{ margin: 0 }}>
              {product.stockQty != null ? `Stock: ${product.stockQty}` : "Stock varies"}{" "}
              {product.leadTimeDays != null ? `| Lead time: ${product.leadTimeDays} day(s)` : ""}
            </p>
          ) : null}
        </article>

        <aside className={`${styles.sectionCard} glass card`}>
          <h2 className="title" style={{ margin: 0, fontSize: "1.05rem" }}>
            Product details
          </h2>
          <div className={styles.detail}>
            {Object.keys(product.attributes || {}).length ? (
              <div>
                <div className={styles.muted} style={{ fontSize: "0.82rem", marginBottom: 6 }}>
                  Attributes
                </div>
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontSize: "0.82rem",
                    border: "1px dashed rgba(54,45,30,0.18)",
                    borderRadius: 12,
                    padding: "10px 12px",
                    background: "rgba(255,255,255,0.5)",
                  }}
                >
                  {JSON.stringify(product.attributes, null, 2)}
                </pre>
              </div>
            ) : null}

            {product.isBundle ? (
              <div>
                <div className={styles.muted} style={{ fontSize: "0.82rem", marginBottom: 6 }}>
                  Bundle includes (single purchase)
                </div>
                <div className={styles.bundleList}>
                  {(product.bundleItemsExpanded || []).map((row) => (
                    <div key={row.product.slug} className={styles.bundleRow}>
                      <span className={styles.pill}>x{row.qty}</span>
                      <span>{row.product.title}</span>
                      <Link className="button" href={`/store/equipment/${row.product.slug}`}>
                        View
                      </Link>
                    </div>
                  ))}
                  {!product.bundleItemsExpanded?.length && product.bundleItems?.length
                    ? product.bundleItems.map((row) => (
                        <div key={row.slug} className={styles.bundleRow}>
                          <span className={styles.pill}>x{row.qty}</span>
                          <span>{row.slug}</span>
                          <span className={styles.muted}>Included item</span>
                        </div>
                      ))
                    : null}
                </div>
              </div>
            ) : null}

            {product.fulfillmentType === "AFFILIATE_LINK" ? (
              <p className={styles.notice}>
                Affiliate listing: quote follow-up may include a partner supplier link depending on availability.
              </p>
            ) : null}
            {product.fulfillmentType === "QUOTE_REQUIRED" ? (
              <p className={styles.notice}>
                Quote required: add to your quote basket and request supplier pricing and delivery details.
              </p>
            ) : null}
          </div>
        </aside>
      </section>
    </div>
  );
}
