'use client'

import { useEffect, useState } from 'react'
import { CHAPTERS, CHAPTER_ARC, type RiskClass } from '../data'
import { useEkrp211AnchorScrollMemory } from './useEkrp211AnchorScrollMemory'

const ANCILLARY_LINKS = [
  { id: 'mcq', label: 'MCQ Bank', riskClass: null as RiskClass | null },
  { id: 'definitions', label: 'Definitions', riskClass: null as RiskClass | null },
  { id: 'cases', label: 'Case Files', riskClass: null as RiskClass | null },
]

const ANCHOR_TARGETS = [
  { id: 'overview', targetId: 'overview' },
  ...CHAPTERS.map((chapter) => ({ id: chapter.id, targetId: `chapter-${chapter.id}` })),
  ...ANCILLARY_LINKS.map((item) => ({ id: item.id, targetId: item.id })),
]

const RISK_CLASS_CSS_VARS: Record<RiskClass, string> = {
  STRATEGIC: 'var(--ekrp-strategic)',
  FINANCIAL: 'var(--ekrp-financial)',
  OPERATIONAL: 'var(--ekrp-operational)',
  COMPLIANCE: 'var(--ekrp-compliance)',
}

export function ChapterNav() {
  const [active, setActive] = useState('overview')
  const jumpToAnchor = useEkrp211AnchorScrollMemory()

  useEffect(() => {
    function onScroll() {
      for (const anchor of ANCHOR_TARGETS.slice().reverse()) {
        const el = document.getElementById(anchor.targetId)
        if (el && el.getBoundingClientRect().top <= 128) {
          setActive(anchor.id)
          break
        }
      }
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav className="ekrp211-chapnav" aria-label="Module navigation">
      <div className="ekrp211-chapnav__header">RISK DOMAIN INDEX</div>

      {/* Overview link */}
      <button
        type="button"
        className={`ekrp211-chapnav__btn${active === 'overview' ? ' ekrp211-chapnav__btn--active' : ''}`}
        aria-current={active === 'overview' ? 'page' : undefined}
        onClick={() => jumpToAnchor('overview')}
        style={{ '--nav-accent': 'rgba(200,215,235,0.5)' } as React.CSSProperties}
      >
        <span className="ekrp211-chapnav__indicator" style={{ background: 'rgba(200,215,235,0.4)' }} />
        <span className="ekrp211-chapnav__title">Overview</span>
      </button>

      <div className="ekrp211-chapnav__divider" />

      {CHAPTERS.map((chapter) => {
        const arc = CHAPTER_ARC.find((item) => item.id === chapter.id)
        const isActive = active === chapter.id
        const riskClass = arc?.riskClass ?? 'STRATEGIC'
        const accentColor = RISK_CLASS_CSS_VARS[riskClass]

        return (
          <button
            key={chapter.id}
            type="button"
            className={`ekrp211-chapnav__btn${isActive ? ' ekrp211-chapnav__btn--active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => jumpToAnchor(`chapter-${chapter.id}`)}
            style={{ '--nav-accent': accentColor } as React.CSSProperties}
          >
            <span
              className="ekrp211-chapnav__indicator"
              style={{ background: isActive ? accentColor : 'rgba(255,255,255,0.12)' }}
            />
            <span className="ekrp211-chapnav__title">
              {String(chapter.number).padStart(2, '0')} · {chapter.title}
            </span>
            {chapter.gated && (
              <span className="ekrp211-chapnav__lock">LOCK</span>
            )}
          </button>
        )
      })}

      <div className="ekrp211-chapnav__divider" />

      {ANCILLARY_LINKS.map((item) => {
        const isActive = active === item.id
        return (
          <button
            key={item.id}
            type="button"
            className={`ekrp211-chapnav__btn${isActive ? ' ekrp211-chapnav__btn--active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => jumpToAnchor(item.id)}
            style={{ '--nav-accent': 'rgba(200,215,235,0.55)' } as React.CSSProperties}
          >
            <span className="ekrp211-chapnav__indicator" style={{ background: 'rgba(200,215,235,0.2)' }} />
            <span className="ekrp211-chapnav__title">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
