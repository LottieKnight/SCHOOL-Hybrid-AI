"use client";

import { useEffect, useState } from "react";
import { fetchLocalBreakeven, formatZarCents, getHttpErrorMessage, type LocalBreakeven } from "@/lib/stores";
import styles from "./Store.module.css";

const API = "/api";

export function StoreBreakevenCard() {
  const [data, setData] = useState<LocalBreakeven | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchLocalBreakeven(API)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) setError(getHttpErrorMessage(err, "Unable to load breakeven model."));
      });
    return () => {
      active = false;
    };
  }, []);

  if (error || !data) return null;

  return (
    <section className={`${styles.breakevenCard} glass card`}>
      <h3 className="title" style={{ fontSize: "1.1rem", marginBottom: 4 }}>
        Verified local breakeven model
      </h3>
      <p className="subtitle" style={{ marginBottom: 12 }}>
        <span className={styles.breakevenNumber}>{data.breakeven_units}</span> units/mo at R
        {data.fixed.toLocaleString()} fixed costs — blended contribution R{data.blended_contrib.toFixed(2)}
        /unit (from <code>school_local.py</code>).
      </p>
      <table className={styles.ddpTable}>
        <thead>
          <tr>
            <th>Product</th>
            <th>Landed</th>
            <th>Retail</th>
            <th>Contribution</th>
            <th>GM%</th>
            <th>Breakeven units/mo</th>
          </tr>
        </thead>
        <tbody>
          {data.products.map((product) => {
            const split = data.per_product_split.find((row) => row.name === product.name);
            return (
              <tr key={product.name}>
                <td>{product.name}</td>
                <td>{formatZarCents(Math.round(product.landed * 100))}</td>
                <td>{formatZarCents(Math.round(product.retail * 100))}</td>
                <td>{formatZarCents(Math.round(product.contrib * 100))}</td>
                <td>{product.gm_pct}%</td>
                <td>{split?.units_mo ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
