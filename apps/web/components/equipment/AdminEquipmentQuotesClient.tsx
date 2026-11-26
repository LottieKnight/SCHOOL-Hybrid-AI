"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import {
  cleanupAdminEquipmentQuotes,
  fetchAdminEquipmentQuotes,
  formatEquipmentCurrency,
  getEquipmentHttpErrorMessage,
  updateAdminEquipmentQuoteStatus,
  type AdminEquipmentQuote,
  type EquipmentQuoteStatus,
} from "@/lib/equipment";
import styles from "./Equipment.module.css";

const API = "/api";
const STATUS_OPTIONS: Array<EquipmentQuoteStatus | "all"> = ["all", "received", "answered", "closed"];

function queryString(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

function toToDateIso(value: string) {
  if (!value) return null;
  return `${value}T23:59:59.999Z`;
}

function extractFilename(disposition: string | null) {
  if (!disposition) return null;
  const match = disposition.match(/filename="([^"]+)"/i);
  return match?.[1] || null;
}

export function AdminEquipmentQuotesClient() {
  const { session, loading: sessionLoading } = useSession();
  const [quotes, setQuotes] = useState<AdminEquipmentQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<EquipmentQuoteStatus | "all">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [retentionDays, setRetentionDays] = useState(30);
  const [cleanupDays, setCleanupDays] = useState("30");

  const canMutate = Boolean(session?.csrfToken);

  const filters = useMemo(
    () => ({
      status: statusFilter,
      from: fromDate || null,
      to: toToDateIso(toDate),
      limit: 200,
    }),
    [statusFilter, fromDate, toDate]
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminEquipmentQuotes(API, filters);
      setQuotes(data.quotes || []);
      setRetentionDays(data.retentionDays || 30);
      if (!cleanupDays) {
        setCleanupDays(String(data.retentionDays || 30));
      }
    } catch (err) {
      setError(getEquipmentHttpErrorMessage(err, "Unable to load equipment quote requests."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void fetchAdminEquipmentQuotes(API, { status: "all", limit: 200 })
      .then((data) => {
        if (!active) return;
        setQuotes(data.quotes || []);
        setRetentionDays(data.retentionDays || 30);
        setCleanupDays(String(data.retentionDays || 30));
      })
      .catch((err) => {
        if (!active) return;
        setError(getEquipmentHttpErrorMessage(err, "Unable to load equipment quote requests."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const applyFilters = async () => {
    await load();
  };

  const resetFilters = async () => {
    setStatusFilter("all");
    setFromDate("");
    setToDate("");
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminEquipmentQuotes(API, { status: "all", limit: 200 });
      setQuotes(data.quotes || []);
      setRetentionDays(data.retentionDays || 30);
      setNotice(null);
    } catch (err) {
      setError(getEquipmentHttpErrorMessage(err, "Unable to reset equipment quote filters."));
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (quoteId: string, status: EquipmentQuoteStatus) => {
    if (!session?.csrfToken) {
      setError("Missing CSRF token.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await updateAdminEquipmentQuoteStatus(API, session.csrfToken, quoteId, status);
      setQuotes((prev) => prev.map((quote) => (quote.id === quoteId ? result.quote : quote)));
      setNotice(`Quote ${quoteId} marked as ${status}.`);
    } catch (err) {
      setError(getEquipmentHttpErrorMessage(err, "Unable to update quote status."));
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `${API}/admin/equipment/quotes/export${queryString({
          status: filters.status,
          from: filters.from,
          to: filters.to,
          limit: filters.limit,
        })}`,
        {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        }
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `Export failed (HTTP ${response.status}).`);
      }

      const blob = await response.blob();
      const href = window.URL.createObjectURL(blob);
      const filename = extractFilename(response.headers.get("content-disposition")) || "equipment-quotes.csv";
      const link = document.createElement("a");
      link.href = href;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(href);
      setNotice("CSV export started.");
    } catch (err) {
      setError(getEquipmentHttpErrorMessage(err, "Unable to export equipment quotes."));
    } finally {
      setBusy(false);
    }
  };

  const runCleanup = async () => {
    if (!session?.csrfToken) {
      setError("Missing CSRF token.");
      return;
    }
    const value = Number(cleanupDays);
    if (!Number.isFinite(value) || value < 1 || value > 365) {
      setError("Cleanup days must be between 1 and 365.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await cleanupAdminEquipmentQuotes(API, session.csrfToken, Math.floor(value));
      setNotice(
        `Cleanup complete. Removed ${result.removedCount} old quotes, ${result.remainingCount} quote(s) retained.`
      );
      await load();
    } catch (err) {
      setError(getEquipmentHttpErrorMessage(err, "Unable to run quote retention cleanup."));
    } finally {
      setBusy(false);
    }
  };

  if (sessionLoading) {
    return <p className={styles.status}>Checking session...</p>;
  }

  return (
    <div className={styles.page}>
      <section className={`${styles.hero} glass card card-with-back`}>
        <div className={styles.heroTop}>
          <div>
            <h1 className="title">Equipment Quote Operations</h1>
            <p className="subtitle">
              POPIA posture: collect only organization, province, and contact email for supplier quote follow-up.
            </p>
          </div>
          <div className={styles.toolbar}>
            <span className={styles.pill}>Retention {retentionDays} days</span>
            <span className={styles.pill}>Quotes {quotes.length}</span>
          </div>
        </div>
      </section>

      {error ? <p className={`${styles.notice} ${styles.noticeError}`}>{error}</p> : null}
      {notice ? <p className={`${styles.notice} ${styles.noticeSuccess}`}>{notice}</p> : null}

      <section className={styles.sectionCard}>
        <div className={styles.toolbar}>
          <strong>Filters</strong>
        </div>
        <div className={`${styles.filterGrid} ${styles.compactForm}`}>
          <label className={styles.field}>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as EquipmentQuoteStatus | "all")}>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            From date
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </label>
          <label className={styles.field}>
            To date
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </label>
          <label className={styles.field}>
            Retention cleanup days
            <input type="number" min={1} max={365} value={cleanupDays} onChange={(event) => setCleanupDays(event.target.value)} />
          </label>
        </div>
        <div className={styles.toolbar}>
          <button className="button" type="button" disabled={busy || loading} onClick={applyFilters}>
            Apply filters
          </button>
          <button className="button" type="button" disabled={busy || loading} onClick={resetFilters}>
            Reset
          </button>
          <button className="button" type="button" disabled={busy || loading} onClick={exportCsv}>
            Export CSV
          </button>
          <button className="button" type="button" disabled={busy || loading || !canMutate} onClick={runCleanup}>
            Delete older than N days
          </button>
        </div>
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.toolbar}>
          <strong>Quote requests</strong>
          {loading ? <span className={styles.muted}>Loading...</span> : null}
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Created</th>
                <th>Quote</th>
                <th>Status</th>
                <th>Contact</th>
                <th>Total</th>
                <th>Items</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => (
                <tr key={quote.id}>
                  <td>
                    <div>{new Date(quote.createdAt).toLocaleString()}</div>
                    <div className={styles.muted}>{quote.updatedAt ? `Updated ${new Date(quote.updatedAt).toLocaleString()}` : ""}</div>
                  </td>
                  <td>
                    <div>
                      <strong>{quote.id}</strong>
                    </div>
                    <div className={styles.muted}>
                      {quote.requester.organizationName || "No organization"} / {quote.requester.province || "No province"}
                    </div>
                  </td>
                  <td>
                    <div className={styles.pill}>{quote.status}</div>
                    <div className={styles.muted}>
                      {quote.statusUpdatedBy ? `By ${quote.statusUpdatedBy}` : ""}
                    </div>
                  </td>
                  <td>{quote.requester.contactEmail || "-"}</td>
                  <td>{formatEquipmentCurrency(quote.totalCents, quote.currency)}</td>
                  <td>
                    <div>{quote.items.length} item(s)</div>
                    <div className={styles.muted}>{quote.items.map((item) => `${item.title} x${item.quantity}`).join(", ")}</div>
                  </td>
                  <td>
                    <div className={styles.toolbar}>
                      <button
                        className="button"
                        type="button"
                        disabled={busy || quote.status === "answered" || !canMutate}
                        onClick={() => updateStatus(quote.id, "answered")}
                      >
                        Mark answered
                      </button>
                      <button
                        className="button"
                        type="button"
                        disabled={busy || quote.status === "closed" || !canMutate}
                        onClick={() => updateStatus(quote.id, "closed")}
                      >
                        Mark closed
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !quotes.length ? (
                <tr>
                  <td colSpan={7} className={styles.muted}>
                    No quote requests match these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
