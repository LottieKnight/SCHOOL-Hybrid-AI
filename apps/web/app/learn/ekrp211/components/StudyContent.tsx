'use client'

import { useMemo, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  CASE_STUDIES,
  CHAPTERS,
  CHAPTER_ARC,
  FLASHCARDS,
  MCQS,
  MODULE,
  type RiskClass,
} from '../data'

const RISK_CLASS_CSS_VARS: Record<RiskClass, string> = {
  STRATEGIC: 'var(--ekrp-strategic)',
  FINANCIAL: 'var(--ekrp-financial)',
  OPERATIONAL: 'var(--ekrp-operational)',
  COMPLIANCE: 'var(--ekrp-compliance)',
}

const RISK_CLASS_BADGE: Record<RiskClass, string> = {
  STRATEGIC: 'strategic',
  FINANCIAL: 'financial',
  OPERATIONAL: 'operational',
  COMPLIANCE: 'compliance',
}

function renderLines(text: string) {
  return text.split('\n').map((line, i) => (
    <span key={i}>
      {line}
      <br />
    </span>
  ))
}

/* ─── Overview section ────────────────────────────────────────────────────── */
function OverviewSection() {
  const panels = [
    {
      eyebrow: 'WHAT THIS MODULE DEMANDS',
      title: 'Conceptual clarity before application',
      body: 'EKRP 211 tests both definitional precision and practical application. You must define risk appetite correctly before you can identify where it failed in Steinhoff.',
      accent: 'var(--ekrp-strategic)',
    },
    {
      eyebrow: 'HOW THE EXAM WORKS',
      title: '100 marks across five sections',
      body: 'Section A: MCQ (70 marks) — theory and application. Section B: Definitions & Theory (4 marks). Section C: Corporate Governance (7 marks). Section D: ERM (5 marks). Section E: Operational Risk Management (14 marks).',
      accent: 'var(--ekrp-financial)',
    },
    {
      eyebrow: 'WHERE MARKS ARE LOST',
      title: 'Section A is 70% of your total',
      body: 'MCQs dominate — 70 marks out of 100. Sections B–E test definitions, King IV governance, COSO ERM components, and Basel operational risk. Framework references (by name and principle) are required for full marks.',
      accent: 'var(--ekrp-danger)',
    },
  ]

  return (
    <section className="ekrp211-section" id="overview">
      <div className="ekrp-card">
        <div className="ekrp211-section__label">INTELLIGENCE BRIEF</div>
        <h2 className="ekrp211-section__title">How this module reads</h2>
        <p className="ekrp211-section__sub">{MODULE.storyline}</p>

        <div className="ekrp211-overview-rail">
          {panels.map((panel) => (
            <div
              key={panel.title}
              className="ekrp211-overview-panel"
              style={{ '--panel-accent': panel.accent } as React.CSSProperties}
            >
              <div className="ekrp211-overview-panel__eyebrow">{panel.eyebrow}</div>
              <h3 className="ekrp211-overview-panel__title">{panel.title}</h3>
              <p className="ekrp211-overview-panel__body">{panel.body}</p>
            </div>
          ))}
        </div>

        {/* Chapter arc grid */}
        <div style={{ marginTop: '40px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {CHAPTER_ARC.map((arc) => (
            <a
              key={arc.id}
              href={`#chapter-${arc.id}`}
              style={{ textDecoration: 'none', display: 'block', padding: '16px', background: 'rgba(12,28,48,0.02)', border: '1px solid rgba(12,28,48,0.08)', borderTop: `3px solid ${RISK_CLASS_CSS_VARS[arc.riskClass]}`, borderRadius: '2px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontFamily: 'var(--ekrp-font-mono)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ekrp-ink-muted)' }}>
                  CH {String(arc.number).padStart(2, '0')}
                </span>
                <span className={`ekrp-risk-badge ekrp-risk-badge--${RISK_CLASS_BADGE[arc.riskClass]}`}>
                  {arc.riskClass}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--ekrp-font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--ekrp-ink)', lineHeight: 1.3 }}>
                {arc.title}
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

function buildReturnPath(pathname: string | null, searchParams: { toString: () => string } | null) {
  if (!pathname) return '/learn/ekrp211'
  const query = searchParams?.toString()
  return query ? `${pathname}?${query}` : pathname
}

/* ─── Chapter notes ────────────────────────────────────────────────────────── */
function ChapterNotes({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ 'ch1-0': true })

  function toggle(key: string) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <section className="ekrp211-section" id="chapter-notes" style={{ marginTop: '8px' }}>
      <div style={{ marginBottom: '32px' }}>
        <div className="ekrp211-section__label">FRAMEWORK FILES</div>
        <h2 className="ekrp211-section__title">Chapter-by-chapter</h2>
        <p className="ekrp211-section__sub">
          Core theory, definitional precision, and exam guidance per chapter. Each section is anchored to the exam-relevant content.
        </p>
      </div>

      <div className="ekrp211-chapter-grid">
        {CHAPTERS.map((chapter, idx) => {
          const arc = CHAPTER_ARC.find((item) => item.id === chapter.id)
          const locked = chapter.gated && !isAuthenticated
          const riskClass = arc?.riskClass ?? 'STRATEGIC'
          const accentColor = RISK_CLASS_CSS_VARS[riskClass]

          return (
            <article
              key={chapter.id}
              id={`chapter-${chapter.id}`}
              className="ekrp211-chapter-card ekrp211-section"
              style={{ '--chapter-color': accentColor } as React.CSSProperties}
            >
              <div className="ekrp211-chapter-card__header">
                <div className="ekrp211-chapter-card__meta">
                  <div className="ekrp211-chapter-card__number">
                    CHAPTER {String(chapter.number).padStart(2, '0')} · {riskClass} RISK
                  </div>
                  <h3 className="ekrp211-chapter-card__title">{chapter.title}</h3>
                  <p className="ekrp211-chapter-card__subtitle">{chapter.subtitle}</p>
                </div>
                <span className={`ekrp-risk-badge ekrp-risk-badge--${RISK_CLASS_BADGE[riskClass]}`}>
                  {riskClass}
                </span>
              </div>

              {locked ? (
                <div className="ekrp211-chapter-card__locked">
                  <div className="ekrp211-locked-bar">CHAPTER LOCKED — AUTHENTICATION REQUIRED</div>
                  <p style={{ marginTop: '24px', color: 'var(--ekrp-ink-muted)', fontSize: '0.95rem' }}>
                    Create a free account to access all chapter files.
                  </p>
                </div>
              ) : (
                <div>
                  {chapter.sections.map((section, sIdx) => {
                    const key = `${chapter.id}-${sIdx}`
                    const isOpen = openSections[key]
                    return (
                      <div key={key} className="ekrp211-accordion">
                        <button
                          type="button"
                          className="ekrp211-accordion__trigger"
                          onClick={() => toggle(key)}
                          aria-expanded={isOpen}
                        >
                          <span>{section.heading}</span>
                          <span className="ekrp211-accordion__arrow">{isOpen ? '[−]' : '[+]'}</span>
                        </button>
                        {isOpen && (
                          <div className="ekrp211-accordion__body">
                            <div className="ekrp211-accordion__content">
                              {renderLines(section.body)}
                            </div>
                            {section.examTip && (
                              <div className="ekrp211-exam-tip">
                                <span className="ekrp211-exam-tip__label">EXAM TIP</span>
                                <span className="ekrp211-exam-tip__text">{section.examTip}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

/* ─── MCQ Section ──────────────────────────────────────────────────────────── */
function MCQSection({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [score, setScore] = useState<number | null>(null)

  const visibleQs = isAuthenticated ? MCQS : MCQS.filter((q) => !q.gated)

  function select(id: string, idx: number) {
    if (revealed[id]) return
    setAnswers((prev) => ({ ...prev, [id]: idx }))
    setScore(null)
  }

  function reveal(id: string) {
    setRevealed((prev) => ({ ...prev, [id]: true }))
  }

  function calcScore() {
    let correct = 0
    for (const q of visibleQs) {
      if (answers[q.id] === q.correct) correct++
    }
    setScore(correct)
    const all: Record<string, boolean> = {}
    visibleQs.forEach((q) => { all[q.id] = true })
    setRevealed(all)
  }

  const pct = score !== null ? Math.round((score / visibleQs.length) * 100) : 0

  return (
    <section className="ekrp211-section" id="mcq" style={{ marginTop: '8px' }}>
      <div className="ekrp-card">
        <div className="ekrp211-section__label">MCQ ASSESSMENT BANK</div>
        <h2 className="ekrp211-section__title">MCQ Practice</h2>
        <p className="ekrp211-section__sub">
          {isAuthenticated
            ? `${MCQS.length} questions across all risk domains.`
            : `Preview: ${visibleQs.length} questions available. Sign up to access all ${MCQS.length}.`}
        </p>

        {score !== null && (
          <div className="ekrp211-score-panel">
            <span className="ekrp211-score-panel__label">ASSESSMENT RESULT</span>
            <div className="ekrp211-score-panel__num">{score}/{visibleQs.length}</div>
            <div
              className={`ekrp211-score-panel__verdict ekrp211-score-panel__verdict--${pct >= 70 ? 'pass' : pct >= 50 ? 'review' : 'fail'}`}
            >
              {pct >= 70 ? '● COMPETENT' : pct >= 50 ? '◐ FURTHER REVIEW REQUIRED' : '○ INSUFFICIENT — REVISIT CHAPTERS'}
            </div>
          </div>
        )}

        <div className="ekrp211-mcq-grid">
          {visibleQs.map((q, index) => {
            const answered = answers[q.id] !== undefined
            const isRevealed = revealed[q.id]

            return (
              <article key={q.id} className="ekrp211-mcq">
                <div className="ekrp211-mcq__top">
                  <span className="ekrp211-mcq__num">#{String(index + 1).padStart(2, '0')}</span>
                  <span className="ekrp211-mcq__chapter">SOURCE: {q.chapter.toUpperCase()}</span>
                </div>

                <p className="ekrp211-mcq__question">{q.question}</p>

                <div className="ekrp211-mcq__options">
                  {q.options.map((option, optIdx) => {
                    const isSelected = answers[q.id] === optIdx
                    const isCorrect = isRevealed && optIdx === q.correct
                    const isWrong = isRevealed && isSelected && optIdx !== q.correct

                    return (
                      <button
                        key={optIdx}
                        type="button"
                        className={`ekrp211-mcq__option${isCorrect ? ' ekrp211-mcq__option--correct' : isWrong ? ' ekrp211-mcq__option--wrong' : isSelected ? ' ekrp211-mcq__option--selected' : ''}`}
                        onClick={() => select(q.id, optIdx)}
                        disabled={isRevealed}
                      >
                        <span className="ekrp211-mcq__letter">{String.fromCharCode(65 + optIdx)}</span>
                        <span>{option}</span>
                      </button>
                    )
                  })}
                </div>

                {answered && !isRevealed && (
                  <button type="button" className="ekrp211-mcq__reveal-btn" onClick={() => reveal(q.id)}>
                    VERIFY ANSWER
                  </button>
                )}

                {isRevealed && (
                  <div className="ekrp211-mcq__explanation">
                    <span className="ekrp211-mcq__exp-label">RATIONALE</span>
                    <p className="ekrp211-mcq__exp-text">{q.explanation}</p>
                  </div>
                )}
              </article>
            )
          })}
        </div>

        {isAuthenticated && Object.keys(answers).length > 0 && score === null && (
          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <button
              type="button"
              className="ekrp211-hero__btn ekrp211-hero__btn--primary"
              onClick={calcScore}
              style={{ fontSize: '11px', padding: '14px 48px' }}
            >
              SUBMIT ASSESSMENT
            </button>
          </div>
        )}

        {!isAuthenticated && (
          <div style={{ marginTop: '40px', padding: '24px', background: 'rgba(12,28,48,0.03)', border: '1.5px solid rgba(12,28,48,0.12)', borderRadius: '2px', textAlign: 'center' }}>
            <p style={{ color: 'var(--ekrp-ink)', marginBottom: '16px', fontWeight: 600 }}>
              Access all {MCQS.length} questions with a free account.
            </p>
            <a href={`/auth/signup?ref=ekrp211&next=${encodeURIComponent('/learn/ekrp211')}`} className="ekrp211-hero__btn ekrp211-hero__btn--primary" style={{ display: 'inline-flex' }}>
              UNLOCK FULL MCQ BANK
            </a>
          </div>
        )}
      </div>
    </section>
  )
}

/* ─── Definitions / Flashcards ─────────────────────────────────────────────── */
function DefinitionsSection({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [filter, setFilter] = useState('all')
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  const chapters = ['all', ...Array.from(new Set(FLASHCARDS.map((f) => f.chapter)))]
  const visible = (isAuthenticated ? FLASHCARDS : FLASHCARDS.filter((f) => !f.gated)).filter(
    (f) => filter === 'all' || f.chapter === filter,
  )

  function next() { setIndex((i) => (i + 1) % visible.length); setFlipped(false) }
  function prev() { setIndex((i) => (i - 1 + visible.length) % visible.length); setFlipped(false) }
  function shuffle() { setIndex(Math.floor(Math.random() * visible.length)); setFlipped(false) }

  const card = visible[index] ?? null

  return (
    <section className="ekrp211-section" id="definitions" style={{ marginTop: '8px' }}>
      <div className="ekrp-card">
        <div className="ekrp211-section__label">DEFINITION REGISTER</div>
        <h2 className="ekrp211-section__title">Key Definitions</h2>
        <p className="ekrp211-section__sub">
          {isAuthenticated
            ? `${FLASHCARDS.length} definitions across all chapters.`
            : `Preview: ${visible.length} definitions available.`}
        </p>

        <div className="ekrp211-filters">
          {chapters.map((ch) => (
            <button
              key={ch}
              type="button"
              className={`ekrp211-filter${filter === ch ? ' ekrp211-filter--active' : ''}`}
              onClick={() => { setFilter(ch); setIndex(0); setFlipped(false) }}
            >
              {ch === 'all' ? 'ALL CHAPTERS' : ch.toUpperCase()}
            </button>
          ))}
        </div>

        {card ? (
          <>
            <div className="ekrp211-fc-counter">
              DEFINITION {String(index + 1).padStart(2, '0')} / {String(visible.length).padStart(2, '0')} — {card.chapter.toUpperCase()}
            </div>
            <div
              className={`ekrp211-fc${flipped ? ' ekrp211-fc--flipped' : ''}`}
              onClick={() => setFlipped(!flipped)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setFlipped(!flipped)}
              aria-label={flipped ? 'Show term' : 'Reveal definition'}
            >
              <div className="ekrp211-fc__inner">
                <div className="ekrp211-fc__front">
                  <span className="ekrp211-fc__side-label">TERM</span>
                  <p className="ekrp211-fc__text">{card.front}</p>
                  <span className="ekrp211-fc__chapter">{card.chapter.toUpperCase()}</span>
                  <span className="ekrp211-fc__hint">CLICK TO REVEAL</span>
                </div>
                <div className="ekrp211-fc__back">
                  <span className="ekrp211-fc__side-label">DEFINITION</span>
                  <p className="ekrp211-fc__text">{card.back}</p>
                  <span className="ekrp211-fc__chapter">{card.chapter.toUpperCase()}</span>
                  <span className="ekrp211-fc__hint">CLICK TO CLOSE</span>
                </div>
              </div>
            </div>
            <div className="ekrp211-fc-controls">
              <button type="button" className="ekrp211-fc-btn ekrp211-fc-btn--secondary" onClick={prev}>← PREV</button>
              <button type="button" className="ekrp211-fc-btn ekrp211-fc-btn--secondary" onClick={shuffle}>SHUFFLE</button>
              <button type="button" className="ekrp211-fc-btn ekrp211-fc-btn--primary" onClick={next}>NEXT →</button>
            </div>
          </>
        ) : (
          <p style={{ textAlign: 'center', color: 'var(--ekrp-ink-muted)', padding: '48px 0' }}>No definitions in this filter.</p>
        )}

        {!isAuthenticated && (
          <div style={{ marginTop: '32px', padding: '20px', background: 'rgba(12,28,48,0.03)', border: '1.5px solid rgba(12,28,48,0.12)', borderRadius: '2px', textAlign: 'center' }}>
            <p style={{ color: 'var(--ekrp-ink)', marginBottom: '14px', fontWeight: 600 }}>
              Access all {FLASHCARDS.length} definitions with a free account.
            </p>
            <a href={`/auth/signup?ref=ekrp211&next=${encodeURIComponent('/learn/ekrp211')}`} className="ekrp211-hero__btn ekrp211-hero__btn--primary" style={{ display: 'inline-flex' }}>
              UNLOCK DEFINITION REGISTER
            </a>
          </div>
        )}
      </div>
    </section>
  )
}

/* ─── Case Studies ────────────────────────────────────────────────────────── */
function CaseFilesSection({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [showAnswer, setShowAnswer] = useState<Record<string, boolean>>({})

  return (
    <section className="ekrp211-section" id="cases" style={{ marginTop: '8px' }}>
      <div className="ekrp-card">
        <div className="ekrp211-section__label">CASE FILES</div>
        <h2 className="ekrp211-section__title">Case Studies</h2>
        <p className="ekrp211-section__sub">
          Application is where marks are earned or lost. Study each scenario, attempt the questions before revealing model answers, and identify the exact framework component that failed.
        </p>

        {!isAuthenticated ? (
          <div style={{ marginTop: '32px', padding: '48px 24px', background: 'rgba(12,28,48,0.03)', border: '1.5px dashed rgba(12,28,48,0.2)', borderRadius: '2px', textAlign: 'center' }}>
            <div className="ekrp211-locked-bar" style={{ marginBottom: '24px' }}>CASE FILES — AUTHENTICATION REQUIRED</div>
            <p style={{ color: 'var(--ekrp-ink-mid)', marginBottom: '24px', maxWidth: '480px', margin: '0 auto 24px' }}>
              Full case study files — Steinhoff, General Motors, and Satyam — with scenario logs, exam-format questions, and model answers.
            </p>
            <a href={`/auth/signup?ref=ekrp211&next=${encodeURIComponent('/learn/ekrp211')}`} className="ekrp211-hero__btn ekrp211-hero__btn--primary" style={{ display: 'inline-flex' }}>
              UNLOCK CASE FILES
            </a>
          </div>
        ) : (
          <div className="ekrp211-case-grid">
            {CASE_STUDIES.map((cs, csIdx) => (
              <article key={cs.id} className="ekrp211-case">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <div>
                    <div className="ekrp211-case__number">CASE FILE {String(csIdx + 1).padStart(2, '0')} — {cs.company.toUpperCase()}</div>
                    <h3 className="ekrp211-case__title">{cs.title}</h3>
                  </div>
                  <span className={`ekrp-risk-badge ekrp-risk-badge--${RISK_CLASS_BADGE[cs.riskClass]}`}>
                    {cs.riskClass}
                  </span>
                </div>

                <div className="ekrp211-case__scenario">
                  <span className="ekrp211-case__scenario-label">SCENARIO</span>
                  <p className="ekrp211-case__scenario-text">{cs.scenario}</p>
                </div>

                <div className="ekrp211-case__questions">
                  <div style={{ fontFamily: 'var(--ekrp-font-mono)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ekrp-ink-muted)', marginBottom: '10px' }}>
                    EXAM QUESTIONS
                  </div>
                  {cs.questions.map((q, qIdx) => (
                    <div key={qIdx} className="ekrp211-case__q">
                      <p className="ekrp211-case__qtext">
                        {String(qIdx + 1).padStart(2, '0')}. {q.q}
                      </p>
                      <span className="ekrp211-case__marks">({q.marks})</span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="ekrp211-case__answer-btn"
                  onClick={() => setShowAnswer((prev) => ({ ...prev, [cs.id]: !prev[cs.id] }))}
                >
                  {showAnswer[cs.id] ? 'CLOSE MODEL ANSWER' : 'REVEAL MODEL ANSWER'}
                </button>

                {showAnswer[cs.id] && (
                  <div className="ekrp211-case__answer">
                    <span className="ekrp211-case__answer-label">MODEL ANSWER</span>
                    <div className="ekrp211-case__answer-text">{renderLines(cs.modelAnswer)}</div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/* ─── Gate prompt ─────────────────────────────────────────────────────────── */
function GatePrompt() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const returnPath = useMemo(() => buildReturnPath(pathname, searchParams), [pathname, searchParams])

  return (
    <div className="ekrp211-gate">
      <div className="ekrp211-gate__inner">
        <div className="ekrp211-gate__label">ACCESS LEVEL — PREVIEW</div>
        <h3 className="ekrp211-gate__title">Unlock the full EKRP 211 module</h3>
        <p style={{ color: 'var(--ekrp-ink-mid)', fontSize: '0.96rem', lineHeight: 1.6, margin: 0 }}>
          Free account required for chapters 3–10, all MCQs, the full definition register, and all three case study files.
        </p>
        <div className="ekrp211-gate__actions">
          <a href={`/auth/signup?ref=ekrp211&next=${encodeURIComponent(returnPath)}`} className="ekrp211-hero__btn ekrp211-hero__btn--primary">
            CREATE ACCOUNT
          </a>
          <a href={`/auth/login?ref=ekrp211&next=${encodeURIComponent(returnPath)}`} className="ekrp211-hero__btn ekrp211-hero__btn--secondary">
            SIGN IN
          </a>
        </div>
      </div>
    </div>
  )
}

/* ─── Root export ─────────────────────────────────────────────────────────── */
export function StudyContent({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <div className="ekrp211-study">
      <OverviewSection />
      <ChapterNotes isAuthenticated={isAuthenticated} />
      <MCQSection isAuthenticated={isAuthenticated} />
      <DefinitionsSection isAuthenticated={isAuthenticated} />
      <CaseFilesSection isAuthenticated={isAuthenticated} />
      {!isAuthenticated && <GatePrompt />}
    </div>
  )
}
