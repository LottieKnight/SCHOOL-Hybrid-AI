"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import {
  clearStoreCart,
  confirmStoreCheckout,
  createStoreCheckout,
  formatZarCents,
  getHttpErrorMessage,
  getStoreCart,
  validateStoreCartRemote,
  type StoreCartLine,
  type StoreCartValidation,
  type StoreCheckoutResult,
} from "@/lib/stores";
import styles from "./Store.module.css";

const API = "/api";

type AddressForm = {
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  province: string;
  postalCode: string;
  phone: string;
};

export function StoreCheckoutClient() {
  const { session, loading: sessionLoading } = useSession();
  const [cart, setCart] = useState<StoreCartLine[]>([]);
  const [validated, setValidated] = useState<StoreCartValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingReturn, setConfirmingReturn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<StoreCheckoutResult | null>(null);
  const [address, setAddress] = useState<AddressForm>({
    fullName: "",
    line1: "",
    line2: "",
    city: "",
    province: "",
    postalCode: "",
    phone: "",
  });
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setCart(getStoreCart());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || sessionLoading || !session) return;
    const params = new URLSearchParams(window.location.search);
    const provider = params.get("provider");
    const orderId = params.get("orderId");
    const sessionId = params.get("session_id");
    const canceled = params.get("canceled");

    if (provider === "payfast" && canceled === "1") {
      setNotice("Payment was canceled. Your order remains pending and can be retried.");
      params.delete("canceled");
      window.history.replaceState({}, "", `${window.location.pathname}${params.toString() ? `?${params}` : ""}`);
      return;
    }

    if (!orderId) return;
    const isStripe = provider === "stripe";
    if (isStripe && !sessionId) return;

    let cancelled = false;
    setConfirmingReturn(true);
    setError(null);
    setNotice(isStripe ? "Confirming Stripe payment..." : "Checking PayFast payment status...");

    const confirmOnce = () =>
      confirmStoreCheckout(API, {
        provider: isStripe ? "stripe" : "payfast",
        orderId,
        ...(isStripe ? { sessionId: sessionId! } : {}),
      });

    void (async () => {
      try {
        let result = await confirmOnce();
        let paid = Boolean(result.payment?.paid);
        if (provider === "payfast" && !paid) {
          for (let attempt = 1; attempt <= 10; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            if (cancelled) return;
            result = await confirmOnce();
            paid = Boolean(result.payment?.paid);
            if (paid) break;
          }
        }
        const order = (result.order ?? {}) as Record<string, unknown>;
        setReceipt({
          order,
          items: (result.items ?? []) as Array<Record<string, unknown>>,
          payment: result.payment
            ? {
                provider: isStripe ? "stripe" : "payfast",
                paymentIntentId: String(result.payment.sessionId || sessionId || orderId),
                clientSecret: null,
                amountCents: Number(order.total_cents ?? 0),
                currency: String(order.currency ?? "ZAR"),
                status: String(result.payment.paymentStatus || result.payment.status || "unknown"),
                checkoutSessionId: String(result.payment.sessionId || sessionId || orderId),
                checkoutUrl: null,
                providerMetadata: result.payment as Record<string, unknown>,
              }
            : null,
          message: paid
            ? isStripe
              ? "Stripe payment confirmed. Your order is now available."
              : "PayFast payment confirmed. Your order is now available."
            : "Payment is still being confirmed by PayFast. It may take a moment — refresh to check your order status.",
        });
        clearStoreCart();
        setCart([]);
        setNotice(null);
        const next = new URLSearchParams(window.location.search);
        next.delete("provider");
        next.delete("orderId");
        next.delete("session_id");
        next.delete("canceled");
        window.history.replaceState({}, "", `${window.location.pathname}${next.toString() ? `?${next}` : ""}`);
      } catch (err) {
        setError(getHttpErrorMessage(err, isStripe ? "Unable to confirm Stripe payment." : "Unable to check PayFast payment status."));
      } finally {
        setConfirmingReturn(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, sessionLoading]);

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
        setError(getHttpErrorMessage(err, "Unable to validate cart for checkout."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [cart]);

  const isFreeCheckout = useMemo(
    () => (validated?.totals.total_cents ?? 0) <= 0,
    [validated?.totals.total_cents]
  );

  const handleSubmit = async () => {
    if (!session || !validated?.items.length || submitting) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await createStoreCheckout(API, {
        items: cart,
        csrfToken: session.csrfToken,
        address: address as unknown as Record<string, unknown>,
        notes: notes ? { customer_note: notes } : {},
      });
      if (result.payment?.checkoutUrl) {
        clearStoreCart();
        setCart([]);
        setNotice(
          result.payment.provider === "payfast"
            ? "Redirecting to PayFast checkout..."
            : "Redirecting to Stripe checkout..."
        );
        window.location.assign(result.payment.checkoutUrl);
        return;
      }
      setReceipt(result);
      clearStoreCart();
      setCart([]);
    } catch (err) {
      setError(getHttpErrorMessage(err, "Checkout failed."));
    } finally {
      setSubmitting(false);
    }
  };

  const updateAddress = (key: keyof AddressForm, value: string) =>
    setAddress((prev) => ({
      ...prev,
      [key]: value,
    }));

  if (receipt) {
    const order = receipt.order as Record<string, unknown>;
    return (
      <div className={styles.page}>
        <section className={`${styles.hero} glass card card-with-back`}>
          <h1 className="title">Checkout complete</h1>
          <p className="subtitle">{receipt.message || "Your order has been created."}</p>
          <div className={styles.meta}>
            <span className={styles.pill}>Order {String(order.id ?? "")}</span>
            <span className={styles.pill}>Status: {String(order.status ?? "")}</span>
            <span className={styles.pill}>Payment: {String(order.payment_status ?? "")}</span>
            <span className={styles.pill}>Fulfillment: {String(order.fulfillment_status ?? "")}</span>
          </div>
          {receipt.payment ? (
            receipt.payment.provider === "stripe" ? (
              <p className={`${styles.notice} ${styles.noticeSuccess}`}>
                Stripe checkout session {receipt.payment.checkoutSessionId || receipt.payment.paymentIntentId} recorded.
              </p>
            ) : receipt.payment.provider === "payfast" ? (
              <p className={`${styles.notice} ${styles.noticeSuccess}`}>
                PayFast payment reference {receipt.payment.checkoutSessionId || receipt.payment.paymentIntentId} recorded.
              </p>
            ) : (
              <p className={styles.notice}>
                Payment provider stub created an intent ({receipt.payment.paymentIntentId}).
              </p>
            )
          ) : (
            <p className={`${styles.notice} ${styles.noticeSuccess}`}>Free checkout completed without payment provider.</p>
          )}
          <div className={styles.toolbar}>
            <Link className="button" href="/orders">
              View my orders
            </Link>
            <Link className="button" href="/marketplace">
              Back to marketplace
            </Link>
          </div>
        </section>

        <section className={`glass card`} style={{ padding: "var(--space-4)", display: "grid", gap: 8 }}>
          <h2 className="title" style={{ margin: 0, fontSize: "1.1rem" }}>
            Receipt
          </h2>
          {receipt.items.map((item) => {
            const row = item as Record<string, unknown>;
            return (
              <div key={String(row.id ?? "")} className={styles.titleRow}>
                <span>{String(row.product_title ?? "")}</span>
                <span className={styles.price}>{formatZarCents(Number(row.line_total_cents ?? 0), "ZAR")}</span>
              </div>
            );
          })}
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <section className={`glass card`} style={{ padding: "var(--space-5)", display: "grid", gap: 10 }}>
        <h2 className="title">Sign in to check out</h2>
        <p className="subtitle">You need an account to place an order. Your cart is saved in this browser.</p>
      </section>
    );
  }

  if (!cart.length) {
    return (
      <section className={`glass card`} style={{ padding: "var(--space-5)", display: "grid", gap: 10 }}>
        <h2 className="title">Your cart is empty</h2>
        <p className="subtitle">Add products from any store before checking out.</p>
        <Link className="button" href="/marketplace">
          Visit the marketplace
        </Link>
      </section>
    );
  }

  return (
    <div className={styles.page}>
      <section className={`${styles.hero} glass card card-with-back`}>
        <div className={styles.heroTop}>
          <div>
            <h1 className="title">Checkout</h1>
            <p className="subtitle">Confirm your cart and place your order.</p>
          </div>
          <div className={styles.toolbar}>
            <Link className="button" href="/cart">
              Back to cart
            </Link>
            <Link className="button" href="/orders">
              My orders
            </Link>
          </div>
        </div>
      </section>

      {error ? <p className={`${styles.notice} ${styles.noticeError}`}>{error}</p> : null}
      {notice ? <p className={`${styles.notice} ${styles.noticeSuccess}`}>{notice}</p> : null}
      {confirmingReturn ? <p className={`${styles.notice} ${styles.noticeSuccess}`}>Confirming payment return...</p> : null}

      <section className={`glass card`} style={{ padding: "var(--space-4)", display: "grid", gap: 10 }}>
        <h2 className="title" style={{ margin: 0, fontSize: "1.1rem" }}>
          Your items
        </h2>
        {validated?.items.map((line) => (
          <div key={line.product.id} className={styles.titleRow}>
            <span>
              {line.product.title}{" "}
              <span className={styles.muted}>
                × {line.quantity} ({line.store?.name})
              </span>
            </span>
            <span className={styles.price}>{formatZarCents(line.line_total_cents, line.product.currency)}</span>
          </div>
        ))}
        <div className={styles.titleRow}>
          <strong>Total</strong>
          <strong className={styles.price}>
            {formatZarCents(validated?.totals.total_cents ?? 0, validated?.totals.currency)}
          </strong>
        </div>
      </section>

      <section className={`glass card`} style={{ padding: "var(--space-4)", display: "grid", gap: 10 }}>
        <h2 className="title" style={{ margin: 0, fontSize: "1.1rem" }}>
          Delivery details
        </h2>
        <div className={styles.filterGrid}>
          <label className={styles.field}>
            Full name
            <input value={address.fullName} onChange={(e) => updateAddress("fullName", e.target.value)} />
          </label>
          <label className={styles.field}>
            Phone
            <input value={address.phone} onChange={(e) => updateAddress("phone", e.target.value)} />
          </label>
          <label className={styles.field}>
            Address line 1
            <input value={address.line1} onChange={(e) => updateAddress("line1", e.target.value)} />
          </label>
          <label className={styles.field}>
            Address line 2
            <input value={address.line2} onChange={(e) => updateAddress("line2", e.target.value)} />
          </label>
          <label className={styles.field}>
            City
            <input value={address.city} onChange={(e) => updateAddress("city", e.target.value)} />
          </label>
          <label className={styles.field}>
            Province
            <input value={address.province} onChange={(e) => updateAddress("province", e.target.value)} />
          </label>
          <label className={styles.field}>
            Postal code
            <input value={address.postalCode} onChange={(e) => updateAddress("postalCode", e.target.value)} />
          </label>
          <label className={styles.field}>
            Notes
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note for the seller" />
          </label>
        </div>
      </section>

      <section className={`glass card`} style={{ padding: "var(--space-4)" }}>
        <div className={styles.toolbar}>
          <button className="button" type="button" disabled={submitting || loading} onClick={handleSubmit}>
            {submitting ? "Placing order..." : isFreeCheckout ? "Place free order" : "Place order & pay"}
          </button>
          <Link className="button" href="/cart">
            Back to cart
          </Link>
        </div>
      </section>
    </div>
  );
}
