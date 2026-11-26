"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/apiBase";
import {
  addBookstoreCartItem,
  buildPublicBookstoreDownloadUrl,
  fetchBookstoreProduct,
  formatLabel,
  formatZarCents,
  getHttpErrorMessage,
  type BookstoreProduct,
} from "@/lib/bookstore";
import { ProductLicenseSection, ProductMetaPills } from "./BookstoreShared";
import { StateCard } from "@/components/ui/StateCard";
import styles from "./Bookstore.module.css";

export function BookstoreProductClient({ slug }: { slug: string }) {
  const [product, setProduct] = useState<BookstoreProduct | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setNotice(null);
    void fetchBookstoreProduct(API_BASE, slug)
      .then((data) => {
        if (!active) return;
        setProduct(data.product);
        setNotes(data.licensing?.notes ?? []);
        setWarnings(data.licensing?.warnings ?? []);
      })
      .catch((err) => {
        if (!active) return;
        setError(getHttpErrorMessage(err, "Unable to load product."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const addToCart = () => {
    if (!product) return;
    addBookstoreCartItem(product.id, 1);
    setNotice(`Added "${product.title}" to cart.`);
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <StateCard title="Loading product" description="Fetching book details and license information." />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className={styles.page}>
        <StateCard title="Bookstore product" description={error || "Product not found."}>
          <Link className="button" href="/bookstore">
            Back to catalog
          </Link>
        </StateCard>
      </div>
    );
  }

  const canDirectDownload =
    product.is_free && product.fulfillment_type === "LINK_ONLY" && Boolean(product.external_download_url);

  return (
    <div className={styles.page}>
      <section className={`${styles.heroCard} glass card card-with-back`}>
        <div className={styles.row}>
          <div>
            <Link className="button" href="/bookstore">
              Back to catalog
            </Link>
          </div>
          <div className={styles.toolbar}>
            <Link className="button" href="/cart">
              Cart
            </Link>
            <Link className="button" href="/orders">
              My orders
            </Link>
          </div>
        </div>

        <div className={styles.heroBody}>
          <div className={styles.heroText}>
            <div className={styles.productTitleRow}>
              <div>
                <h1 className="title" style={{ marginBottom: 8 }}>
                  {product.title}
                </h1>
                <p className="subtitle">{product.description}</p>
              </div>
              <span className={`${styles.priceTag} ${product.is_free ? styles.priceFree : styles.pricePaid}`}>
                {product.is_free ? "Free" : formatZarCents(product.price_cents, product.currency)}
              </span>
            </div>

            <ProductMetaPills product={product} />

            <div className={styles.actions}>
              <button className="button" type="button" onClick={addToCart}>
                Add to cart
              </button>
              {canDirectDownload ? (
                <a
                  className="button"
                  href={buildPublicBookstoreDownloadUrl(API_BASE, product.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Free download
                </a>
              ) : null}
              {product.fulfillment_type === "PRINT_ON_DEMAND" || product.fulfillment_type === "SHIP_FROM_SUPPLIER" ? (
                <span className={styles.notice}>
                  This title is fulfilled as {formatLabel(product.fulfillment_type)}.
                </span>
              ) : null}
            </div>

            {notice ? <p className={`${styles.notice} ${styles.noticeSuccess}`}>{notice}</p> : null}
          </div>
          {typeof product.metadata_json?.coverUrl === "string" ? (
            <div className={styles.heroCover}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={product.metadata_json.coverUrl} alt={`${product.title} cover`} />
            </div>
          ) : null}
        </div>
      </section>

      <ProductLicenseSection product={product} notes={notes} warnings={warnings} />
    </div>
  );
}
