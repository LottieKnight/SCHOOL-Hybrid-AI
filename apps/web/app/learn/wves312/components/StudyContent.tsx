'use client'

import { useMemo, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { CASE_STUDIES, CHAPTERS, CHAPTER_ARC, FLASHCARDS, MCQS, MODULE, THINKERS } from '../data'

function renderLines(text: string) {
  return text.split('\n').map((line, index) => (
    <span key={index}>
      {line}
      <br />
    </span>
  ))
}

function buildReturnPath(pathname: string | null, searchParams: { toString: () => string } | null) {
  if (!pathname) return '/learn/wves312'
  const query = searchParams?.toString()
  return query ? `${pathname}?${query}` : pathname
}

function BriefingPanel() {
  const panels = [
    {
      eyebrow: 'Opening move',
      title: 'Moral pressure enters the room',
      body: 'Ch 3 opens the case with responsibility, accountability, and the difference between acting legally and acting ethically.',
    },
    {
      eyebrow: 'Middle arc',
      title: 'The same scene under different lenses',
      body: 'Ch 7 to Ch 13 keep re-framing the same corporate world through theory, Ubuntu, stakeholder networks, culture, governance, and reputation.',
    },
    {
      eyebrow: 'Final cipher',
      title: 'The machine beneath the story',
      body: 'Ch 18 closes the dossier by asking what technology does to human life, judgment, and meaning.',
    },
  ]

  return (
    <section className="wves312-section" id="briefing">
      <div className="wves-sheet" style={{ '--sheet-rotation': '0.15deg' } as any}>
        <div className="wves-marginalia" style={{ 
          bottom: '-30px', 
          left: '-140px', 
          '--note-rotation': '-6deg' 
        } as any}>
          "The first lie is always the easiest."
        </div>
        <div className="wves312-opening">
          <div className="wves312-opening__copy">
            <div className="wves312-section__eyebrow" style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '11px', opacity: 0.5, color: 'var(--wves-ink)', letterSpacing: '0.15em' }}>[INTEL BRIEFING]</div>
            <h2 className="wves312-section__title" style={{ fontSize: '2.8rem', margin: '12px 0', color: 'var(--wves-ink)', fontWeight: 800 }}>How the dossier reads</h2>
            <p className="wves312-section__lede wves312-note" style={{ fontSize: '1.2rem', fontStyle: 'italic', opacity: 0.9, color: 'var(--wves-ink)' }}>{MODULE.storyline}</p>
          </div>

          <div className="wves312-opening__rail" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px', marginTop: '48px' }}>
            {panels.map((panel) => (
              <article key={panel.title} className="wves312-opening__panel" style={{ padding: '32px', border: '1px solid rgba(10, 26, 47, 0.08)', background: 'rgba(10, 26, 47, 0.02)' }}>
                <span className="wves312-opening__eyebrow" style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '10px', opacity: 0.6, color: 'var(--wves-ink)' }}>{panel.eyebrow.toUpperCase()}</span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '12px 0', color: 'var(--wves-ink)' }}>{panel.title}</h3>
                <p style={{ fontSize: '1rem', opacity: 0.85, lineHeight: 1.5 }}>{panel.body}</p>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="wves312-arc" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginTop: '40px' }}>
        {CHAPTER_ARC.map((arc, idx) => (
          <article key={arc.id} className="wves-sheet" style={{ '--sheet-rotation': `${(idx % 2 === 0 ? 0.6 : -0.6)}deg`, padding: '32px' } as any}>
            <div className="wves312-arc__top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
              <span className="wves312-arc__act" style={{ fontStyle: 'italic', opacity: 0.6, fontSize: '1.1rem', fontWeight: 600 }}>ACT {arc.act}</span>
              <span className="wves312-arc__motif" style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '9px', opacity: 0.4 }}>#{arc.motif.toUpperCase().replace(' ', '_')}</span>
            </div>
            <h3 className="wves312-arc__title" style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--wves-ink)' }}>{arc.title}</h3>
            <p className="wves312-arc__body" style={{ fontSize: '0.95rem', marginTop: '10px', opacity: 0.85, lineHeight: 1.4 }}>{arc.summary}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function ChapterNotes({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ 'ch3-0': true })

  function toggle(key: string) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <section className="wves312-section" id="chapter-notes">
      <div className="wves312-section__header" style={{ marginBottom: '56px', textAlign: 'center' }}>
        <div className="wves312-section__eyebrow" style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '11px', opacity: 0.5, color: 'var(--wves-ink)', letterSpacing: '0.15em' }}>[CHAPTER FILES]</div>
        <h2 className="wves312-section__title" style={{ fontSize: '3rem', margin: '12px 0', color: 'var(--wves-ink)', fontWeight: 800 }}>Evidence per chapter</h2>
        <p className="wves312-section__sub" style={{ maxWidth: '640px', margin: '0 auto', opacity: 0.8, fontSize: '1.1rem', color: 'var(--wves-ink)' }}>
          Foundations, lenses, networks, control systems, and public masks. Review carefully.
        </p>
      </div>

      <div className="wves312-dossier-grid">
        {CHAPTERS.map((chapter, idx) => {
          const arc = CHAPTER_ARC.find((item) => item.id === chapter.id)
          const locked = chapter.gated && !isAuthenticated

          return (
            <article key={chapter.id} className="wves-sheet" id={`chapter-${chapter.id}`} style={{ '--sheet-rotation': `${(idx % 3 === 0 ? 0.4 : -0.4)}deg` } as any}>
              <div className="wves-marginalia" style={{ 
                top: '-20px', 
                right: '-120px', 
                '--note-rotation': '4deg' 
              } as any}>
                {locked ? "[ENCRYPTED]" : `Ref: ${chapter.id.toUpperCase()}`}
              </div>
              
              <div className="wves312-dossier__header" style={{ marginBottom: '40px', borderBottom: '3px solid var(--wves-ink)', paddingBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '13px', opacity: 0.6, fontWeight: 700 }}>CHAPTER {chapter.number}</span>
                  <span style={{ fontStyle: 'italic', opacity: 0.6, fontWeight: 600 }}>{arc?.act ? `Act ${arc.act}` : ''}</span>
                </div>
                <h3 style={{ fontSize: '2.4rem', fontWeight: 900, marginTop: '12px', color: 'var(--wves-ink)' }}>{chapter.title}</h3>
                <p style={{ fontSize: '1.2rem', fontStyle: 'italic', opacity: 0.8, color: 'var(--wves-ink)' }}>{chapter.subtitle}</p>
              </div>

              {locked ? (
                <div className="wves312-dossier__locked" style={{ textAlign: 'center', padding: '56px 0' }}>
                  <div className="wves-redacted" style={{ display: 'inline-block', padding: '12px 48px', fontSize: '1.4rem', fontWeight: 800 }}>
                    CLASSIFIED DATA REDACTED
                  </div>
                  <p style={{ marginTop: '32px', opacity: 0.7, fontSize: '1.1rem' }}>Authentication required to de-redact this chapter's evidence.</p>
                </div>
              ) : (
                <div className="wves312-dossier__content">
                  {chapter.sections.map((section, sIdx) => {
                    const key = `${chapter.id}-${sIdx}`
                    const isOpen = openSections[key]
                    return (
                      <div key={key} className="wves312-dossier__section" style={{ marginBottom: '32px' }}>
                        <button
                          onClick={() => toggle(key)}
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            width: '100%', 
                            textAlign: 'left', 
                            border: 'none', 
                            background: 'transparent',
                            color: 'var(--wves-ink)',
                            fontFamily: 'inherit',
                            padding: '16px 0',
                            borderBottom: '1px solid rgba(10, 26, 47, 0.1)',
                            cursor: 'pointer'
                          }}
                        >
                          <span style={{ fontWeight: 800, fontSize: '1.4rem' }}>{section.heading}</span>
                          <span style={{ opacity: 0.5, fontWeight: 900 }}>{isOpen ? '[−]' : '[+]'}</span>
                        </button>
                        {isOpen && (
                          <div style={{ padding: '24px 0', animation: 'fadeIn 0.4s ease' }}>
                            <div className="wves312-dossier__body" style={{ fontSize: '1.15rem', lineHeight: 1.8, color: 'rgba(10, 26, 47, 0.9)' }}>
                              {renderLines(section.body)}
                            </div>
                            {section.examTip && (
                              <div style={{ 
                                marginTop: '32px', 
                                padding: '24px', 
                                background: 'rgba(142, 24, 43, 0.04)', 
                                borderLeft: '4px solid var(--wves-ink-red)', 
                                fontStyle: 'italic', 
                                fontSize: '1rem',
                                color: 'var(--wves-ink-red)',
                                position: 'relative'
                              }}>
                                <div className="wves-marginalia" style={{ top: '-15px', right: '-40px', '--note-rotation': '-2deg', color: 'var(--wves-ink-red)' } as any}>
                                  Critically important.
                                </div>
                                <strong>FIELD NOTE:</strong> {section.examTip}
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

function ThinkerFiles({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const returnPath = useMemo(() => buildReturnPath(pathname, searchParams), [pathname, searchParams])

  return (
    <section className="wves312-section" id="ch18-thinkers" style={{ marginTop: '80px' }}>
      <div className="wves-sheet" style={{ '--sheet-rotation': '-0.2deg' } as any}>
        <div className="wves-marginalia" style={{ top: '20px', right: '-120px', '--note-rotation': '6deg' } as any}>
          Witness verification active.
        </div>
        <div className="wves312-section__header" style={{ marginBottom: '48px' }}>
          <div className="wves312-section__eyebrow" style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '11px', opacity: 0.5, color: 'var(--wves-ink)' }}>[WITNESS_FILES]</div>
          <h2 className="wves312-section__title" style={{ fontSize: '2.8rem', margin: '12px 0', color: 'var(--wves-ink)', fontWeight: 800 }}>Thinkers as field witnesses</h2>
          <p className="wves312-section__sub" style={{ fontStyle: 'italic', opacity: 0.8, color: 'var(--wves-ink)', fontSize: '1.1rem' }}>
            Identify the witness, define their lens, and apply the verdict. This is the three-step move.
          </p>
        </div>

        {!isAuthenticated ? (
          <div className="wves-sheet" style={{ background: 'rgba(10, 26, 47, 0.03)', border: '2px dashed var(--wves-ink)', textAlign: 'center', padding: '56px' } as any}>
            <div className="wves-redacted" style={{ display: 'inline-block', padding: '12px 32px', fontSize: '1.3rem', fontWeight: 800 }}>REDACTED_WITNESS_PROFILES</div>
            <h3 style={{ marginTop: '32px', color: 'var(--wves-ink)', fontWeight: 800 }}>Witness testimonies are sealed</h3>
            <p style={{ opacity: 0.8, marginBottom: '32px', fontSize: '1.1rem' }}>Join free to unlock all witness profiles and their business ethics applications.</p>
            <a className="button prestigious-shine" href={`/auth/signup?ref=wves312&next=${encodeURIComponent(returnPath)}`} style={{ padding: '16px 40px' }}>
              DECRYPT WITNESS FILES
            </a>
          </div>
        ) : (
          <div className="wves312-witness-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px' }}>
            {THINKERS.map((thinker, index) => (
              <article
                key={thinker.name}
                className="wves-sheet"
                style={{ 
                  '--sheet-rotation': `${(index % 2 === 0 ? 0.5 : -0.5)}deg`,
                  padding: '40px',
                  border: '1px solid rgba(10, 26, 47, 0.08)',
                  boxShadow: '10px 10px 30px rgba(0,0,0,0.1)'
                } as any}
              >
                <div className="wves312-witness__top" style={{ marginBottom: '24px' }}>
                  <span style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '11px', opacity: 0.5, color: 'var(--wves-ink)' }}>FILE #{String(index + 1).padStart(2, '0')} {/* // */} {thinker.era.toUpperCase()}</span>
                  <h3 style={{ fontSize: '1.8rem', fontWeight: 900, margin: '8px 0', color: 'var(--wves-ink)' }}>{thinker.name}</h3>
                  <p style={{ fontStyle: 'italic', opacity: 0.8, color: 'var(--wves-ink)', fontSize: '1.1rem' }}>{thinker.concept}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setExpanded((current) => (current === thinker.name ? null : thinker.name))}
                  style={{ 
                    width: '100%', 
                    padding: '12px', 
                    background: 'transparent', 
                    border: '1.5px solid var(--wves-ink)', 
                    color: 'var(--wves-ink)',
                    fontFamily: 'var(--wves-font-mono)', 
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    letterSpacing: '0.05em'
                  }}
                >
                  {expanded === thinker.name ? 'CLOSE FILE' : 'READ TESTIMONY'}
                </button>

                {expanded === thinker.name && (
                  <div style={{ marginTop: '24px', borderTop: '2px solid rgba(10, 26, 47, 0.05)', paddingTop: '24px', animation: 'fadeIn 0.4s ease' }}>
                    <p style={{ fontSize: '1.05rem', lineHeight: 1.7, marginBottom: '24px', color: 'rgba(10, 26, 47, 0.9)' }}>{thinker.summary}</p>
                    <div style={{ padding: '20px', background: 'rgba(10, 26, 47, 0.02)', borderLeft: '4px solid var(--wves-ink)', position: 'relative' }}>
                      <div className="wves-marginalia" style={{ bottom: '-15px', right: '-30px', '--note-rotation': '-3deg', fontSize: '1.1rem' } as any}>
                        Core perspective.
                      </div>
                      <span style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '11px', opacity: 0.6, display: 'block', marginBottom: '8px', color: 'var(--wves-ink)', fontWeight: 700 }}>BUSINESS_APPLICATION</span>
                      <p style={{ fontSize: '1rem', margin: 0, color: 'var(--wves-ink)', lineHeight: 1.5 }}>{thinker.businessApplication}</p>
                    </div>
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

function MCQPractice({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [score, setScore] = useState<number | null>(null)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const returnPath = useMemo(() => buildReturnPath(pathname, searchParams), [pathname, searchParams])

  const visibleQs = isAuthenticated ? MCQS : MCQS.filter((question) => !question.gated)

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
    for (const question of visibleQs) {
      if (answers[question.id] === question.correct) correct++
    }

    setScore(correct)
    const allIds: Record<string, boolean> = {}
    visibleQs.forEach((question) => {
      allIds[question.id] = true
    })
    setRevealed(allIds)
  }

  return (
    <section className="wves312-section" id="mcq" style={{ marginTop: '80px' }}>
      <div className="wves-sheet" style={{ '--sheet-rotation': '0.2deg' } as any}>
        <div className="wves-marginalia" style={{ top: '30px', right: '-100px', '--note-rotation': '-5deg' } as any}>
          Verify every claim.
        </div>
        <div className="wves312-section__header" style={{ marginBottom: '56px' }}>
          <div className="wves312-section__eyebrow" style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '11px', opacity: 0.5, color: 'var(--wves-ink)', letterSpacing: '0.15em' }}>[INTERROGATION_SET]</div>
          <h2 className="wves312-section__title" style={{ fontSize: '3rem', margin: '12px 0', color: 'var(--wves-ink)', fontWeight: 800 }}>MCQ Cross-Examination</h2>
          <p className="wves312-section__sub" style={{ opacity: 0.8, color: 'var(--wves-ink)', fontSize: '1.1rem' }}>
            {isAuthenticated
              ? `Verification needed on ${MCQS.length} statements.`
              : `Preliminary verification: ${visibleQs.length} statements.`}
          </p>
        </div>

        {score !== null && (
          <div style={{ textAlign: 'center', marginBottom: '56px', padding: '32px', border: '3px solid var(--wves-ink)', background: 'rgba(10, 26, 47, 0.02)', position: 'relative' }}>
            <div className="wves-marginalia" style={{ top: '-25px', left: '-40px', '--note-rotation': '-8deg' } as any}>
              Verdict issued.
            </div>
            <span style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '13px', opacity: 0.6, display: 'block', color: 'var(--wves-ink)', fontWeight: 700, letterSpacing: '0.1em' }}>SCORE_REPORT</span>
            <div style={{ fontSize: '4rem', fontWeight: 900, color: 'var(--wves-ink)' }}>{score}/{visibleQs.length}</div>
            <p style={{ fontStyle: 'italic', fontWeight: 700, fontSize: '1.2rem', color: score === visibleQs.length ? 'var(--wves-signal)' : 'var(--wves-ink)' }}>
              {score === visibleQs.length ? 'VERDICT: PERFECT' : score >= visibleQs.length * 0.7 ? 'VERDICT: CONSISTENT' : 'VERDICT: INSUFFICIENT_DATA'}
            </p>
          </div>
        )}

        <div className="wves312-mcq-grid" style={{ display: 'grid', gap: '48px' }}>
          {visibleQs.map((question, index) => {
            const answered = answers[question.id] !== undefined
            const isRevealed = revealed[question.id]

            return (
              <article key={question.id} style={{ borderBottom: '2px solid rgba(10, 26, 47, 0.06)', paddingBottom: '48px' }}>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '14px', fontWeight: 900, color: 'var(--wves-ink)' }}>#{String(index + 1).padStart(2, '0')}</span>
                  <span style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '11px', opacity: 0.5, color: 'var(--wves-ink)', fontWeight: 700 }}>REF_SOURCE: {question.chapter.toUpperCase()}</span>
                </div>

                <p style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '32px', color: 'var(--wves-ink)', lineHeight: 1.3 }}>{question.question}</p>

                <div className="wves312-mcq__options" style={{ display: 'grid', gap: '12px' }}>
                  {question.options.map((option, optionIndex) => {
                    const isSelected = answers[question.id] === optionIndex
                    const isCorrect = isRevealed && optionIndex === question.correct
                    const isWrong = isRevealed && isSelected && optionIndex !== question.correct
                    
                    return (
                      <button 
                        key={optionIndex} 
                        onClick={() => select(question.id, optionIndex)}
                        style={{ 
                          display: 'flex', 
                          gap: '20px', 
                          padding: '16px 20px', 
                          background: isCorrect ? 'rgba(0, 255, 65, 0.12)' : isWrong ? 'rgba(142, 24, 43, 0.12)' : isSelected ? 'rgba(10, 26, 47, 0.08)' : 'rgba(255,255,255,0.4)', 
                          border: isCorrect ? '2px solid var(--wves-signal)' : isWrong ? '2px solid var(--wves-ink-red)' : isSelected ? '2px solid var(--wves-ink)' : '2px solid rgba(10, 26, 47, 0.08)',
                          color: 'var(--wves-ink)',
                          fontFamily: 'inherit',
                          textAlign: 'left',
                          cursor: isRevealed ? 'default' : 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <span style={{ fontFamily: 'var(--wves-font-mono)', opacity: 0.6, fontWeight: 900 }}>{String.fromCharCode(65 + optionIndex)}.</span>
                        <span style={{ fontSize: '1.05rem', fontWeight: isSelected ? 700 : 500 }}>{option}</span>
                      </button>
                    )
                  })}
                </div>

                {answered && !isRevealed && (
                  <button 
                    onClick={() => reveal(question.id)}
                    style={{ marginTop: '24px', padding: '12px 24px', background: 'var(--wves-ink)', color: 'white', border: 'none', fontFamily: 'var(--wves-font-mono)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em' }}
                  >
                    VERIFY STATEMENT
                  </button>
                )}

                {isRevealed && (
                  <div style={{ marginTop: '32px', padding: '24px', background: 'rgba(10, 26, 47, 0.02)', borderLeft: '5px solid var(--wves-ink)', animation: 'fadeIn 0.5s ease' }}>
                    <span style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '11px', opacity: 0.6, display: 'block', marginBottom: '8px', color: 'var(--wves-ink)', fontWeight: 800 }}>EXPLANATORY_INTELLIGENCE</span>
                    <p style={{ fontSize: '1.05rem', margin: 0, color: 'var(--wves-ink)', lineHeight: 1.6 }}>{question.explanation}</p>
                  </div>
                )}
              </article>
            )
          })}
        </div>

        {isAuthenticated && Object.keys(answers).length > 0 && score === null && (
          <div style={{ textAlign: 'center', marginTop: '56px' }}>
            <button className="button prestigious-shine" onClick={calcScore} style={{ padding: '18px 64px', fontSize: '1.1rem' }}>
              CALCULATE VERDICT
            </button>
          </div>
        )}

        {!isAuthenticated && (
          <div className="wves-sheet" style={{ background: 'rgba(10, 26, 47, 0.03)', border: '2px dashed var(--wves-ink)', textAlign: 'center', padding: '48px', marginTop: '56px' } as any}>
            <p style={{ opacity: 0.9, marginBottom: '24px', color: 'var(--wves-ink)', fontSize: '1.1rem', fontWeight: 600 }}>Decrypt the full interrogation set to master the Business Ethics exam loop.</p>
            <a href={`/auth/signup?ref=wves312&next=${encodeURIComponent(returnPath)}`} className="button" style={{ color: 'var(--wves-ink-red)', border: '2px solid var(--wves-ink-red)', padding: '16px 32px' }}>
              UNLOCK ALL MCQS
            </a>
          </div>
        )}
      </div>
    </section>
  )
}

function Flashcards({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [filter, setFilter] = useState('all')
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  const chapters = ['all', ...Array.from(new Set(FLASHCARDS.map((flashcard) => flashcard.chapter)))]
  const visible = (isAuthenticated ? FLASHCARDS : FLASHCARDS.filter((flashcard) => !flashcard.gated)).filter(
    (flashcard) => filter === 'all' || flashcard.chapter === filter,
  )

  function next() {
    setIndex((current) => (current + 1) % visible.length)
    setFlipped(false)
  }

  function prev() {
    setIndex((current) => (current - 1 + visible.length) % visible.length)
    setFlipped(false)
  }

  function shuffle() {
    setIndex(Math.floor(Math.random() * visible.length))
    setFlipped(false)
  }

  const card = visible[index] ?? null

  return (
    <section className="wves312-section" id="flashcards" style={{ marginTop: '80px' }}>
      <div className="wves-sheet" style={{ '--sheet-rotation': '-0.15deg' } as any}>
        <div className="wves-marginalia" style={{ top: '40px', left: '-120px', '--note-rotation': '6deg' } as any}>
          Cipher fragments.
        </div>
        <div className="wves312-section__header" style={{ marginBottom: '48px' }}>
          <div className="wves312-section__eyebrow" style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '11px', opacity: 0.5, color: 'var(--wves-ink)', letterSpacing: '0.15em' }}>[CIPHER_DECK]</div>
          <h2 className="wves312-section__title" style={{ fontSize: '3rem', margin: '12px 0', color: 'var(--wves-ink)', fontWeight: 800 }}>Flashcards as decoded fragments</h2>
          <p className="wves312-section__sub" style={{ opacity: 0.8, color: 'var(--wves-ink)', fontSize: '1.1rem' }}>
            {isAuthenticated
              ? `Reviewing ${FLASHCARDS.length} cipher fragments.`
              : `Preview: ${visible.length} cipher fragments available.`}
          </p>
        </div>

        <div className="wves312-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '48px' }}>
          {chapters.map((chapter) => (
            <button
              key={chapter}
              onClick={() => { setFilter(chapter); setIndex(0); setFlipped(false); }}
              style={{ 
                padding: '8px 16px', 
                background: filter === chapter ? 'var(--wves-ink)' : 'transparent', 
                color: filter === chapter ? 'white' : 'var(--wves-ink)',
                border: '1.5px solid var(--wves-ink)',
                fontFamily: 'var(--wves-font-mono)',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {chapter.toUpperCase()}
            </button>
          ))}
        </div>

        {card ? (
          <div style={{ maxWidth: '440px', margin: '0 auto' }}>
            <div style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '12px', opacity: 0.5, textAlign: 'center', marginBottom: '16px', color: 'var(--wves-ink)', fontWeight: 700 }}>
              FRAGMENT {String(index + 1).padStart(2, '0')} / {String(visible.length).padStart(2, '0')} {/* // */} REF_SEC: {card.chapter.toUpperCase()}
            </div>
            <div 
              onClick={() => setFlipped(!flipped)}
              style={{ 
                height: '280px', 
                background: 'white', 
                border: '1px solid rgba(10, 26, 47, 0.15)', 
                boxShadow: '8px 8px 0 rgba(10, 26, 47, 0.05), inset 0 0 40px rgba(0,0,0,0.02)',
                padding: '48px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                textAlign: 'center',
                cursor: 'pointer',
                position: 'relative',
                transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
              }}
            >
              <div className="wves-marginalia" style={{ top: '15px', left: '15px', fontSize: '1rem', opacity: 0.5, color: 'var(--wves-ink)' }}>{flipped ? "[REVEALED]" : "[CIPHER]"}</div>
              <p style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--wves-ink)', lineHeight: 1.3 }}>{flipped ? card.back : card.front}</p>
              <div style={{ position: 'absolute', bottom: '20px', width: 'calc(100% - 96px)', textAlign: 'center', fontFamily: 'var(--wves-font-mono)', fontSize: '10px', opacity: 0.4, color: 'var(--wves-ink)', fontWeight: 700 }}>
                TAP_TO_DECRYPT
              </div>
            </div>
            <div className="wves312-fc-controls" style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '40px' }}>
              <button className="button" onClick={prev} style={{ padding: '12px 24px', fontSize: '12px' }}>← PREV</button>
              <button className="button" onClick={shuffle} style={{ padding: '12px 24px', fontSize: '12px', background: 'transparent', border: '1.5px solid var(--wves-ink)', color: 'var(--wves-ink)' }}>SHUFFLE</button>
              <button className="button" onClick={next} style={{ padding: '12px 24px', fontSize: '12px' }}>NEXT →</button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '64px', opacity: 0.6, color: 'var(--wves-ink)', fontSize: '1.2rem', fontWeight: 700 }}>NO DECODED FRAGMENTS IN THIS SECTOR</div>
        )}
      </div>
    </section>
  )
}

function CaseStudies({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [showAnswer, setShowAnswer] = useState<Record<string, boolean>>({})
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const returnPath = useMemo(() => buildReturnPath(pathname, searchParams), [pathname, searchParams])

  return (
    <section className="wves312-section" id="cases" style={{ marginTop: '80px' }}>
      <div className="wves-sheet" style={{ '--sheet-rotation': '0.1deg' } as any}>
        <div className="wves-marginalia" style={{ bottom: '20px', left: '-130px', '--note-rotation': '-4deg' } as any}>
          Real-world evidence.
        </div>
        <div className="wves312-section__header" style={{ marginBottom: '56px' }}>
          <div className="wves312-section__eyebrow" style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '11px', opacity: 0.5, color: 'var(--wves-ink)', letterSpacing: '0.15em' }}>[INCIDENT_REPORTS]</div>
          <h2 className="wves312-section__title" style={{ fontSize: '3rem', margin: '12px 0', color: 'var(--wves-ink)', fontWeight: 800 }}>Case Studies as Field Evidence</h2>
          <p className="wves312-section__sub" style={{ opacity: 0.8, color: 'var(--wves-ink)', fontSize: '1.1rem' }}>The final verdict depends on application. Map the theory to the facts.</p>
        </div>

        {!isAuthenticated ? (
          <div className="wves-sheet" style={{ background: 'rgba(10, 26, 47, 0.03)', border: '2px dashed var(--wves-ink)', textAlign: 'center', padding: '56px' } as any}>
            <div className="wves-redacted" style={{ display: 'inline-block', padding: '12px 32px', fontSize: '1.3rem', fontWeight: 800 }}>REDACTED_FIELD_REPORTS</div>
            <h3 style={{ marginTop: '32px', color: 'var(--wves-ink)', fontWeight: 800 }}>Incident reports are sealed</h3>
            <p style={{ opacity: 0.8, marginBottom: '32px', fontSize: '1.1rem' }}>Join free to open the full incident reports with model answers and marking criteria.</p>
            <a href={`/auth/signup?ref=wves312&next=${encodeURIComponent(returnPath)}`} className="button prestigious-shine" style={{ padding: '16px 40px' }}>
              DECRYPT INCIDENT REPORTS
            </a>
          </div>
        ) : (
          <div className="wves312-case-grid" style={{ display: 'grid', gap: '64px' }}>
            {CASE_STUDIES.map((caseStudy) => (
              <article key={caseStudy.id} style={{ borderBottom: '3px solid var(--wves-ink)', paddingBottom: '64px' }}>
                <div style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '13px', opacity: 0.6, marginBottom: '16px', color: 'var(--wves-ink)', fontWeight: 800 }}>REPORT_REF: {caseStudy.id.toUpperCase()}</div>
                <h3 style={{ fontSize: '2.2rem', fontWeight: 900, marginBottom: '24px', color: 'var(--wves-ink)' }}>{caseStudy.title}</h3>
                
                <div style={{ background: 'rgba(10, 26, 47, 0.02)', padding: '32px', borderLeft: '6px solid var(--wves-ink)', marginBottom: '40px' }}>
                  <span style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '11px', opacity: 0.6, display: 'block', marginBottom: '16px', color: 'var(--wves-ink)', fontWeight: 700 }}>SCENARIO_LOG</span>
                  <p style={{ fontSize: '1.1rem', lineHeight: 1.7, margin: 0, color: 'var(--wves-ink)' }}>{caseStudy.scenario}</p>
                </div>

                <div className="wves312-case__questions" style={{ marginBottom: '32px' }}>
                  <span style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '11px', opacity: 0.6, display: 'block', marginBottom: '20px', color: 'var(--wves-ink)', fontWeight: 700 }}>INTERROGATION_GOALS</span>
                  {caseStudy.questions.map((q, qIdx) => (
                    <div key={qIdx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid rgba(10, 26, 47, 0.08)' }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem', color: 'var(--wves-ink)' }}>{q.q}</p>
                      <span style={{ fontFamily: 'var(--wves-font-mono)', opacity: 0.6, color: 'var(--wves-ink)', fontWeight: 900 }}>[{String(q.marks).padStart(2, '0')}M]</span>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => setShowAnswer(prev => ({ ...prev, [caseStudy.id]: !prev[caseStudy.id] }))}
                  style={{ padding: '14px 28px', background: 'transparent', border: '1.5px solid var(--wves-ink)', color: 'var(--wves-ink)', fontFamily: 'var(--wves-font-mono)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em' }}
                >
                  {showAnswer[caseStudy.id] ? 'HIDE MODEL ANSWER' : 'REVEAL MODEL ANSWER'}
                </button>

                {showAnswer[caseStudy.id] && (
                  <div style={{ marginTop: '32px', padding: '32px', background: 'rgba(0, 255, 65, 0.04)', border: '1px solid var(--wves-signal)', animation: 'fadeIn 0.5s ease', position: 'relative' }}>
                    <div className="wves-marginalia" style={{ top: '-20px', right: '-30px', '--note-rotation': '3deg', color: 'var(--wves-signal)', textShadow: '0.4px 0.4px 1px rgba(0, 255, 65, 0.2)' } as any}>
                      Standard solution.
                    </div>
                    <span style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '11px', color: 'var(--wves-signal)', display: 'block', marginBottom: '16px', fontWeight: 900 }}>VERIFIED_MODEL_ANSWER</span>
                    <div style={{ fontSize: '1.05rem', lineHeight: 1.7, color: 'var(--wves-ink)' }}>{renderLines(caseStudy.modelAnswer)}</div>
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

export function StudyContent({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <div className="wves312-study">
      <BriefingPanel />
      <ChapterNotes isAuthenticated={isAuthenticated} />
      <ThinkerFiles isAuthenticated={isAuthenticated} />
      <MCQPractice isAuthenticated={isAuthenticated} />
      <Flashcards isAuthenticated={isAuthenticated} />
      <CaseStudies isAuthenticated={isAuthenticated} />
    </div>
  )
}
