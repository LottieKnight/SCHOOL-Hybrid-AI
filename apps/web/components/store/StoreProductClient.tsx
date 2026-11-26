"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addStoreCartItem,
  fetchStoreProduct,
  formatZarCents,
  getHttpErrorMessage,
  type StoreProduct,
  type StoreVendor,
} from "@/lib/stores";
import { StateCard } from "@/components/ui/StateCard";
import { StoreDdpPanel } from "./StoreDdpPanel";
import styles from "./Store.module.css";

const API = "/api";

type VariantGroup = {
  name: string;
  values: string[];
};

type Props = {
  storeSlug: string;
  productSlug: string;
};

export function StoreProductClient({ storeSlug, productSlug }: Props) {
  const [store, setStore] = useState<StoreVendor | null>(null);
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void fetchStoreProduct(API, storeSlug, productSlug)
      .then((data) => {
        if (!active) return;
        setStore(data.store);
        setProduct(data.product);
        const groups = data.product.variants as VariantGroup[];
        const initial: Record<string, string> = {};
        for (const group of groups) {
          if (group.values?.length) initial[group.name] = group.values[0];
        }
        setChoices(initial);
      })
      .catch((err) => {
        if (!active) return;
        setError(getHttpErrorMessage(err, "Unable to load this product."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [storeSlug, productSlug]);

  const variantGroups = useMemo(() => (product?.variants as VariantGroup[] | undefined) ?? [], [product]);

  const handleAdd = () => {
    if (!product) return;
    addStoreCartItem(product.id, quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1500);
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <StateCard title="Product" description="Loading product details..." />
      </div>
    );
  }

  if (error || !product || !store) {
    return (
      <div className={styles.page}>
        <StateCard title="Product not found" description={error || "This product may have been removed."}>
          <Link className="button" href={`/store/${storeSlug}`}>
            Back to {store?.name || "store"}
          </Link>
        </StateCard>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <section className={`${styles.hero} glass card card-with-back`}>
        <div className={styles.heroTop}>
          <div>
            <h1 className="title">{store.name}</h1>
            <p className="subtitle">{store.tagline}</p>
          </div>
          <div className={styles.toolbar}>
            <Link className="button" href={`/store/${storeSlug}`}>
              Back to catalog
            </Link>
            <Link className="button" href="/cart">
              Cart
            </Link>
          </div>
        </div>
      </section>

      <section className={`${styles.productLayout} glass card`}>
        <div className={styles.productImage}>
          {product.images?.[0] ? (
            <img src={product.images[0]} alt={product.title} />
          ) : (
            <span>{product.title.slice(0, 3).toUpperCase()}</span>
          )}
        </div>

        <div className={styles.productDetails}>
          <div>
            <div className={styles.meta}>
              <span className={styles.pill}>
                {product.priceCents > 0 ? formatZarCents(product.priceCents, product.currency) : "Free"}
              </span>
              {product.tags?.map((tag) => (
                <span key={tag} className={styles.pill}>
                  {tag}
                </span>
              ))}
            </div>
            <h2 className="title" style={{ marginTop: 12, marginBottom: 8 }}>
              {product.title}
            </h2>
            <p className="subtitle">{product.description}</p>
          </div>

          {variantGroups.length > 0 ? (
            <div className={styles.variantBlock}>
              {variantGroups.map((group) => (
                <div key={group.name}>
                  <span className={styles.muted} style={{ fontWeight: 600 }}>
                    {group.name}: {choices[group.name]}
                  </span>
                  <div className={styles.variantOptions}>
                    {group.values.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`${styles.variantChip} ${
                          choices[group.name] === value ? styles.variantChipSelected : ""
                        }`}
                        onClick={() => setChoices((prev) => ({ ...prev, [group.name]: value }))}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className={styles.quantityRow}>
            <div className={styles.quantityStepper}>
              <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))}>
                −
              </button>
              <span>{quantity}</span>
              <button type="button" onClick={() => setQuantity((current) => Math.min(99, current + 1))}>
                +
              </button>
            </div>
            <button className="button" type="button" onClick={handleAdd}>
              {added ? "Added to cart" : "Add to cart"}
            </button>
          </div>

          <div className={styles.meta}>
            <span className={styles.pill}>Fulfillment: {product.fulfillmentType.replace(/_/g, " ")}</span>
            {product.stockQty == null ? (
              <span className={styles.pill}>Made to order</span>
            ) : product.stockQty > 0 ? (
              <span className={styles.pill}>In stock ({product.stockQty} available)</span>
            ) : (
              <span className={styles.pill}>Sold out</span>
            )}
          </div>

          <StoreDdpPanel
            storeSlug={storeSlug}
            productSlug={productSlug}
            priceCents={product.priceCents}
            currency={product.currency}
          />
        </div>
      </section>
    </div>
  );
}
