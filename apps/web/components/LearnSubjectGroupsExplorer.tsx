"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useId, useState } from "react";
import type { LearnSubjectGroupCategory } from "@/lib/learnV2";
import { useLearnProgress } from "@/components/learn/useLearnProgress";
import { enumerateLessonIds } from "@/lib/lessons/schema";
import { completionFor } from "@/lib/lessons/progress";
import styles from "./LearnSubjectGroupsExplorer.module.css";

type SubjectTermPlan = {
  term: number;
  weeks: number;
};

type SubjectListItem = {
  key: string;
  name: string;
  termCount: number;
  terms?: SubjectTermPlan[];
};

type SubjectGroupItem = {
  key: string;
  name: string;
  category: LearnSubjectGroupCategory;
  subjects: SubjectListItem[];
};

type LearnSubjectGroupsExplorerProps = {
  phase: string;
  grade: string;
  gradeNumber: number;
  gradeName: string;
  groups: SubjectGroupItem[];
};

type SubjectBiasMap = Record<string, "strong" | "needs-work" | "struggling">;

function useSubjectBias(phase: string, grade: string, subjects: string[]): SubjectBiasMap {
  const [biasMap, setBiasMap] = useState<SubjectBiasMap>({});
  useEffect(() => {
    if (!subjects.length) return;
    let cancelled = false;
    async function fetchBias() {
      const results: SubjectBiasMap = {};
      await Promise.all(
        subjects.map(async (subjectKey) => {
          try {
            const gradeNum = grade.toLowerCase().startsWith("grade-")
              ? grade.replace(/grade-0*/i, "").replace(/^0+/, "") || "0"
              : grade;
            const params = new URLSearchParams({ subject: subjectKey, grade: gradeNum });
            const res = await fetch(`/api/lessons/quiz/bias?${params}`, { credentials: "include" });
            if (!res.ok || cancelled) return;
            const data = await res.json();
            const bias: number = data.bias ?? 0;
            results[subjectKey] = bias >= 1 ? "strong" : bias <= -1 ? "struggling" : "needs-work";
          } catch {
            // leave undefined — no dot shown
          }
        })
      );
      if (!cancelled) setBiasMap(results);
    }
    fetchBias();
    return () => { cancelled = true; };
  // subjects is stringified for value-equality — plain array ref changes every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, grade, JSON.stringify(subjects)]);
  return biasMap;
}

function normalize(value: string) {
  return value.toLowerCase().trim();
}

function isCoreGroup(group: Pick<SubjectGroupItem, "key" | "name" | "category">) {
  if (group.category === "core") return true;
  const value = `${group.key} ${group.name}`.toLowerCase();
  return value.includes("language") || value.includes("mathemat") || value.includes("life orientation");
}

export function LearnSubjectGroupsExplorer({
  phase,
  grade,
  gradeNumber,
  groups,
}: LearnSubjectGroupsExplorerProps) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const allSubjectKeys = groups.flatMap((g) => g.subjects.map((s) => s.key));
  const biasMap = useSubjectBias(phase, grade, allSubjectKeys);
  const { store, ready } = useLearnProgress();
  const progressBySubject = new Map<string, number>();
  if (ready) {
    for (const group of groups) {
      for (const subject of group.subjects) {
        const plans = (subject.terms ?? []).map((term) => ({
          phase,
          grade: gradeNumber,
          subjectKey: subject.key,
          term: term.term,
          weeks: term.weeks,
        }));
        if (!plans.length) continue;
        progressBySubject.set(subject.key, completionFor(store, enumerateLessonIds(plans)).percent);
      }
    }
  }
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = normalize(deferredQuery);

  const hasCore = groups.some((group) => isCoreGroup(group));
  const chips = [
    { id: "all", label: "All" },
    ...(hasCore ? [{ id: "core", label: "Core" }] : []),
    ...groups.map((group) => ({ id: group.key, label: group.name })),
  ];

  const filteredGroups = groups
    .filter((group) => {
      if (filter === "all") return true;
      if (filter === "core") return isCoreGroup(group);
      return group.key === filter;
    })
    .map((group) => ({
      ...group,
      subjects: normalizedQuery
        ? group.subjects.filter((subject) => normalize(subject.name).includes(normalizedQuery))
        : group.subjects,
    }))
    .filter((group) => group.subjects.length > 0);

  return (
    <div className={styles.wrap}>
      <label className={styles.searchLabel} htmlFor={searchId}>
        Search subjects
      </label>
      <div className={styles.searchBar}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M16.2 16.2 21 21" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <input
          id={searchId}
          className={styles.searchInput}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search subjects"
          enterKeyHint="search"
        />
        {query ? (
          <button className={styles.clearButton} type="button" onClick={() => setQuery("")}>
            Clear
          </button>
        ) : null}
      </div>

      <div className={styles.chips} role="group" aria-label="Filter subjects">
        {chips.map((chip) => {
          const selected = filter === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              className={styles.chip}
              aria-pressed={selected}
              data-active={selected ? "true" : "false"}
              onClick={() => setFilter(chip.id)}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {filteredGroups.length ? (
        <div className={styles.groupStack}>
          {filteredGroups.map((group) => (
            <section className={styles.group} key={group.key} id={`group-${group.key}`}>
              <h2 className={styles.groupTitle}>{group.name}</h2>
              <div className={styles.subjectList}>
                {group.subjects.map((subject) => {
                  const progress = progressBySubject.get(subject.key);
                  const bias = biasMap[subject.key];
                  return (
                    <Link
                      key={subject.key}
                      href={`/learn/${phase}/${grade}/${subject.key}`}
                      className={styles.subjectRow}
                      prefetch={false}
                    >
                      <span className={styles.subjectCopy}>
                        <span className={styles.subjectName}>{subject.name}</span>
                        <span className={styles.subjectMeta}>
                          {subject.termCount} terms
                          {progress ? ` · ${progress}% complete` : ""}
                        </span>
                      </span>
                      {bias ? (
                        <span
                          className={styles.biasDot}
                          data-bias={bias}
                          title={bias === "strong" ? "Performing well" : bias === "struggling" ? "Needs attention" : "In progress"}
                        />
                      ) : null}
                      <svg className={styles.subjectArrow} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <strong>No subjects match{deferredQuery.trim() ? ` “${deferredQuery.trim()}”` : ""}.</strong>
        </div>
      )}
    </div>
  );
}
