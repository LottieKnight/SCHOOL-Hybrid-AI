"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FIELD_OPTIONS,
  PROVIDER_TYPE_LABELS,
  YEAR_LABELS,
  YEAR_OPTIONS,
  type ProviderType,
  type SortBy,
  type YearLevel,
} from "@/lib/bursary/constants";
import { getApiErrorMessage } from "@/lib/apiBase";
import {
  bursaryClient,
  type BursaryFacets,
  type BursaryMatch,
} from "@/lib/bursary/bursaryClient";
import { deadlineStatus } from "@/lib/bursary/deadline";
import { ApsCalculator } from "@/components/ApsCalculator";
import styles from "./page.module.css";

type Filters = {
  field: string;
  year: "" | YearLevel;
  providerType: "" | ProviderType;
  needsAid: boolean;
  sortBy: SortBy;
};

const INITIAL: Filters = {
  field: "",
  year: "",
  providerType: "",
  needsAid: false,
  sortBy: "match",
};

function formatAmount(min: number | null, max: number | null): string {
  const fmt = (n: number) => `R${n.toLocaleString("en-ZA")}`;
  if (min == null && max == null) return "Full cost / varies";
  if (min != null && max != null) return min === max ? fmt(min) : `${fmt(min)}–${fmt(max)}`;
  if (max != null) return `Up to ${fmt(max)}`;
  return `From ${fmt(min as number)}`;
}

function matchLabel(score: number): { text: string; tone: "strong" | "good" } | null {
  if (score >= 5) return { text: "Strong match", tone: "strong" };
  if (score >= 3) return { text: "Good match", tone: "good" };
  return null;
}

function DeadlineBadge({ deadline }: { deadline: string | null }) {
  const status = deadlineStatus(deadline);
  if (status.kind === "rolling") return <span className={styles.rolling}>Rolling · no fixed deadline</span>;
  if (status.kind === "invalid") return <span className={styles.rolling}>Deadline varies</span>;
  if (status.kind === "closed") return <span className={styles.closed}>Closed</span>;
  return (
    <span className={status.urgent ? styles.deadlineUrgent : styles.deadline}>
      Closes {status.dateText}
      {status.showCountdown ? ` · ${status.days} day${status.days === 1 ? "" : "s"} left` : ""}
    </span>
  );
}

export default function BursaryFinderPage() {
  const [filters, setFilters] = useState<Filters>(INITIAL);
  const [results, setResults] = useState<BursaryMatch[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<BursaryFacets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    bursaryClient
      .facets()
      .then(setFacets)
      .catch(() => setFacets(null));
  }, []);

  const load = useCallback(async (f: Filters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await bursaryClient.match({
        field: f.field,
        year: f.year,
        providerType: f.providerType,
        needsAid: f.needsAid,
        sortBy: f.sortBy,
        limit: 50,
      });
      setResults(data.bursaries);
      setTotal(data.total);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load bursaries."));
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filters);
  }, [filters, load]);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const hasActiveFilters = useMemo(
    () => filters.field !== "" || filters.year !== "" || filters.providerType !== "" || filters.needsAid,
    [filters]
  );

  const providerOptions = useMemo(() => {
    const list = facets?.providerTypes ?? [];
    const haveFacets = list.length > 0;
    const present = new Set(list.map((p) => p.provider_type));
    const counts = new Map(list.map((p) => [p.provider_type, p.count]));
    // When facets are unavailable (endpoint slow or failed), fall back to the full
    // static list so the provider filter never silently disappears.
    return (Object.keys(PROVIDER_TYPE_LABELS) as ProviderType[])
      .filter((pt) => !haveFacets || present.has(pt) || pt === filters.providerType)
      .map((pt) => ({ value: pt, label: PROVIDER_TYPE_LABELS[pt], count: counts.get(pt) ?? 0 }));
  }, [facets, filters.providerType]);

  return (
    <div className={styles.wrap}>
      <header className={styles.lockup}>
        <div className={styles.mark}>○ ◇ ○</div>
        <h1 className={styles.org}>Bursary Finder</h1>
        <p className={styles.tagline}>
          Funding for South African students. Tell us about you and we&apos;ll surface the bursaries
          that fit — NSFAS, SETA, corporate, government, and trusts.
        </p>
      </header>

      <ApsCalculator />

      <form className={styles.panel} aria-label="Filter bursaries" onSubmit={(e) => e.preventDefault()}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="field">Field of study</label>
          <select
            id="field"
            className={styles.select}
            value={filters.field}
            onChange={(e) => set("field", e.target.value)}
          >
            <option value="">Any field</option>
            {FIELD_OPTIONS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="year">Year of study</label>
          <select
            id="year"
            className={styles.select}
            value={filters.year}
            onChange={(e) => set("year", e.target.value as Filters["year"])}
          >
            <option value="">Any year</option>
            {YEAR_OPTIONS.map((y) => (
              <option key={y.value} value={y.value}>{y.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="provider">Provider</label>
          <select
            id="provider"
            className={styles.select}
            value={filters.providerType}
            onChange={(e) => set("providerType", e.target.value as Filters["providerType"])}
          >
            <option value="">All providers</option>
            {providerOptions.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}{p.count ? ` (${p.count})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="sort">Sort by</label>
          <select
            id="sort"
            className={styles.select}
            value={filters.sortBy}
            onChange={(e) => set("sortBy", e.target.value as SortBy)}
          >
            <option value="match">Best match</option>
            <option value="deadline">Closing soonest</option>
          </select>
        </div>

        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={filters.needsAid}
            onChange={(e) => set("needsAid", e.target.checked)}
          />
          <span>I need financial aid (prioritise needs-based bursaries)</span>
        </label>

        {hasActiveFilters && (
          <button type="button" className={styles.reset} onClick={() => setFilters(INITIAL)}>
            Reset filters
          </button>
        )}
      </form>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.resultsHead} role="status" aria-live="polite" aria-atomic="true">
        {loading ? (
          <span className={styles.muted}>Searching…</span>
        ) : (
          <span className={styles.count}>
            {total} bursar{total === 1 ? "y" : "ies"}{hasActiveFilters ? " match your filters" : " open now"}
          </span>
        )}
      </div>

      {!loading && results.length === 0 && !error && (
        <div className={styles.empty}>
          <p className={styles.muted}>No bursaries match these filters right now.</p>
          {hasActiveFilters && (
            <button type="button" className={styles.reset} onClick={() => setFilters(INITIAL)}>
              Clear filters
            </button>
          )}
        </div>
      )}

      <ul className={styles.list}>
        {results.map((b) => {
          const ml = matchLabel(b.match_score);
          return (
            <li key={b.id} className={styles.card}>
              <div className={styles.cardTop}>
                <span className={styles.providerBadge} data-provider={b.provider_type}>
                  {b.provider_type === "seta" && b.seta_name
                    ? b.seta_name
                    : PROVIDER_TYPE_LABELS[b.provider_type]}
                </span>
                {ml && <span className={styles.matchBadge} data-tone={ml.tone}>{ml.text}</span>}
              </div>

              <h2 className={styles.cardTitle}>{b.title}</h2>
              <p className={styles.provider}>{b.provider}</p>

              {b.description && <p className={styles.desc}>{b.description}</p>}

              <div className={styles.metaRow}>
                <span className={styles.amount}>{formatAmount(b.amount_min, b.amount_max)}</span>
                <DeadlineBadge deadline={b.deadline} />
              </div>

              <div className={styles.chips}>
                {b.needs_based && <span className={styles.chip}>Needs-based</span>}
                {b.merit_based && <span className={styles.chip}>Merit-based</span>}
                {b.year_levels.map((y) => (
                  <span key={y} className={styles.chipSubtle}>
                    {YEAR_LABELS[y as YearLevel] ?? y}
                  </span>
                ))}
              </div>

              {b.fields_of_study.length > 0 && (
                <p className={styles.fields}>{b.fields_of_study.join(" · ")}</p>
              )}

              {b.requirements.length > 0 && (
                <ul className={styles.reqs}>
                  {b.requirements.slice(0, 4).map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}

              <a className={styles.apply} href={b.link} target="_blank" rel="noopener noreferrer">
                Apply on the provider&apos;s site →
              </a>
            </li>
          );
        })}
      </ul>

      <p className={styles.disclaimer}>
        SCHOOL surfaces these opportunities for convenience. Always confirm eligibility, amounts, and
        deadlines on the provider&apos;s official site before applying — details can change.
      </p>
    </div>
  );
}
