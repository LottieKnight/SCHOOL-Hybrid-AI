"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getEquipmentCart,
  getEquipmentHttpErrorMessage,
  removeEquipmentCartItem,
  updateEquipmentCartItemQuantity,
  validateEquipmentCartRemote,
  formatEquipmentCurrency,
  formatEquipmentFulfillment,
  type EquipmentCartLine,
  type EquipmentCartValidation,
} from "@/lib/equipment";
import styles from "./Equipment.module.css";
import { SectionCard } from "@/components/ui/SectionCard";
import { ActionCluster } from "@/components/ui/ActionCluster";

const API = "/api";

export function EquipmentCartSection() {
  const [cart, setCart] = useState<EquipmentCartLine[]>([]);
  const [validated, setValidated] = useState<EquipmentCartValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = (next = getEquipmentCart()) => setCart(next);

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    let active = true;
    if (!cart.length) {
      setValidated({
        items: [],
        totals: { subtotalCents: 0, totalCents: 0, currency: "ZAR" },
      });
      setLoading(false);
      setError(null);
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
        setError(getEquipmentHttpErrorMessage(err, "Unable to validate equipment cart."));
        setValidated(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [cart]);

  if (!loading && (!validated || validated.items.length === 0) && !error) {
    return null;
  }

  return (
    <SectionCard
      title="Equipment quote basket"
      description="Review equipment items here, then send a quote request from /checkout."
      actions={
        <ActionCluster>
          <Link className="button" href="/store/equipment">
            Equipment store
          </Link>
        </ActionCluster>
      }
      className={`${styles.sectionCard} glass card card-with-back`}
    >
      {error ? <p className={`${styles.notice} ${styles.noticeError}`}>{error}</p> : null}
      {loading ? <p className={styles.status}>Validating equipment cart...</p> : null}
      {!loading && validated?.items.length ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Fulfillment</th>
                <th>Qty</th>
                <th>Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {validated.items.map((line) => (
                <tr key={line.product.slug}>
                  <td>
                    <div>
                      <strong>{line.product.title}</strong>
                      <div className={styles.muted}>{line.product.isBundle ? "Bundle" : line.product.subjectTags.join(", ")}</div>
                    </div>
                  </td>
                  <td>{formatEquipmentFulfillment(line.product.fulfillmentType)}</td>
                  <td>
                    <input
                      style={{ width: 70 }}
                      type="number"
                      min={1}
                      max={20}
                      value={line.quantity}
                      onChange={(e) => reload(updateEquipmentCartItemQuantity(line.product.slug, Number(e.target.value || 1)))}
                    />
                  </td>
                  <td>{formatEquipmentCurrency(line.lineTotalCents, line.product.currency)}</td>
                  <td>
                    <button className="button" type="button" onClick={() => reload(removeEquipmentCartItem(line.product.slug))}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={3}><strong>Equipment subtotal</strong></td>
                <td><strong>{formatEquipmentCurrency(validated.totals.totalCents, validated.totals.currency)}</strong></td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
    </SectionCard>
  );
}
