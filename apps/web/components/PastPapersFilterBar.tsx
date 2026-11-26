"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

const GRADES = ["R", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const YEARS = Array.from({ length: 12 }, (_, i) => String(2024 - i));
const SESSIONS = ["November", "June", "Trial", "Supplementary"];
const LANGUAGES = [{ label: "English", value: "English" }, { label: "Afrikaans", value: "Afrikaans" }];

type Props = {
  activeGrade?: string;
  activeSubject?: string;
  activeYear?: string;
  activeSession?: string;
  activeLanguage?: string;
  activeMemo?: string;
  activeQ?: string;
};

export function PastPapersFilterBar({
  activeGrade,
  activeSubject,
  activeYear,
  activeSession,
  activeLanguage,
  activeMemo,
  activeQ,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const update = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");
      startTransition(() => {
        router.replace(`/past-papers?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  const clearAll = useCallback(() => {
    startTransition(() => router.replace("/past-papers"));
  }, [router]);

  const hasFilters = !!(activeGrade || activeSubject || activeYear || activeSession || activeLanguage || activeMemo || activeQ);

  return (
    <div className="pp-filter-bar">
      <div className="pp-filter-row">
        <input
          className="pp-search-input"
          type="text"
          placeholder="Search by subject…"
          defaultValue={activeQ ?? activeSubject ?? ""}
          onChange={(e) => {
            const v = e.target.value.trim();
            const params = new URLSearchParams(searchParams.toString());
            if (v) { params.set("q", v); } else { params.delete("q"); }
            params.delete("subject");
            params.delete("page");
            startTransition(() => router.replace(`/past-papers?${params.toString()}`));
          }}
          aria-label="Search papers by subject"
        />
      </div>

      <div className="pp-filter-row pp-chips-row">
        <span className="pp-filter-label">Grade</span>
        <div className="pp-chips">
          {GRADES.map((g) => {
            const val = g === "R" ? "0" : g;
            const active = activeGrade === val;
            return (
              <button
                key={g}
                className={`pp-chip${active ? " active" : ""}`}
                onClick={() => update("grade", active ? undefined : val)}
                aria-pressed={active}
              >
                {g}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pp-filter-row pp-chips-row">
        <span className="pp-filter-label">Year</span>
        <div className="pp-chips">
          {YEARS.map((y) => {
            const active = activeYear === y;
            return (
              <button
                key={y}
                className={`pp-chip${active ? " active" : ""}`}
                onClick={() => update("year", active ? undefined : y)}
                aria-pressed={active}
              >
                {y}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pp-filter-row pp-chips-row">
        <span className="pp-filter-label">Session</span>
        <div className="pp-chips">
          {SESSIONS.map((s) => {
            const active = activeSession === s;
            return (
              <button
                key={s}
                className={`pp-chip${active ? " active" : ""}`}
                onClick={() => update("session", active ? undefined : s)}
                aria-pressed={active}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pp-filter-row pp-chips-row">
        <span className="pp-filter-label">Language</span>
        <div className="pp-chips">
          {LANGUAGES.map(({ label, value }) => {
            const active = activeLanguage === value;
            return (
              <button
                key={value}
                className={`pp-chip${active ? " active" : ""}`}
                onClick={() => update("language", active ? undefined : value)}
                aria-pressed={active}
              >
                {label}
              </button>
            );
          })}
        </div>
        <button
          className={`pp-chip pp-chip-memo${activeMemo === "1" ? " active" : ""}`}
          onClick={() => update("hasMemo", activeMemo === "1" ? undefined : "1")}
          aria-pressed={activeMemo === "1"}
        >
          ✓ Memo included
        </button>

        {hasFilters && (
          <button className="pp-clear-btn" onClick={clearAll}>
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
