'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { CHAPTER_ARC, MODULE, type RiskClass } from '../data'

interface ModuleHeroProps {
  isAuthenticated: boolean
}

function useCountdown(targetDate: string) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, past: false })

  useEffect(() => {
    function calc() {
      const diff = new Date(targetDate).getTime() - Date.now()
      if (diff <= 0) return setTimeLeft({ days: 0, hours: 0, minutes: 0, past: true })
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        past: false,
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
  if (!pathname) return '/learn/ekrp211'
  const query = searchParams?.toString()
  return query ? `${pathname}?${query}` : pathname
}

const RISK_CLASS_COLORS: Record<RiskClass, string> = {
  STRATEGIC: 'var(--ekrp-strategic)',
  FINANCIAL: 'var(--ekrp-financial)',
  OPERATIONAL: 'var(--ekrp-operational)',
  COMPLIANCE: 'var(--ekrp-compliance)',
}

const CHAPTER_ARC_COLORS: Record<RiskClass, string> = {
  STRATEGIC: 'var(--ekrp-strategic)',
  FINANCIAL: 'var(--ekrp-financial)',
  OPERATIONAL: 'var(--ekrp-operational)',
  COMPLIANCE: 'var(--ekrp-compliance)',
}

function riskClassCounts() {
  const counts: Record<RiskClass, number> = { STRATEGIC: 0, FINANCIAL: 0, OPERATIONAL: 0, COMPLIANCE: 0 }
  for (const arc of CHAPTER_ARC) {
    counts[arc.riskClass]++
  }
  return counts
}

export function ModuleHero({ isAuthenticated }: ModuleHeroProps) {
  const { days, hours, minutes, past } = useCountdown(MODULE.examDate)
  const [mounted, setMounted] = useState(false)
  const arcPreview = useMemo(() => CHAPTER_ARC.slice(0, 4), [])
  const counts = useMemo(() => riskClassCounts(), [])
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const returnPath = useMemo(() => buildReturnPath(pathname, searchParams), [pathname, searchParams])

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <header className="ekrp211-hero">
      <div className={`ekrp211-hero__inner${mounted ? ' ekrp211-hero__inner--mounted' : ''}`}>
        {/* Classification bar */}
        <div className="ekrp211-hero__classbar">
          <span style={{ fontFamily: 'var(--ekrp-font-mono)' }}>{MODULE.code}</span>
          <span className="ekrp211-hero__classbar-divider" />
          <span>{MODULE.institution}</span>
          <span className="ekrp211-hero__classbar-divider" />
          <span>{MODULE.brand.toUpperCase()}</span>
          <span className="ekrp211-hero__classbar-divider" />
          <span>{isAuthenticated ? 'ACCESS: FULL' : 'ACCESS: PREVIEW'}</span>
        </div>

        {/* Two-column hero frame */}
        <div className="ekrp211-hero__frame">
          {/* Left: identity */}
          <div className="ekrp211-hero__identity">
            <div className="ekrp211-hero__eyebrow">
              <span className="ekrp211-hero__code">{MODULE.code}</span>
              <span className="ekrp-risk-badge ekrp-risk-badge--compliance">GOVERNANCE</span>
              <span className="ekrp-risk-badge ekrp-risk-badge--financial">FINANCIAL</span>
            </div>

            <h1 className="ekrp211-hero__title">
              Introduction to<br />
              <em>Risk Management</em>
            </h1>

            <p className="ekrp211-hero__lede">
              {MODULE.storyline}
            </p>

            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontFamily: 'var(--ekrp-font-mono)', fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ekrp-ink-muted)', marginBottom: '8px' }}>
                EXAM STRUCTURE
              </div>
              <div style={{ fontFamily: 'var(--ekrp-font-mono)', fontSize: '11px', color: 'var(--ekrp-ink-mid)', lineHeight: 1.5 }}>
                {MODULE.examStructure}
              </div>
            </div>

            <div className="ekrp211-hero__actions">
              <a className="ekrp211-hero__btn ekrp211-hero__btn--primary" href="#overview">
                BEGIN ASSESSMENT
              </a>
              <a className="ekrp211-hero__btn ekrp211-hero__btn--secondary" href="#chapter-ch1">
                CHAPTER 01 →
              </a>
              {!isAuthenticated && (
                <a className="ekrp211-hero__btn ekrp211-hero__btn--ghost" href={`/auth/signup?ref=ekrp211&next=${encodeURIComponent(returnPath)}`}>
                  UNLOCK FULL MODULE
                </a>
              )}
            </div>
          </div>

          {/* Right: intelligence panel */}
          <div className="ekrp211-hero__panel">
            {/* Exam countdown */}
            <div className="ekrp211-countdown">
              <div className="ekrp211-countdown__label">{past ? 'EXAM COMPLETE' : 'EXAM COUNTDOWN'}</div>
              {past ? (
                <div style={{ fontFamily: 'var(--ekrp-font-mono)', fontSize: '13px', color: 'rgba(80,190,210,0.9)', letterSpacing: '0.12em', padding: '12px 0' }}>
                  ● WRITTEN · {formatExamDate(MODULE.examDate)}
                </div>
              ) : (
                <div className="ekrp211-countdown__units">
                  <div className="ekrp211-countdown__unit">
                    <span className="ekrp211-countdown__num">{String(days).padStart(2, '0')}</span>
                    <span className="ekrp211-countdown__sub">DAYS</span>
                  </div>
                  <span className="ekrp211-countdown__sep">:</span>
                  <div className="ekrp211-countdown__unit">
                    <span className="ekrp211-countdown__num">{String(hours).padStart(2, '0')}</span>
                    <span className="ekrp211-countdown__sub">HRS</span>
                  </div>
                  <span className="ekrp211-countdown__sep">:</span>
                  <div className="ekrp211-countdown__unit">
                    <span className="ekrp211-countdown__num">{String(minutes).padStart(2, '0')}</span>
                    <span className="ekrp211-countdown__sub">MIN</span>
                  </div>
                </div>
              )}
              <div className="ekrp211-countdown__detail">
                {formatExamDate(MODULE.examDate)} · {MODULE.examTime} · {MODULE.examVenue}
              </div>
            </div>

            {/* Risk domain matrix */}
            <div style={{ padding: '20px', background: 'var(--ekrp-panel)', border: '1px solid var(--ekrp-panel-border)', borderRadius: '3px' }}>
              <div style={{ fontFamily: 'var(--ekrp-font-mono)', fontSize: '9px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--ekrp-panel-muted)', marginBottom: '14px' }}>
                RISK DOMAIN COVERAGE
              </div>
              <div className="ekrp211-risk-matrix">
                {((['STRATEGIC', 'FINANCIAL', 'OPERATIONAL', 'COMPLIANCE'] as RiskClass[])).map((cls) => (
                  <div key={cls} className={`ekrp211-risk-tile ekrp211-risk-tile--${cls.toLowerCase()}`}>
                    <div className="ekrp211-risk-tile__dot" />
                    <div className="ekrp211-risk-tile__label">{cls}</div>
                    <div className="ekrp211-risk-tile__count">{counts[cls]}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Module seal */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'var(--ekrp-panel)', border: '1px solid var(--ekrp-panel-border)', borderRadius: '3px' }}>
              <div className="ekrp-seal">
                <span className="ekrp-seal__code">EKRP</span>
                <span>211</span>
                <span>NWU</span>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--ekrp-font-mono)', fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ekrp-panel-muted)', marginBottom: '4px' }}>
                  MODULE STATUS
                </div>
                <div style={{ fontFamily: 'var(--ekrp-font-mono)', fontSize: '11px', color: isAuthenticated ? 'rgba(80, 190, 210, 0.9)' : 'rgba(220, 155, 80, 0.9)', fontWeight: 700 }}>
                  {isAuthenticated ? '● FULL ACCESS' : '○ PREVIEW MODE'}
                </div>
                <div style={{ fontFamily: 'var(--ekrp-font-mono)', fontSize: '10px', color: 'var(--ekrp-panel-muted)', marginTop: '4px' }}>
                  10 chapters · {isAuthenticated ? '8 MCQs · 3 cases' : '4 MCQs · 0 cases'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Chapter arc preview */}
        <div className="ekrp211-hero__arc">
          {arcPreview.map((arc) => (
            <a
              key={arc.id}
              href={`#chapter-${arc.id}`}
              style={{ textDecoration: 'none', '--arc-color': CHAPTER_ARC_COLORS[arc.riskClass] } as React.CSSProperties}
              className="ekrp211-hero__arc-item"
            >
              <div className="ekrp211-hero__arc-num">
                CH {String(arc.number).padStart(2, '0')} · {arc.riskClass}
              </div>
              <h3 className="ekrp211-hero__arc-title">{arc.title}</h3>
              <p className="ekrp211-hero__arc-summary">{arc.summary.slice(0, 80)}…</p>
            </a>
          ))}
        </div>

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', fontFamily: 'var(--ekrp-font-mono)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(200,215,235,0.3)' }}>
          <span>INTEL SOURCE: {MODULE.institution}</span>
          <span>STUDY AID · USE WITH: {MODULE.textbook}</span>
          <span>{isAuthenticated ? 'AUTH: VERIFIED' : 'AUTH: GUEST'}</span>
        </div>
      </div>
    </header>
  )
}
