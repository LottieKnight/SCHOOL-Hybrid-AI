'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { CHAPTER_ARC, MODULE } from '../data'

interface ModuleHeroProps {
  isAuthenticated: boolean
}

function useCountdown(targetDate: string) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 })

  useEffect(() => {
    function calc() {
      const diff = new Date(targetDate).getTime() - Date.now()
      if (diff <= 0) return setTimeLeft({ days: 0, hours: 0, minutes: 0 })
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
      })
    }

    calc()
    const id = setInterval(calc, 60000)
    return () => clearInterval(id)
  }, [targetDate])

  return timeLeft
}

function formatExamDate(value: string) {
  return new Date(value).toLocaleDateString('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function buildReturnPath(pathname: string | null, searchParams: { toString: () => string } | null) {
  if (!pathname) return '/learn/wves312'
  const query = searchParams?.toString()
  return query ? `${pathname}?${query}` : pathname
}

export function ModuleHero({ isAuthenticated }: ModuleHeroProps) {
  const { days, hours, minutes } = useCountdown(MODULE.examDate)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const returnPath = useMemo(() => buildReturnPath(pathname, searchParams), [pathname, searchParams])

  useEffect(() => {
    setMounted(true)
  }, [])

  const trail = useMemo(() => CHAPTER_ARC.slice(0, 4), [])

  return (
    <header className="wves312-hero">
      <div className="wves312-hero__inner" style={{ 
        opacity: mounted ? 1 : 0, 
        transform: mounted ? 'none' : 'translateY(20px)',
        transition: 'opacity 0.8s ease, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        <div className="wves-sheet" style={{ 
          '--sheet-rotation': '-0.4deg',
          transitionDelay: '0.1s'
        } as any}>
          <div className="wves-marginalia" style={{ 
            top: '40px', 
            right: '-140px', 
            '--note-rotation': '8deg' 
          } as any}>
            Investigator's note: Ethics isn't about the rules, it's about the verdict.
          </div>
          
          <div className="wves312-hero__copy">
            <div className="wves312-hero__badge-row" style={{ justifyContent: 'center', marginBottom: '16px' }}>
              <span className="wves312-badge" style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '10px', opacity: 0.6, border: '1px solid var(--wves-ink)', color: 'var(--wves-ink)' }}>[CLASSIFICATION: RESTRICTED]</span>
              <span className="wves312-badge" style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '10px', opacity: 0.6, border: '1px solid var(--wves-ink)', color: 'var(--wves-ink)' }}>[DECODER: {MODULE.sphere.toUpperCase()}]</span>
            </div>

            <div className="wves-stamp" style={{ 
              marginBottom: '32px',
              opacity: mounted ? 0.9 : 0,
              transform: mounted ? 'rotate(-4deg) scale(1)' : 'rotate(-10deg) scale(1.2)',
              transition: 'opacity 0.5s ease 0.8s, transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.8s'
            }}>{MODULE.code}</div>
            
            <h1 className="wves312-hero__title" style={{ fontSize: '4.2rem', marginBottom: '16px', letterSpacing: '-0.02em' }}>
              Business Ethics
            </h1>
            <p className="wves312-hero__lede" style={{ fontSize: '1.3rem', maxWidth: '680px', margin: '0 auto 40px', fontStyle: 'italic', color: 'rgba(10, 26, 47, 0.8)' }}>
              {MODULE.storyline}
            </p>

            <div className="wves312-hero__actions" style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
              <a className="button prestigious-shine" href="#briefing" style={{ padding: '14px 28px' }}>
                DECRYPT BRIEFING
              </a>
              <a className="button" href="#chapter-ch3" style={{ background: 'transparent', border: '1px solid var(--wves-ink)', padding: '14px 28px' }}>
                OPEN CLUE I
              </a>
              {!isAuthenticated && (
                <a className="button" href={`/auth/signup?ref=wves312&next=${encodeURIComponent(returnPath)}`} style={{ color: 'var(--wves-ink-red)', padding: '14px 28px' }}>
                  DE-REDACT FULL DOSSIER
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="wves-sheet" style={{ 
          '--sheet-rotation': '0.3deg', 
          padding: '56px',
          transitionDelay: '0.3s'
        } as any}>
          <div className="wves312-hero__frame" style={{ gridTemplateColumns: '1fr 1fr', gap: '64px', textAlign: 'left' }}>
            <aside className="wves312-hero__board" aria-label="Case board">
              <div className="wves312-hero__board-head" style={{ marginBottom: '32px' }}>
                <div className="wves312-hero__board-label" style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '11px', textTransform: 'uppercase', opacity: 0.5 }}>Subject Intelligence</div>
                <div className="wves312-hero__board-title" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--wves-ink)' }}>{MODULE.dossierTitle}</div>
              </div>

              <div className="wves312-countdown" style={{ marginBottom: '40px', background: 'rgba(10, 26, 47, 0.03)', border: '1px solid rgba(10, 26, 47, 0.1)' }}>
                <div className="wves312-countdown__label" style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '11px', marginBottom: '12px', color: 'var(--wves-ink)' }}>COUNTDOWN TO VERDICT</div>
                <div className="wves312-countdown__units" style={{ display: 'flex', gap: '16px', alignItems: 'baseline' }}>
                  <div className="wves312-countdown__unit">
                    <span className="wves312-countdown__num" style={{ fontSize: '2.4rem', fontWeight: 900, color: 'var(--wves-ink)' }}>{days}</span>
                    <span className="wves312-countdown__sub" style={{ fontSize: '0.85rem', marginLeft: '4px', opacity: 0.6 }}>days</span>
                  </div>
                  <span style={{ opacity: 0.2 }}>/</span>
                  <div className="wves312-countdown__unit">
                    <span className="wves312-countdown__num" style={{ fontSize: '2.4rem', fontWeight: 900, color: 'var(--wves-ink)' }}>{String(hours).padStart(2, '0')}</span>
                    <span className="wves312-countdown__sub" style={{ fontSize: '0.85rem', marginLeft: '4px', opacity: 0.6 }}>hrs</span>
                  </div>
                  <span style={{ opacity: 0.2 }}>/</span>
                  <div className="wves312-countdown__unit">
                    <span className="wves312-countdown__num" style={{ fontSize: '2.4rem', fontWeight: 900, color: 'var(--wves-ink)' }}>{String(minutes).padStart(2, '0')}</span>
                    <span className="wves312-countdown__sub" style={{ fontSize: '0.85rem', marginLeft: '4px', opacity: 0.6 }}>mins</span>
                  </div>
                </div>
                <div className="wves312-countdown__detail" style={{ fontSize: '0.95rem', opacity: 0.6, marginTop: '12px' }}>
                  {formatExamDate(MODULE.examDate)} · {MODULE.examVenue}
                </div>
              </div>

              <div className="wves312-hero__facts" style={{ display: 'grid', gap: '20px' }}>
                <div className="wves312-hero__fact">
                  <span className="wves312-hero__fact-label" style={{ display: 'block', fontSize: '11px', opacity: 0.5 }}>EXAM STRUCTURE</span>
                  <strong style={{ fontSize: '1.1rem' }}>{MODULE.examStructure}</strong>
                </div>
                <div className="wves312-hero__fact">
                  <span className="wves312-hero__fact-label" style={{ display: 'block', fontSize: '11px', opacity: 0.5 }}>IDENTITIES</span>
                  <strong style={{ fontSize: '1.1rem' }}>{MODULE.brand} / {MODULE.sphere}</strong>
                </div>
              </div>
            </aside>

            <div className="wves312-hero__trail">
              <div className="wves-marginalia" style={{ top: '-30px', right: '-80px', '--note-rotation': '-4deg', fontSize: '1.1rem' } as any}>
                Field tip: Map the theory first.
              </div>
              <div style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '11px', opacity: 0.5, marginBottom: '20px', letterSpacing: '0.1em' }}>EVIDENCE TRAIL [01-04]</div>
              {trail.map((arc) => (
                <article key={arc.id} className="wves312-hero__trail-card" style={{ marginBottom: '24px', borderBottom: '1px solid rgba(10, 26, 47, 0.08)', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <span className="wves312-hero__trail-act" style={{ fontStyle: 'italic', opacity: 0.6, fontSize: '1.2rem' }}>{arc.act}.</span>
                    <div className="wves312-hero__trail-body">
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--wves-ink)' }}>{arc.title}</h3>
                      <p style={{ fontSize: '1rem', margin: '4px 0 0', opacity: 0.8, lineHeight: 1.4 }}>{arc.summary}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="wves312-hero__footer" style={{ marginTop: '32px', textAlign: 'center', fontSize: '0.85rem', opacity: 0.4 }}>
          <div className="wves312-hero__footer-line" style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginBottom: '8px' }}>
            <span>{isAuthenticated ? 'AUTHENTICATION: VERIFIED' : 'AUTHENTICATION: PENDING'}</span>
            <span>INTEL_SOURCE: {MODULE.institution}</span>
          </div>
          <p>This dossier is a study aid. Use in conjunction with {MODULE.textbook}.</p>
        </div>
      </div>
    </header>
  )
}

