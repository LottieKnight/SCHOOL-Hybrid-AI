"use client";

import { useEffect, useState } from "react";
import {
  clearEquipmentCart,
  formatEquipmentCurrency,
  formatEquipmentFulfillment,
  getEquipmentCart,
  getEquipmentHttpErrorMessage,
  readEquipmentQuoteReceipt,
  requestEquipmentQuote,
  storeEquipmentQuoteReceipt,
  validateEquipmentCartRemote,
  type EquipmentCartLine,
  type EquipmentCartValidation,
  type EquipmentQuoteReceipt,
} from "@/lib/equipment";
import styles from "./Equipment.module.css";
import { SectionCard } from "@/components/ui/SectionCard";
import { ActionCluster } from "@/components/ui/ActionCluster";

const API = "/api";

export function EquipmentQuoteSection() {
  const [cart, setCart] = useState<EquipmentCartLine[]>([]);
  const [validated, setValidated] = useState<EquipmentCartValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<EquipmentQuoteReceipt | null>(null);
  const [organizationName, setOrganizationName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [province, setProvince] = useState("");
  const [website, setWebsite] = useState("");

  useEffect(() => {
    setCart(getEquipmentCart());
    setReceipt(readEquipmentQuoteReceipt());
  }, []);

  useEffect(() => {
    let active = true;
    if (!cart.length) {
      setValidated({ items: [], totals: { subtotalCents: 0, totalCents: 0, currency: "ZAR" } });
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void validateEquipmentCartRemote(API, cart)
      .then((data) => {
        if (!active) return;
        setValidated(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(getEquipmentHttpErrorMessage(err, "Unable to validate equipment items for a quote request."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [cart]);

  const handleQuoteRequest = async () => {
    if (!validated?.items.length || submitting) return;
    if (!contactEmail.trim()) {
      setError("Contact email is required for quote follow-up.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await requestEquipmentQuote(API, {
        items: cart,
        requester: {
          organizationName: organizationName.trim() || null,
          contactEmail: contactEmail.trim(),
          province: province.trim() || null,
        },
        notes: { source: "shared_checkout_page" },
        website: website.trim(),
        source: "shared_checkout_page",
      });
      setReceipt(result);
      storeEquipmentQuoteReceipt(result);
      clearEquipmentCart();
      setCart([]);
      setNotice(result.message);
    } catch (err) {
      setError(getEquipmentHttpErrorMessage(err, "Unable to submit quote request."));
    } finally {
      setSubmitting(false);
    }
  };

  if (!loading && (!validated || validated.items.length === 0) && !receipt) {
    return null;
  }

  return (
    <SectionCard
      title="Equipment quote requests"
      description="Request supplier pricing and delivery estimates for equipment items. This flow does not create paid orders."
      actions={
        <ActionCluster>
          <span className={styles.muted} style={{ fontSize: "0.82rem" }}>
            We only collect minimal contact details to return your quote and delivery estimate.
          </span>
        </ActionCluster>
      }
      className={`${styles.sectionCard} glass card card-with-back`}
    >

      {notice ? <p className={`${styles.notice} ${styles.noticeSuccess}`}>{notice}</p> : null}
      {error ? <p className={`${styles.notice} ${styles.noticeError}`}>{error}</p> : null}
      {loading ? <p className={styles.status}>Preparing equipment quote request...</p> : null}

      {!loading && validated && validated.items.length > 0 ? (
        <>
          <div className={`${styles.compactForm} ${styles.filterGrid}`}>
            <label className={styles.field}>
              Organization or school (optional)
              <input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} />
            </label>
            <label className={styles.field}>
              Contact email
              <input
                type="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label className={styles.field}>
              Province (optional)
              <input value={province} onChange={(event) => setProvince(event.target.value)} />
            </label>
            <label className={styles.field} style={{ display: "none" }} aria-hidden="true">
              Website
              <input value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Fulfillment</th>
                  <th>Qty</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {validated.items.map((line) => (
                  <tr key={line.product.slug}>
                    <td>{line.product.title}</td>
                    <td>{formatEquipmentFulfillment(line.product.fulfillmentType)}</td>
                    <td>{line.quantity}</td>
                    <td>{formatEquipmentCurrency(line.lineTotalCents, line.product.currency)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3}><strong>Equipment estimate</strong></td>
                  <td><strong>{formatEquipmentCurrency(validated.totals.totalCents, validated.totals.currency)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className={styles.toolbar}>
            <button className="button" type="button" onClick={handleQuoteRequest} disabled={submitting}>
              {submitting ? "Submitting..." : "Request Quote"}
            </button>
          </div>
        </>
      ) : null}

      {receipt ? (
        <SectionCard className={styles.sectionCard} title="Latest quote request">
          <div className={styles.toolbar}>
            <strong>Latest quote request</strong>
            <span className={styles.pill}>Quote {receipt.quote.id}</span>
            <span className={styles.pill}>Status {receipt.quote.status}</span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Fulfillment</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {receipt.quote.items.map((item) => (
                  <tr key={item.slug}>
                    <td>{item.title}</td>
                    <td>{item.quantity}</td>
                    <td>{formatEquipmentFulfillment(item.fulfillmentType)}</td>
                    <td>{formatEquipmentCurrency(item.lineTotalCents, receipt.quote.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.muted} style={{ margin: "10px 0 0" }}>
            Delivery Estimate: Supplier follow-up confirms stock and lead times.
          </p>
          {receipt.quote.requester?.contactEmail ? (
            <p className={styles.muted} style={{ margin: "6px 0 0" }}>
              Quote follow-up contact: {receipt.quote.requester.contactEmail}
            </p>
          ) : null}
          <p className={styles.muted} style={{ margin: "6px 0 0" }}>
            Supplier Contact: Shared during quote follow-up once the request is reviewed.
          </p>
          {receipt.affiliateLinks?.length ? (
            <div>
              <div className={styles.muted} style={{ fontSize: "0.82rem", marginBottom: 6 }}>
                Supplier links
              </div>
              <div className={styles.toolbar}>
                {receipt.affiliateLinks.map((link) =>
                  link.url ? (
                    <a key={link.slug} className="button" href={link.url} target="_blank" rel="noopener noreferrer">
                      {link.title}
                    </a>
                  ) : (
                    <span key={link.slug} className={styles.pill}>
                      {link.title}
                    </span>
                  )
                )}
              </div>
            </div>
          ) : null}
        </SectionCard>
      ) : null}
    </SectionCard>
  );
}
