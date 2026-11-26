"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/apiBase";
import { formatZar } from "@/lib/formatZar";
import {
  getBookstoreCart,
  getHttpErrorMessage,
  removeBookstoreCartItem,
  updateBookstoreCartItemQuantity,
  validateBookstoreCartRemote,
  type BookstoreCartLine,
  type BookstoreCartValidation,
} from "@/lib/bookstore";
import { LicenseBadge } from "./BookstoreShared";
import { StateCard } from "@/components/ui/StateCard";
import styles from "./Bookstore.module.css";

export function BookstoreCartClient() {
  const [cart, setCart] = useState<BookstoreCartLine[]>([]);
  const [validated, setValidated] = useState<BookstoreCartValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = (nextCart = getBookstoreCart()) => {
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
    void validateBookstoreCartRemote(API_BASE, cart)
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
    reload(removeBookstoreCartItem(productId));
  };

  const updateQty = (productId: string, quantity: number) => {
    reload(updateBookstoreCartItemQuantity(productId, quantity));
  };

  return (
    <div className={styles.page}>
      <section className={`${styles.heroCard} glass card card-with-back`}>
        <div className={styles.heroTop}>
          <div>
            <h1 className="title">Cart</h1>
            <p className="subtitle">Review items, quantities, and licensing before checkout.</p>
          </div>
          <div className={styles.toolbar}>
            <Link className="button" href="/bookstore">
              Continue browsing
            </Link>
            <Link className="button" href="/orders">
              My orders
            </Link>
          </div>
        </div>
      </section>

      {error ? <p className={`${styles.notice} ${styles.noticeError}`}>{error}</p> : null}
      {loading ? <p className={styles.status}>Validating cart...</p> : null}

      {!loading && (!validated || validated.items.length === 0) ? (
        <StateCard
          title="Your cart is empty"
          description="Add a free OER download, a printable title, or a commercial textbook to start checkout."
        >
          <Link className="button" href="/bookstore">
            Open Bookstore
          </Link>
        </StateCard>
      ) : null}

      {!loading && validated && validated.items.length > 0 ? (
        <section className={styles.gridTwo}>
          <div className={styles.lineItems}>
            {validated.items.map((line) => (
              <div key={line.product.id} className={styles.lineItem}>
                <div className={styles.lineTop}>
                  <div>
                    <Link className={styles.linkLike} href={`/bookstore/${line.product.slug}`}>
                      <strong>{line.product.title}</strong>
                    </Link>
                    <div className={styles.muted}>
                      {line.product.subjects.slice(0, 2).join(", ")}
                      {line.product.subjects.length > 2 ? ` +${line.product.subjects.length - 2}` : ""}
                    </div>
                  </div>
                  <div>{line.line_total_cents === 0 ? "Free" : formatZar(line.line_total_cents, { cents: true })}</div>
                </div>

                <div className={styles.metaRow}>
                  <LicenseBadge product={line.product} />
                  <span className={styles.pill}>{line.product.fulfillment_type.replaceAll("_", " ")}</span>
                </div>

                <div className={styles.actions}>
                  <label className={styles.qtyControls}>
                    Qty
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={line.quantity}
                      onChange={(event) => updateQty(line.product.id, Number(event.target.value || 1))}
                    />
                  </label>
                  <button className="button" type="button" onClick={() => removeLine(line.product.id)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <aside className={styles.totalsCard}>
            <h2 className="title" style={{ margin: 0, fontSize: "1.15rem" }}>
              Order summary
            </h2>
            <div className={styles.totalsTable}>
              <div>
                <span>Subtotal</span>
                <strong>{formatZar(validated.totals.subtotal_cents, { cents: true })}</strong>
              </div>
              <div>
                <span>Shipping</span>
                <span>{formatZar(validated.totals.shipping_cents, { cents: true })}</span>
              </div>
              <div>
                <span>Tax</span>
                <span>{formatZar(validated.totals.tax_cents, { cents: true })}</span>
              </div>
              <div className={styles.totalsGrand}>
                <span>Total</span>
                <strong>{formatZar(validated.totals.total_cents, { cents: true })}</strong>
              </div>
            </div>
            <Link className="button" href="/checkout">
              Proceed to checkout
            </Link>
          </aside>
        </section>
      ) : null}
    </div>
  );
}
