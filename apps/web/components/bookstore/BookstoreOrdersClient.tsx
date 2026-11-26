"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/apiBase";
import { useSession } from "@/components/SessionProvider";
import {
  fetchUserBookstoreOrders,
  formatZarCents,
  getHttpErrorMessage,
  prepareBookstoreDownload,
  type BookstoreOrderEnvelope,
  type BookstoreOrderItem,
} from "@/lib/bookstore";
import { OrderLineLicense } from "./BookstoreShared";
import { StateCard } from "@/components/ui/StateCard";
import styles from "./Bookstore.module.css";

type DownloadState = Record<string, boolean>;

function isOrderDownloadable(status: string) {
  return status === "paid" || status === "fulfilled";
}

export function BookstoreOrdersClient() {
  const { session, loading: sessionLoading } = useSession();
  const [orders, setOrders] = useState<BookstoreOrderEnvelope[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<DownloadState>({});

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    void fetchUserBookstoreOrders(API_BASE)
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

  const downloadKey = (orderId: string, productId: string) => `${orderId}:${productId}`;

  const handleDownload = async (orderId: string, item: BookstoreOrderItem) => {
    if (!item.product_id) return;
    const key = downloadKey(orderId, item.product_id);
    setNotice(null);
    setDownloading((prev) => ({ ...prev, [key]: true }));
    try {
      if (item.fulfillment_type === "LINK_ONLY") {
        const url = `${API_BASE}/download/${encodeURIComponent(orderId)}/${encodeURIComponent(item.product_id)}`;
        // Schedule navigation in microtask to allow state update to complete first
        queueMicrotask(() => {
          window.location.href = url;
        });
        return;
      }
      const prepared = await prepareBookstoreDownload(API_BASE, orderId, item.product_id);
      window.open(prepared.url, "_blank", "noopener,noreferrer");
      setNotice("Download link prepared.");
    } catch (err) {
      setError(getHttpErrorMessage(err, "Unable to prepare download."));
    } finally {
      setDownloading((prev) => ({ ...prev, [key]: false }));
    }
  };

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
        <StateCard title="My orders" description="Sign in to view your bookstore orders and downloads.">
          <Link className="button" href="/">
            Back home
          </Link>
        </StateCard>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <section className={`${styles.heroCard} glass card card-with-back`}>
        <div className={styles.heroTop}>
          <div>
            <h1 className="title">My orders</h1>
            <p className="subtitle">Downloads and license attributions are shown per order item.</p>
          </div>
          <div className={styles.toolbar}>
            <Link className="button" href="/bookstore">
              Bookstore
            </Link>
            <Link className="button" href="/cart">
              Cart
            </Link>
          </div>
        </div>
      </section>

      {error ? <p className={`${styles.notice} ${styles.noticeError}`}>{error}</p> : null}
      {notice ? <p className={`${styles.notice} ${styles.noticeSuccess}`}>{notice}</p> : null}
      {loading ? <p className={styles.status}>Loading orders...</p> : null}

      {!loading && orders.length === 0 ? (
        <StateCard title="No orders yet" description="Place an order to see downloads and receipts here.">
          <Link className="button" href="/bookstore">
            Browse Bookstore
          </Link>
        </StateCard>
      ) : null}

      {!loading && orders.length > 0 ? (
        <section className={styles.list}>
          {orders.map((entry) => (
            <article key={entry.order.id} className={`${styles.listCard} glass card`}>
              <div className={styles.row}>
                <div>
                  <h2 className="title" style={{ margin: 0, fontSize: "1rem" }}>
                    Order {entry.order.id}
                  </h2>
                  <p className="subtitle">
                    {new Date(entry.order.created_at).toLocaleString()} | Status {entry.order.status} | Payment{" "}
                    {entry.order.payment_status}
                  </p>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.pill}>Total {formatZarCents(entry.order.total_cents, entry.order.currency)}</span>
                  <span className={styles.pill}>Fulfillment {entry.order.fulfillment_status}</span>
                </div>
              </div>

              <div className={styles.lineItems}>
                {entry.items.map((item) => {
                  const key = item.product_id ? downloadKey(entry.order.id, item.product_id) : item.id;
                  const canDownload = Boolean(item.product_id) && isOrderDownloadable(entry.order.status);
                  return (
                    <div key={item.id} className={styles.lineItem}>
                      <OrderLineLicense item={item} />
                      <div className={styles.actions}>
                        {item.product_slug ? (
                          <Link className="button" href={`/bookstore/${item.product_slug}`}>
                            View product
                          </Link>
                        ) : null}
                        <button
                          className="button"
                          type="button"
                          onClick={() => canDownload && item.product_id && handleDownload(entry.order.id, item)}
                          disabled={!canDownload || Boolean(downloading[key])}
                        >
                          {!canDownload
                            ? "Download locked"
                            : downloading[key]
                              ? "Preparing..."
                              : item.fulfillment_type === "LINK_ONLY"
                                ? "Open resource"
                                : "Download"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}
