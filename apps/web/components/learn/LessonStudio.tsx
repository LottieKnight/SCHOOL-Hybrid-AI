"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AudienceToggle } from "@/components/learn/AudienceToggle";
import { useLearnAudience, useLearnProgress } from "@/components/learn/useLearnProgress";
import { quickCheckFeedback, type StructuredLesson } from "@/lib/lessons/schema";
import type { InstitutionalContext, LessonLocator } from "@/lib/lessons/progress";
import styles from "./LessonStudio.module.css";

type Neighbour = { href: string; title: string } | null;

type LessonStudioProps = {
  lesson: StructuredLesson;
  href: string;
  prev: Neighbour;
  next: Neighbour;
};

function formatPhase(phase: string) {
  if (phase === "fet") return "FET";
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

function leadSummary(summary: string) {
  const first = summary.split(/\n\s*\n/)[0] || summary;
  return first.replace(/\s+/g, " ").trim();
}

export function LessonStudio({ lesson, href, prev, next }: LessonStudioProps) {
  const { store, ready, savedOnDevice, commit } = useLearnProgress();
  const { audience, setAudience } = useLearnAudience();
  const [present, setPresent] = useState(false);
  const [contextDraft, setContextDraft] = useState<InstitutionalContext>({});
  const visited = useRef(new Set<string>());
  const record = store.records[lesson.id];
  const teacher = audience === "teacher";

  const locator = useMemo<LessonLocator>(
    () => ({
      lessonId: lesson.id,
      href,
      title: lesson.title,
      subject: lesson.curriculum.subject,
      grade: lesson.curriculum.grade,
      phase: lesson.curriculum.phase,
      term: lesson.curriculum.term,
      week: lesson.curriculum.week,
      topic: lesson.curriculum.topic,
      nextHref: next?.href ?? null,
      nextTitle: next?.title ?? null,
      termWeighting: lesson.curriculum.termWeighting,
    }),
    [href, lesson, next]
  );

  useEffect(() => {
    if (!ready) return;
    const first = lesson.sections[0]?.id;
    if (!first || visited.current.has(first)) return;
    visited.current.add(first);
    commit({ type: "visit_section", lesson: locator, sectionId: first, at: new Date().toISOString() });
  }, [commit, lesson.sections, locator, ready]);

  useEffect(() => {
    if (!ready) return;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-lesson-section]"));
    if (!nodes.length || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = entry.target.getAttribute("data-lesson-section");
          if (!id || visited.current.has(id)) continue;
          visited.current.add(id);
          commit({ type: "visit_section", lesson: locator, sectionId: id, at: new Date().toISOString() });
        }
      },
      { threshold: 0.45 }
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [commit, locator, lesson.sections, ready]);

  useEffect(() => {
    if (store.context) setContextDraft(store.context);
  }, [store.context]);

  const sectionIds = lesson.sections.map((section) => section.id);
  const visitedCount = record?.sectionsVisited.length ?? 0;
  const sectionPercent = sectionIds.length ? Math.round((Math.min(visitedCount, sectionIds.length) / sectionIds.length) * 100) : 0;
  const status = record?.status ?? "not_started";

  function answerCheck(checkId: string, selected: string, correct: boolean, countsTowardScore: boolean) {
    commit({
      type: "quick_check",
      lesson: locator,
      checkId,
      selected,
      correct,
      countsTowardScore,
      at: new Date().toISOString(),
    });
  }

  function saveContext() {
    commit({ type: "set_context", context: contextDraft, at: new Date().toISOString() });
  }

  return (
    <article className={styles.studio} data-present={present ? "true" : "false"} data-audience={audience}>
      <header className={styles.header}>
        <p className={styles.kicker}>
          {formatPhase(lesson.curriculum.phase)} · Grade {lesson.curriculum.grade || "R"} · {lesson.curriculum.subject} · Term{" "}
          {lesson.curriculum.term} · Week {lesson.curriculum.week}
        </p>
        <div className={styles.titleRow}>
          <h2 className={styles.title} data-testid="lesson-title">
            {lesson.title}
          </h2>
          <AudienceToggle audience={audience} onChange={setAudience} />
        </div>
        <p className={styles.summary}>{leadSummary(lesson.summary)}</p>
        <div className={styles.meta}>
          <span className={styles.chip}>{lesson.curriculum.curriculum}</span>
          <span className={styles.chip}>{lesson.curriculum.estimatedMinutes} min</span>
          <span className={styles.chip}>{lesson.curriculum.difficulty}</span>
          {lesson.curriculum.capsTopicCode ? <span className={styles.chip}>{lesson.curriculum.capsTopicCode}</span> : null}
          <span className={styles.chip} data-testid="lesson-status">
            {status === "completed" ? "Completed" : status === "in_progress" ? "In progress" : "Not started"}
          </span>
        </div>
        <div
          className={styles.track}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={sectionPercent}
          aria-label="Lesson progress"
          data-testid="lesson-progress"
        >
          <span className={styles.fill} style={{ width: `${sectionPercent}%` }} />
        </div>
        <p className={styles.progressLabel}>
          {visitedCount}/{sectionIds.length} sections opened
          {record?.scorePercent !== null && record?.scorePercent !== undefined ? ` · Quick checks ${record.scorePercent}%` : ""}
          {savedOnDevice ? " · Saved on this device" : ""}
        </p>
      </header>

      <nav className={styles.sectionNav} aria-label="Lesson sections">
        {lesson.sections.map((section) => (
          <a key={section.id} href={`#${section.id}`}>
            {section.heading}
          </a>
        ))}
      </nav>

      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.block}>
            <h3>Learning objectives</h3>
            <ul>
              {lesson.learningObjectives.map((objective) => (
                <li key={objective}>{objective}</li>
              ))}
            </ul>
          </section>

          <section className={styles.block}>
            <h3>Key concepts</h3>
            <dl className={styles.glossary}>
              {lesson.keyConcepts.map((concept) => (
                <div key={concept.term}>
                  <dt>{concept.term}</dt>
                  <dd>{concept.definition}</dd>
                </div>
              ))}
            </dl>
          </section>

          {lesson.sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className={styles.block}
              data-kind={section.kind}
              data-lesson-section={section.id}
            >
              <h3>{section.heading}</h3>
              {section.kind === "worked_example" && section.steps?.length ? (
                <details className={styles.example} open={teacher || present ? true : undefined}>
                  <summary>Show the steps</summary>
                  <ol>
                    {section.steps.map((step) => (
                      <li key={`${section.id}-${step.prompt}`}>
                        <strong>{step.prompt}.</strong> {step.detail}
                      </li>
                    ))}
                  </ol>
                </details>
              ) : (
                <p>{section.body}</p>
              )}
            </section>
          ))}

          <section className={styles.block} data-testid="lesson-quick-checks">
            <h3>Quick checks</h3>
            <div className={styles.checks}>
              {lesson.quickChecks.map((check, index) => {
                const attempts = record?.quickCheckAttempts.filter((attempt) => attempt.checkId === check.id) ?? [];
                const latest = attempts[attempts.length - 1];
                return (
                  <fieldset key={check.id} className={styles.check} data-testid="lesson-quick-check">
                    <legend>
                      {index + 1}. {check.prompt}
                    </legend>
                    {check.kind === "mcq" ? (
                      <div className={styles.options}>
                        {check.options.map((option) => {
                          const selected = latest?.selected === option;
                          const show = Boolean(latest);
                          const right = option === check.answer;
                          return (
                            <button
                              key={option}
                              type="button"
                              className={styles.option}
                              data-testid="lesson-check-option"
                              data-selected={selected ? "true" : "false"}
                              data-result={show && selected ? (right ? "correct" : "incorrect") : undefined}
                              onClick={() => answerCheck(check.id, option, option === check.answer, true)}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={styles.option}
                        data-testid="lesson-check-option"
                        onClick={() => answerCheck(check.id, "revealed", false, false)}
                      >
                        Reveal answer
                      </button>
                    )}
                    {latest ? (
                      <p role="status" data-testid="lesson-check-feedback">
                        {quickCheckFeedback(check, latest.correct)}
                      </p>
                    ) : null}
                  </fieldset>
                );
              })}
            </div>
          </section>

          <section className={styles.block}>
            <h3>Practise this topic</h3>
            <div className={styles.actions}>
              <Link className={styles.primary} href={lesson.practice.pastPapersHref}>
                Past papers
              </Link>
              <Link className={styles.secondary} href={lesson.practice.tutorHref}>
                Tutor practice
              </Link>
              <button
                type="button"
                className={styles.primary}
                data-testid="lesson-mark-complete"
                onClick={() => commit({ type: "complete", lesson: locator, at: new Date().toISOString() })}
              >
                {status === "completed" ? "Completed" : "Mark lesson complete"}
              </button>
            </div>
          </section>

          <nav className={styles.pager} aria-label="Adjacent lessons">
            {prev ? (
              <Link href={prev.href} className={styles.secondary}>
                Previous: {prev.title}
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={next.href} className={styles.primary} data-testid="lesson-next">
                Next: {next.title}
              </Link>
            ) : null}
          </nav>
        </div>

        {teacher ? (
          <aside className={styles.teacher} data-testid="teacher-guide">
            <div className={styles.teacherHead}>
              <h3>Teacher guide</h3>
              <button type="button" className={styles.secondary} data-testid="lesson-present" onClick={() => setPresent((value) => !value)}>
                {present ? "Exit present" : "Present"}
              </button>
            </div>
            <p className={styles.kicker}>Grade → Subject → Term → Topic</p>
            <dl className={styles.glossary}>
              <div>
                <dt>Duration</dt>
                <dd>{lesson.curriculum.estimatedMinutes} minutes</dd>
              </div>
              <div>
                <dt>Difficulty</dt>
                <dd>{lesson.curriculum.difficulty}</dd>
              </div>
              {lesson.curriculum.capsTopicCode ? (
                <div>
                  <dt>CAPS topic code</dt>
                  <dd>{lesson.curriculum.capsTopicCode}</dd>
                </div>
              ) : (
                <div>
                  <dt>CAPS topic code</dt>
                  <dd>Not tagged on this outline yet.</dd>
                </div>
              )}
            </dl>
            <h4>Outcomes</h4>
            <ul>
              {lesson.curriculum.outcomes.map((outcome) => (
                <li key={outcome}>{outcome}</li>
              ))}
            </ul>
            <h4>Pacing</h4>
            <ol>
              {lesson.teacherGuide.pacing.map((step) => (
                <li key={step.label}>
                  {step.label} · {step.minutes} min
                </li>
              ))}
            </ol>
            <h4>Discussion</h4>
            <ul>
              {lesson.teacherGuide.discussionPrompts.map((prompt) => (
                <li key={prompt}>{prompt}</li>
              ))}
            </ul>
            <h4>Misconceptions</h4>
            <ul>
              {lesson.teacherGuide.misconceptions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h4>Board examples</h4>
            <ul>
              {lesson.teacherGuide.boardExamples.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {lesson.teacherGuide.notes.length ? (
              <>
                <h4>Notes</h4>
                <ul>
                  {lesson.teacherGuide.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </>
            ) : null}
            <details className={styles.example}>
              <summary>Answer key</summary>
              <ol>
                {lesson.quickChecks.map((check) => (
                  <li key={check.id}>
                    <strong>{check.prompt}</strong> {check.answer}
                  </li>
                ))}
              </ol>
            </details>
            <form
              className={styles.partnership}
              onSubmit={(event) => {
                event.preventDefault();
                saveContext();
              }}
            >
              <h4>School partnership</h4>
              <p>Optional. These fields travel with the progress export for a class or cohort.</p>
              <label>
                Institution
                <input
                  value={contextDraft.institutionId ?? ""}
                  onChange={(event) => setContextDraft((current) => ({ ...current, institutionId: event.target.value }))}
                />
              </label>
              <label>
                Class
                <input
                  value={contextDraft.classId ?? ""}
                  onChange={(event) => setContextDraft((current) => ({ ...current, classId: event.target.value }))}
                />
              </label>
              <label>
                Cohort
                <input
                  value={contextDraft.cohortId ?? ""}
                  onChange={(event) => setContextDraft((current) => ({ ...current, cohortId: event.target.value }))}
                />
              </label>
              <label>
                Curriculum standard
                <input
                  value={contextDraft.curriculumStandard ?? lesson.curriculum.curriculum}
                  onChange={(event) => setContextDraft((current) => ({ ...current, curriculumStandard: event.target.value }))}
                />
              </label>
              <label>
                Term weighting
                <input
                  inputMode="decimal"
                  value={contextDraft.termWeighting ?? ""}
                  onChange={(event) =>
                    setContextDraft((current) => ({
                      ...current,
                      termWeighting: event.target.value ? Number(event.target.value) : undefined,
                    }))
                  }
                />
              </label>
              <button type="submit" className={styles.secondary}>
                Save class context
              </button>
            </form>
          </aside>
        ) : null}
      </div>
    </article>
  );
}
