"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useId, useState } from "react";
import type { LearnSubjectGroupCategory } from "@/lib/learnV2";
import styles from "./LearnSubjectGroupsExplorer.module.css";

type SubjectListItem = {
  key: string;
  name: string;
  termCount: number;
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

function subjectIcon(key: string, name: string): string {
  const k = key.toLowerCase();
  const n = name.toLowerCase();
  if (k.includes("math") || n.includes("math")) return "📐";
  if (k.includes("english") || n.includes("english")) return "📖";
  if (k.includes("afrikaans") || n.includes("afrikaans")) return "🗣️";
  if ((k.includes("physical") && k.includes("science")) || (n.includes("physical") && n.includes("science"))) return "⚗️";
  if (k.includes("life-science") || n.includes("life sciences") || (k.includes("life") && k.includes("sci"))) return "🔬";
  if (k.includes("geog") || n.includes("geography")) return "🌍";
  if (k.includes("hist") || n.includes("history")) return "📜";
  if (k.includes("account") || n.includes("accounting")) return "💰";
  if (k.includes("business") || n.includes("business studies")) return "💼";
  if (k.includes("econom") || n.includes("economics")) return "📈";
  if (k.includes("ems") || n.includes("economic and management")) return "📊";
  if (n.includes("computer applications") || k.includes("cat")) return "💻";
  if (k.includes("informat") || n.includes("information technology")) return "🖥️";
  if (k.includes("tourism") || n.includes("tourism")) return "✈️";
  if (k.includes("consumer") || n.includes("consumer studies") || n.includes("hospitality")) return "🍳";
  if (k.includes("visual") || n.includes("visual arts") || (k.includes("art") && !k.includes("earth"))) return "🎨";
  if (k.includes("music") || n.includes("music")) return "🎵";
  if (k.includes("drama") || n.includes("drama")) return "🎭";
  if (k.includes("life-orient") || n.includes("life orientation")) return "🌟";
  if (k.includes("natural") || n.includes("natural sciences")) return "🔭";
  if (k.includes("technolog") || n.includes("technology")) return "⚙️";
  if (k.includes("social") || n.includes("social sciences")) return "🗺️";
  if (k.includes("agricult") || n.includes("agriculture")) return "🌾";
  if (k.includes("egdn") || n.includes("engineering graphics")) return "📏";
  if (k.includes("sport") || n.includes("sport and recreation")) return "⚽";
  if (k.includes("religion") || n.includes("religion")) return "☮️";
  if (n.includes("zulu") || n.includes("xhosa") || n.includes("sotho") || n.includes("tswana") || n.includes("venda") || n.includes("tsonga") || n.includes("swati") || n.includes("ndebele") || n.includes("pedi")) return "🗣️";
  return "📚";
}

function categoryLabel(category: LearnSubjectGroupCategory) {
  if (category === "core") return "Core";
  if (category === "elective") return "Elective Group";
  return "Subject Group";
}

export function LearnSubjectGroupsExplorer({
  phase,
  grade,
  gradeName,
  groups,
}: LearnSubjectGroupsExplorerProps) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const allSubjectKeys = groups.flatMap((g) => g.subjects.map((s) => s.key));
  const biasMap = useSubjectBias(phase, grade, allSubjectKeys);
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = normalize(deferredQuery);

  const filteredGroups = groups
    .map((group) => ({
      ...group,
      subjects: normalizedQuery
        ? group.subjects.filter((subject) => normalize(subject.name).includes(normalizedQuery))
        : group.subjects,
    }))
    .filter((group) => group.subjects.length > 0);

  const totalSubjects = groups.reduce((sum, group) => sum + group.subjects.length, 0);
  const filteredCount = filteredGroups.reduce((sum, group) => sum + group.subjects.length, 0);

  return (
    <div className={styles.wrap}>
      <div className={styles.tools}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryTitle}>Subject groups</div>
          <p className="subtitle">
            Browse by group instead of one long list. Core subjects are shown first, then elective
            groups where applicable.
          </p>
          <div className={styles.metaRow}>
            <span className="pill">{groups.length} groups</span>
            <span className="pill">
              {filteredCount} / {totalSubjects} subjects
            </span>
          </div>
        </div>

        <div className={styles.searchCard}>
          <label className={styles.searchLabel} htmlFor={searchId}>
            Find a subject in {gradeName}
          </label>
          <div className={styles.searchInputWrap}>
            <span className={styles.searchIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
                <path
                  d="M16.2 16.2 21 21"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <input
              id={searchId}
              className={styles.searchInput}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search subjects (e.g. Mathematics, EMS, Tourism)"
            />
            {query ? (
              <button className={styles.clearButton} type="button" onClick={() => setQuery("")}>
                Clear
              </button>
            ) : null}
          </div>
          <p className={styles.searchHint}>
            Search across all subject groups to find a subject faster.
          </p>
        </div>
      </div>

      {groups.length > 1 ? (
        <nav className={styles.groupNav} aria-label="Subject groups">
          {groups.map((group) => (
            <a key={group.key} className={styles.groupNavChip} href={`#group-${group.key}`}>
              <span>{group.name}</span>
              <small>{group.subjects.length}</small>
            </a>
          ))}
        </nav>
      ) : null}

      {filteredGroups.length ? (
        <div className={styles.groupStack}>
          {filteredGroups.map((group) => (
            <section className={styles.groupCard} key={group.key} id={`group-${group.key}`}>
              <header className={styles.groupHeader}>
                <div>
                  <h2 className={styles.groupTitle}>{group.name}</h2>
                  <p className="subtitle">
                    {categoryLabel(group.category)} · {group.subjects.length} subjects
                  </p>
                </div>
                <div className={styles.groupBadges}>
                  <span className={styles.groupTag} data-kind={group.category}>
                    {categoryLabel(group.category)}
                  </span>
                  <span className="pill">{group.subjects.length} items</span>
                </div>
              </header>

              <div className={styles.subjectGrid}>
                {group.subjects.map((subject) => (
                  <Link
                    key={subject.key}
                    href={`/learn/${phase}/${grade}/${subject.key}`}
                    className={`list-item ${styles.subjectCard}`}
                    prefetch={false}
                  >
                    <div className={styles.subjectTop}>
                      <span className={styles.subjectEmoji} aria-hidden="true">
                        {subjectIcon(subject.key, subject.name)}
                      </span>
                      {biasMap[subject.key] && (
                        <span
                          className={styles.biasDot}
                          data-bias={biasMap[subject.key]}
                          title={
                            biasMap[subject.key] === "strong"
                              ? "Performing well"
                              : biasMap[subject.key] === "struggling"
                              ? "Needs attention"
                              : "In progress"
                          }
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <div className={styles.subjectNameRow}>
                      <div className={styles.subjectName}>{subject.name}</div>
                    </div>
                    <div className={styles.subjectMeta}>
                      <span className="badge">{subject.termCount} terms</span>
                      <span className={styles.subjectArrow} aria-hidden="true">→</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <strong>No subjects match "{deferredQuery.trim()}".</strong>
          <p className="subtitle">Try a shorter name, acronym, or a different keyword.</p>
        </div>
      )}
    </div>
  );
}
