'use client'

import { useEffect, useState } from 'react'
import { CHAPTERS, CHAPTER_ARC } from '../data'
import { useWves312AnchorScrollMemory } from './useWves312AnchorScrollMemory'

const ANCILLARY_LINKS = [
  { id: 'briefing', label: 'Briefing', emoji: '◌' },
  { id: 'ch18-thinkers', label: 'Witness files', emoji: '🧠' },
  { id: 'mcq', label: 'Interrogation', emoji: '⚡' },
  { id: 'flashcards', label: 'Cipher deck', emoji: '🗝' },
  { id: 'cases', label: 'Incident reports', emoji: '📝' },
]

const ANCHOR_TARGETS = [
  { id: 'briefing', targetId: 'briefing' },
  ...CHAPTERS.map((chapter) => ({ id: chapter.id, targetId: `chapter-${chapter.id}` })),
  ...ANCILLARY_LINKS.slice(1).map((item) => ({ id: item.id, targetId: item.id })),
]

export function ChapterNav() {
  const [active, setActive] = useState('briefing')
  const jumpToAnchor = useWves312AnchorScrollMemory()

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

  function scrollTo(id: string) {
    jumpToAnchor(id)
  }

  return (
    <nav className="wves312-chapnav" aria-label="Study guide navigation">
      <div className="wves312-chapnav__label" style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '10px', textTransform: 'uppercase', opacity: 0.5, marginBottom: '12px', paddingLeft: '8px' }}>ARCHIVE INDEX</div>

      {CHAPTERS.map((chapter) => {
        const arc = CHAPTER_ARC.find((item) => item.id === chapter.id)
        const isActive = active === chapter.id
        const targetId = `chapter-${chapter.id}`
        return (
          <button
            key={chapter.id}
            type="button"
            className={`wves312-chapnav__btn ${isActive ? 'wves312-chapnav__btn--active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => scrollTo(targetId)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              padding: '12px 16px', 
              background: isActive ? 'var(--wves-paper)' : 'rgba(255,255,255,0.03)', 
              color: isActive ? 'var(--wves-ink)' : 'rgba(255,255,255,0.4)',
              border: 'none',
              borderRadius: '2px 0 0 2px',
              textAlign: 'left',
              width: '100%',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              transform: isActive ? 'translateX(8px)' : 'none',
              boxShadow: isActive ? '-8px 0 20px rgba(0,0,0,0.3)' : 'none',
              fontFamily: 'var(--wves-font-mono)',
              fontSize: '12px'
            }}
          >
            <span className="wves312-chapnav__index" style={{ opacity: 0.6 }}>{arc?.act ?? `0${chapter.number}`}</span>
            <span className="wves312-chapnav__content" style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="wves312-chapnav__title" style={{ fontWeight: 700, textTransform: 'uppercase' }}>{arc?.title ?? chapter.title}</span>
            </span>
            {chapter.gated && <span className="wves312-chapnav__lock" style={{ marginLeft: 'auto', fontSize: '10px' }}>[LOCKED]</span>}
          </button>
        )
      })}

      <div className="wves312-chapnav__divider" style={{ height: '24px' }} />

      {ANCILLARY_LINKS.map((item) => {
        const isActive = active === item.id
        return (
          <button
            key={item.id}
            type="button"
            className={`wves312-chapnav__btn ${isActive ? 'wves312-chapnav__btn--active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => scrollTo(item.id)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              padding: '8px 16px', 
              background: isActive ? 'var(--wves-paper)' : 'rgba(255,255,255,0.02)', 
              color: isActive ? 'var(--wves-ink)' : 'rgba(255,255,255,0.3)',
              border: 'none',
              borderRadius: '2px 0 0 2px',
              textAlign: 'left',
              width: '100%',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              transform: isActive ? 'translateX(8px)' : 'none',
              fontFamily: 'var(--wves-font-mono)',
              fontSize: '11px'
            }}
          >
            <span className="wves312-chapnav__index" style={{ opacity: 0.6 }}>{item.emoji}</span>
            <span className="wves312-chapnav__content">
              <span className="wves312-chapnav__title" style={{ fontWeight: 600 }}>{item.label.toUpperCase()}</span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}
