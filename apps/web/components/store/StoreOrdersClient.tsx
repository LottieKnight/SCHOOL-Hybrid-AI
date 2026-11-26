"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import {
  fetchStoreOrders,
  formatZarCents,
  getHttpErrorMessage,
  type StoreOrderEnvelope,
} from "@/lib/stores";
import { StateCard } from "@/components/ui/StateCard";
import styles from "./Store.module.css";

export function StoreOrdersClient() {
  const { session, loading: sessionLoading } = useSession();
  const [orders, setOrders] = useState<StoreOrderEnvelope[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    void fetchStoreOrders("/api")
      .then((data) => {
        if (!active) return;
        setOrders(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(getHttpErrorMessage(err, "Unable to load orders."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session, sessionLoading]);

  if (sessionLoading) {
    return (
      <div className={styles.page}>
        <StateCard title="Orders" description="Checking session..." />
      </div>
    );
  }

  if (!session) {
    return (
      <div className={styles.page}>
        <StateCard title="My orders" description="Sign in to view your marketplace orders.">
          <Link className="button" href="/">
            Back home
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
            <h1 className="title">My orders</h1>
            <p className="subtitle">Purchases from every store in the SCHOOL marketplace.</p>
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
      {loading ? <p className={styles.status}>Loading orders...</p> : null}

      {!loading && orders.length === 0 ? (
        <StateCard title="No orders yet" description="Place an order to see receipts and status here.">
          <Link className="button" href="/marketplace">
            Browse the marketplace
          </Link>
        </StateCard>
      ) : null}

      {!loading && orders.length > 0 ? (
        <section className={styles.list}>
          {orders.map((entry) => {
            const order = entry.order as Record<string, unknown>;
            return (
              <article key={String(order.id ?? "")} className={`${styles.listCard} glass card`}>
                <div className={styles.row}>
                  <div>
                    <h2 className="title" style={{ margin: 0, fontSize: "1rem" }}>
                      Order {String(order.id ?? "")}
                    </h2>
                    <p className="subtitle">
                      {new Date(String(order.created_at ?? "")).toLocaleString()} | Status {String(order.status ?? "")} |
                      Payment {String(order.payment_status ?? "")}
                    </p>
                  </div>
                  <div className={styles.meta}>
                    <span className={styles.pill}>
                      Total {formatZarCents(Number(order.total_cents ?? 0), String(order.currency ?? "ZAR"))}
                    </span>
                    <span className={styles.pill}>Fulfillment {String(order.fulfillment_status ?? "")}</span>
                  </div>
                </div>

                <div className={styles.lineItems}>
                  {entry.items.map((item) => {
                    const row = item as Record<string, unknown>;
                    const storeSlug = String(row.store_slug ?? "");
                    const productSlug = String(row.product_slug ?? "");
                    const productHref =
                      storeSlug && productSlug ? `/store/${storeSlug}/${productSlug}` : null;
                    return (
                      <div key={String(row.id ?? "")} className={styles.lineItem}>
                        <div>
                          <strong>{String(row.product_title ?? "")}</strong>
                          <span className={styles.muted}>
                            {" "}
                            × {String(row.quantity ?? "1")} — {formatZarCents(Number(row.line_total_cents ?? 0))}
                          </span>
                          {storeSlug ? (
                            <div className={styles.muted}>
                              Sold by {String(row.store_name ?? storeSlug)} (store {storeSlug})
                            </div>
                          ) : null}
                          {typeof row.variant_choice_json === "object" && row.variant_choice_json ? (
                            <div className={styles.muted}>
                              {Object.entries(row.variant_choice_json as Record<string, unknown>)
                                .map(([key, value]) => `${key}: ${String(value)}`)
                                .join(", ")}
                            </div>
                          ) : null}
                        </div>
                        <div className={styles.actions}>
                          {productHref ? (
                            <Link className="button" href={productHref}>
                              View product
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
