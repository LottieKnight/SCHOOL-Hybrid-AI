"use client";

import { useEffect, useState } from "react";
import { fetchDdpQuote, formatZarCents, getHttpErrorMessage, type DdpQuote } from "@/lib/stores";
import { StateCard } from "@/components/ui/StateCard";
import styles from "./Store.module.css";

const API = "/api";

type Props = {
  storeSlug: string;
  productSlug: string;
  priceCents: number;
  currency: string;
};

export function StoreDdpPanel({ storeSlug, productSlug, priceCents, currency }: Props) {
  const [quote, setQuote] = useState<DdpQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void fetchDdpQuote(API, { product: productSlug, store: storeSlug })
      .then((data) => {
        if (active) setQuote(data);
      })
      .catch((err) => {
        if (active) setError(getHttpErrorMessage(err, "Unable to load delivery pricing."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [storeSlug, productSlug]);

  if (loading) {
    return (
      <div className={`${styles.ddpBanner} glass card`}>
        <span>Checking delivered pricing…</span>
      </div>
    );
  }

  if (error || !quote) {
    return null;
  }

  if (quote.domestic) {
    return (
      <div className={`${styles.ddpBanner} glass card`}>
        <span>
          <strong>Delivered nationwide.</strong> This is a locally sourced product — the price you see
          is the delivered price. No cross-border duties or freight apply.
        </span>
      </div>
    );
  }

  return (
    <div className={`${styles.ddpBanner} glass card`} style={{ display: "block" }}>
      <span>
        <strong>Borderless delivered price.</strong> The price you pay is the full delivered price —{" "}
        {quote.priceIncludes ?? "duties and freight included"} (DDP). Your delivery is handled
        source-to-customer; the paperwork is ours, not yours.
      </span>
      {quote.markets?.length ? (
        <table className={styles.ddpTable}>
          <thead>
            <tr>
              <th>Market</th>
              <th>Landed cost</th>
              <th>Margin</th>
              <th>Verdict</th>
            </tr>
          </thead>
          <tbody>
            {quote.markets.map((market) => (
              <tr key={market.market}>
                <td>{market.market}</td>
                <td>{formatZarCents(Math.round(market.landed * 100), currency)}</td>
                <td>{formatZarCents(Math.round(market.margin * 100), currency)}</td>
                <td>
                  <span className={market.loss_lane ? styles.lossLane : styles.okLane}>
                    {market.loss_lane ? "LOSS LANE" : "OK"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
