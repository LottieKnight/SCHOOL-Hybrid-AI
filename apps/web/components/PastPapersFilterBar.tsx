"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { sessionLabel } from "@/lib/pastPapers/indexing";

const GRADE_CHIPS = [
  { id: "fet", label: "10–12" },
  { id: "10", label: "10" },
  { id: "11", label: "11" },
  { id: "12", label: "12" },
  { id: "all", label: "All" },
] as const;

const SESSIONS = ["November", "May/June", "March", "September", "Other"];
const LANGUAGES = [
  { label: "English", value: "en" },
  { label: "Afrikaans", value: "af" },
];

type Props = {
  activeGrade?: string;
  activeSubject?: string;
  activeYear?: string;
  activeSession?: string;
  activeLanguage?: string;
  activeMemo?: string;
  activeQ?: string;
  subjects: string[];
  years: number[];
};

export function PastPapersFilterBar({
  activeGrade,
  activeSubject,
  activeYear,
  activeSession,
  activeLanguage,
  activeMemo,
  activeQ,
  subjects,
  years,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [draft, setDraft] = useState(activeQ ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    setDraft(activeQ ?? "");
  }, [activeQ]);

  const commit = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      params.delete("page");
      const next = params.toString();
      startTransition(() => {
        router.replace(next ? `/past-papers?${next}` : "/past-papers");
      });
    },
    [router, searchParams]
  );

  useEffect(() => {
    const next = draft.trim();
    const current = (activeQ ?? "").trim();
    if (next === current) return undefined;
    const handle = window.setTimeout(() => commit("q", next || undefined), 250);
    return () => window.clearTimeout(handle);
  }, [activeQ, commit, draft]);

  const gradeId = !activeGrade ? "fet" : activeGrade === "all" ? "all" : activeGrade;
  const extraFilters = [activeSubject, activeYear, activeSession, activeLanguage, activeMemo === "1" ? "memo" : ""].filter(Boolean).length;

  return (
    <div className="pp-toolbar">
      <div className="pp-toolbar-search">
        <label className="pp-search">
          <span className="pp-search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
              <path d="M16 16l4 4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </span>
          <input
            className="pp-search-input"
            type="search"
            inputMode="search"
            placeholder="Search papers"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label="Search past papers by subject, year, or paper"
          />
        </label>
        <button
          type="button"
          className={`pp-filter-toggle${filtersOpen || extraFilters ? " active" : ""}`}
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          Filters{extraFilters ? ` ${extraFilters}` : ""}
        </button>
      </div>

      <div className="pp-grade-row" role="group" aria-label="Grade">
        {GRADE_CHIPS.map((chip) => {
          const active = gradeId === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              className={`pp-chip${active ? " active" : ""}`}
              aria-pressed={active}
              onClick={() => {
                if (chip.id === "fet") commit("grade", undefined);
                else if (chip.id === "all") commit("grade", active ? undefined : "all");
                else commit("grade", active ? undefined : chip.id);
              }}
            >
              {chip.label}
            </button>
          );
        })}
        <button
          type="button"
          className={`pp-chip pp-chip-memo${activeMemo === "1" ? " active" : ""}`}
          aria-pressed={activeMemo === "1"}
          onClick={() => commit("hasMemo", activeMemo === "1" ? undefined : "1")}
        >
          Memo
        </button>
      </div>

      {filtersOpen ? (
        <div className="pp-drawer" role="region" aria-label="More filters">
          <label className="pp-field">
            <span>Subject</span>
            <select
              value={activeSubject ?? ""}
              onChange={(event) => commit("subject", event.target.value || undefined)}
            >
              <option value="">Any subject</option>
              {subjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </label>
          <label className="pp-field">
            <span>Year</span>
            <select value={activeYear ?? ""} onChange={(event) => commit("year", event.target.value || undefined)}>
              <option value="">Newest first</option>
              {years.map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <div className="pp-field">
            <span>Session</span>
            <div className="pp-inline-chips">
              {SESSIONS.map((session) => {
                const active = Boolean(activeSession) && (sessionLabel(activeSession) === session || activeSession === session);
                return (
                  <button
                    key={session}
                    type="button"
                    className={`pp-chip${active ? " active" : ""}`}
                    aria-pressed={active}
                    onClick={() => commit("session", active ? undefined : session)}
                  >
                    {session}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="pp-field">
            <span>Language</span>
            <div className="pp-inline-chips">
              {LANGUAGES.map((language) => {
                const active = activeLanguage === language.value || activeLanguage?.toLowerCase() === language.label.toLowerCase();
                return (
                  <button
                    key={language.value}
                    type="button"
                    className={`pp-chip${active ? " active" : ""}`}
                    aria-pressed={active}
                    onClick={() => commit("language", active ? undefined : language.value)}
                  >
                    {language.label}
                  </button>
                );
              })}
            </div>
          </div>
          {extraFilters || activeGrade || activeQ ? (
            <button type="button" className="pp-clear-btn" onClick={() => startTransition(() => router.replace("/past-papers"))}>
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
