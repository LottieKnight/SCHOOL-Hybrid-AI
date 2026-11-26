"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/lib/apiBase";
import { useSession } from "@/components/SessionProvider";
import {
  checkoutBookstore,
  clearBookstoreCart,
  confirmBookstoreCheckout,
  getBookstoreCart,
  getHttpErrorMessage,
  validateBookstoreCartRemote,
  type BookstoreCartLine,
  type BookstoreCartValidation,
  type BookstoreCheckoutResult,
} from "@/lib/bookstore";
import { OrderLineLicense } from "./BookstoreShared";
import { StateCard } from "@/components/ui/StateCard";
import styles from "./Bookstore.module.css";

type AddressForm = {
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  province: string;
  postalCode: string;
  phone: string;
};

export function BookstoreCheckoutClient() {
  const { session, loading: sessionLoading } = useSession();
  const [cart, setCart] = useState<BookstoreCartLine[]>([]);
  const [validated, setValidated] = useState<BookstoreCartValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingReturn, setConfirmingReturn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<BookstoreCheckoutResult | null>(null);
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
    setCart(getBookstoreCart());
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
      confirmBookstoreCheckout(API_BASE, {
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
        setReceipt({
          order: result.order,
          items: result.items,
          payment: result.payment
            ? {
                provider: isStripe ? "stripe" : "payfast",
                paymentIntentId: result.payment.sessionId || sessionId || orderId,
                clientSecret: null,
                amountCents: result.order.total_cents,
                currency: result.order.currency,
                status: result.payment.paymentStatus || "unknown",
                checkoutSessionId: result.payment.sessionId || sessionId || orderId,
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
        clearBookstoreCart();
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
    void validateBookstoreCartRemote(API_BASE, cart)
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

  const isFreeCheckout = useMemo(() => (validated?.totals.total_cents ?? 0) <= 0, [validated?.totals.total_cents]);

  const handleSubmit = async () => {
    if (!session || !validated?.items.length || submitting) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await checkoutBookstore(API_BASE, {
        items: cart,
        csrfToken: session.csrfToken,
        address: address,
        notes: notes ? { customer_note: notes } : {},
      });
      if (result.payment?.checkoutUrl) {
        clearBookstoreCart();
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
      clearBookstoreCart();
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
    return (
      <div className={styles.page}>
        <section className={`${styles.heroCard} glass card card-with-back`}>
          <h1 className="title">Checkout complete</h1>
          <p className="subtitle">{receipt.message || "Your order has been created."}</p>
          <div className={styles.metaRow}>
            <span className={styles.pill}>Order {receipt.order.id}</span>
            <span className={styles.pill}>Status: {receipt.order.status}</span>
            <span className={styles.pill}>Payment: {receipt.order.payment_status}</span>
            <span className={styles.pill}>Fulfillment: {receipt.order.fulfillment_status}</span>
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
                Payment provider stub created an intent ({receipt.payment.paymentIntentId}). Integrate your payment gateway
                to capture and confirm payment.
              </p>
            )
          ) : (
            <p className={`${styles.notice} ${styles.noticeSuccess}`}>Free checkout completed without payment provider.</p>
          )}
          <div className={styles.toolbar}>
            <Link className="button" href="/orders">
              View my orders
            </Link>
            <Link className="button" href="/bookstore">
              Back to bookstore
            </Link>
          </div>
        </section>

        <section className={`${styles.listCard} glass card`}>
          <h2 className="title" style={{ margin: 0, fontSize: "1.1rem" }}>
            License-aware receipt
          </h2>
          <div className={styles.lineItems}>
            {receipt.items.map((item) => (
              <OrderLineLicense key={item.id} item={item} />
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <section className={`${styles.heroCard} glass card card-with-back`}>
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

      {sessionLoading ? <p className={styles.status}>Checking session...</p> : null}
      {confirmingReturn ? <p className={styles.status}>Confirming payment return...</p> : null}
      {!sessionLoading && !session ? (
        <StateCard title="Sign in required" description="Checkout requires a signed-in account so orders and downloads can be tracked.">
          <Link className="button" href="/">
            Go home
          </Link>
        </StateCard>
      ) : null}

      {notice ? <p className={styles.notice}>{notice}</p> : null}
      {error ? <p className={`${styles.notice} ${styles.noticeError}`}>{error}</p> : null}
      {loading ? <p className={styles.status}>Preparing checkout...</p> : null}

      {!loading && session && validated && validated.items.length === 0 ? (
        <StateCard title="Your cart is empty" description="There’s nothing to check out yet.">
          <Link className="button" href="/bookstore">
            Browse the bookstore
          </Link>
        </StateCard>
      ) : null}

      {!loading && session && validated && validated.items.length > 0 ? (
        <section className={styles.gridTwo}>
          <div className={`${styles.listCard} glass card`}>
            <h2 className="title" style={{ margin: 0, fontSize: "1.05rem" }}>
              Delivery & order details
            </h2>
            <div className={styles.filterGrid}>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                Full name
                <input value={address.fullName} onChange={(e) => updateAddress("fullName", e.target.value)} />
              </label>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                Address line 1
                <input value={address.line1} onChange={(e) => updateAddress("line1", e.target.value)} />
              </label>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                Address line 2 (optional)
                <input value={address.line2} onChange={(e) => updateAddress("line2", e.target.value)} />
              </label>
              <label className={styles.field}>
                City
                <input value={address.city} onChange={(e) => updateAddress("city", e.target.value)} />
              </label>
              <label className={styles.field}>
                Province / State
                <input value={address.province} onChange={(e) => updateAddress("province", e.target.value)} />
              </label>
              <label className={styles.field}>
                Postal code
                <input value={address.postalCode} onChange={(e) => updateAddress("postalCode", e.target.value)} />
              </label>
              <label className={styles.field}>
                Phone
                <input value={address.phone} onChange={(e) => updateAddress("phone", e.target.value)} />
              </label>
              <label className={`${styles.field} ${styles.fieldFull}`}>
                Notes (optional)
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
            </div>

            <div className={styles.lineItems}>
              {validated.items.map((line) => (
                <div key={line.product.id} className={styles.lineItem}>
                  <div className={styles.lineTop}>
                    <strong>{line.product.title}</strong>
                    <span>{line.line_total_cents === 0 ? "Free" : `R${(line.line_total_cents / 100).toFixed(2)}`}</span>
                  </div>
                  <div className={styles.metaRow}>
                    <span className={styles.pill}>Qty {line.quantity}</span>
                    <span className={styles.pill}>{line.product.fulfillment_type.replaceAll("_", " ")}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className={styles.totalsCard}>
            <h2 className="title" style={{ margin: 0, fontSize: "1.1rem" }}>
              Summary
            </h2>
            <div className={styles.totalsTable}>
              <div>
                <span>Subtotal</span>
                <strong>R{(validated.totals.subtotal_cents / 100).toFixed(2)}</strong>
              </div>
              <div>
                <span>Shipping</span>
                <span>R{(validated.totals.shipping_cents / 100).toFixed(2)}</span>
              </div>
              <div>
                <span>Tax</span>
                <span>R{(validated.totals.tax_cents / 100).toFixed(2)}</span>
              </div>
              <div className={styles.totalsGrand}>
                <span>Total</span>
                <strong>R{(validated.totals.total_cents / 100).toFixed(2)}</strong>
              </div>
            </div>

            <p className={styles.muted}>
              {isFreeCheckout
                ? "Free checkout will complete immediately."
                : "Paid checkout redirects to the configured payment provider (PayFast/Stripe when enabled; stub fallback otherwise)."}
            </p>

            <button className="button" type="button" onClick={handleSubmit} disabled={submitting || sessionLoading}>
              {submitting ? "Placing order..." : isFreeCheckout ? "Complete free checkout" : "Create order & pay"}
            </button>
          </aside>
        </section>
      ) : null}
    </div>
  );
}
