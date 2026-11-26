"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  clearStoreCart,
  formatZarCents,
  getHttpErrorMessage,
  getStoreCart,
  removeStoreCartItem,
  updateStoreCartItemQuantity,
  validateStoreCartRemote,
  type StoreCartLine,
  type StoreCartValidation,
} from "@/lib/stores";
import { StateCard } from "@/components/ui/StateCard";
import styles from "./Store.module.css";

const API = "/api";

export function StoreCartClient() {
  const [cart, setCart] = useState<StoreCartLine[]>([]);
  const [validated, setValidated] = useState<StoreCartValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = (nextCart = getStoreCart()) => {
    setCart(nextCart);
  };

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    let active = true;
    if (!cart.length) {
      setValidated({
        items: [],
        totals: {
          subtotal_cents: 0,
          shipping_cents: 0,
          tax_cents: 0,
          total_cents: 0,
          currency: "ZAR",
        },
      });
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    void validateStoreCartRemote(API, cart)
      .then((data) => {
        if (!active) return;
        setValidated(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(getHttpErrorMessage(err, "Unable to validate cart."));
        setValidated(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [cart]);

  const removeLine = (productId: string) => {
    reload(removeStoreCartItem(productId));
  };

  const updateQty = (productId: string, quantity: number) => {
    reload(updateStoreCartItemQuantity(productId, quantity));
  };

  const clearCart = () => {
    clearStoreCart();
    reload([]);
  };

  if (!cart.length) {
    return (
      <section className="glass card" style={{ padding: "var(--space-5)" }}>
        <h2 className="title">Your cart is empty</h2>
        <p className="subtitle">
          Browse the marketplace and add products from any store before checking out.
        </p>
        <Link className="button" href="/marketplace">
          Visit the marketplace
        </Link>
      </section>
    );
  }

  return (
    <div className={styles.page}>
      {error ? <p className={`${styles.notice} ${styles.noticeError}`}>{error}</p> : null}

      <section className={`${styles.grid} glass card`} style={{ display: "grid", gap: 8 }}>
        {validated?.items.map((line) => (
          <article key={line.product.id} className={styles.card} style={{ gridTemplateColumns: "1fr auto", gridColumn: "1 / -1" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div className={styles.titleRow}>
                <h3>{line.product.title}</h3>
                <span className={styles.price}>{formatZarCents(line.line_total_cents, line.product.currency)}</span>
              </div>
              <div className={styles.meta}>
                <span className={styles.pill}>{line.store?.name ?? "Store"}</span>
                <span className={styles.pill}>{line.quantity} × {formatZarCents(line.unit_price_cents, "ZAR")}</span>
              </div>
              <Link className="button" href={`/store/${line.store?.slug ?? "store"}/${line.product.slug}`}>
                View product
              </Link>
            </div>
            <div className={styles.toolbar} style={{ justifySelf: "end", alignItems: "center" }}>
              <div className={styles.quantityStepper}>
                <button type="button" onClick={() => updateQty(line.product.id, line.quantity - 1)}>
                  −
                </button>
                <span>{line.quantity}</span>
                <button type="button" onClick={() => updateQty(line.product.id, line.quantity + 1)}>
                  +
                </button>
              </div>
              <button className="button" type="button" onClick={() => removeLine(line.product.id)}>
                Remove
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className={`glass card`} style={{ padding: "var(--space-4)", display: "grid", gap: 10 }}>
        <div className={styles.titleRow}>
          <h2 className="title" style={{ margin: 0, fontSize: "1.1rem" }}>
            Total
          </h2>
          <span className={styles.price}>
            {formatZarCents(validated?.totals.total_cents ?? 0, validated?.totals.currency)}
          </span>
        </div>
        <div className={styles.toolbar}>
          <Link className="button" href="/checkout">
            Proceed to checkout
          </Link>
          <button className="button" type="button" onClick={clearCart}>
            Clear cart
          </button>
          <Link className="button" href="/marketplace">
            Keep shopping
          </Link>
        </div>
        {loading ? <p className={styles.muted}>Validating cart...</p> : null}
      </section>
    </div>
  );
}
