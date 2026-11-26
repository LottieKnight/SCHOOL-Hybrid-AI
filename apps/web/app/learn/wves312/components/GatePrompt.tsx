'use client'

import { useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { MODULE } from '../data'

function buildReturnPath(pathname: string | null, searchParams: { toString: () => string } | null) {
  if (!pathname) return '/learn/wves312'
  const query = searchParams?.toString()
  return query ? `${pathname}?${query}` : pathname
}

export function GatePrompt() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const returnPath = useMemo(() => buildReturnPath(pathname, searchParams), [pathname, searchParams])

  return (
    <section className="wves312-gate" aria-label="Unlock prompt" style={{ marginTop: '80px', paddingBottom: '40px' }}>
      <div className="wves-sheet" style={{ 
        '--sheet-rotation': '-1.2deg', 
        border: '3px solid var(--wves-ink-red)', 
        padding: '64px',
        boxShadow: '0 40px 100px rgba(0,0,0,0.7), inset 0 0 40px rgba(142, 24, 43, 0.05)'
      } as any}>
        <div className="wves312-gate__inner" style={{ textAlign: 'center' }}>
          <div className="wves312-gate__topline" style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '13px', marginBottom: '32px', opacity: 0.7, color: 'var(--wves-ink)' }}>
            <span className="wves312-gate__sigil" style={{ color: 'var(--wves-ink-red)', fontWeight: 900, letterSpacing: '0.2em' }}>[ENCRYPTION_ACTIVE]</span>
            <span style={{ margin: '0 16px', opacity: 0.3 }}>{/* // */}</span>
            <span className="wves312-gate__code" style={{ fontWeight: 700 }}>{MODULE.brand} / {MODULE.sphere}</span>
          </div>

          <h2 className="wves312-gate__title" style={{ fontSize: '3.2rem', fontWeight: 900, marginBottom: '20px', color: 'var(--wves-ink)', letterSpacing: '-0.02em' }}>The archive remains sealed</h2>
          <p className="wves312-gate__body" style={{ fontSize: '1.2rem', maxWidth: '640px', margin: '0 auto 40px', opacity: 0.9, color: 'var(--wves-ink)', lineHeight: 1.6 }}>
            Authenticate with SCHOOL to de-redact the full dossier. Clues from all 8 chapters, witness transcripts, 
            and the complete interrogation set await decryption.
          </p>

          <div className="wves312-gate__stats" style={{ display: 'flex', justifyContent: 'center', gap: '48px', marginBottom: '48px' }}>
            <div className="wves312-gate__stat">
              <span className="wves312-gate__stat-num" style={{ display: 'block', fontSize: '2.5rem', fontWeight: 900, color: 'var(--wves-ink)' }}>08</span>
              <span className="wves312-gate__stat-label" style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '11px', opacity: 0.5, color: 'var(--wves-ink)', fontWeight: 700 }}>CHAPTER_FILES</span>
            </div>
            <div className="wves312-gate__stat">
              <span className="wves312-gate__stat-num" style={{ display: 'block', fontSize: '2.5rem', fontWeight: 900, color: 'var(--wves-ink)' }}>20</span>
              <span className="wves312-gate__stat-label" style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '11px', opacity: 0.5, color: 'var(--wves-ink)', fontWeight: 700 }}>INTERROGATIONS</span>
            </div>
            <div className="wves312-gate__stat">
              <span className="wves312-gate__stat-num" style={{ display: 'block', fontSize: '2.5rem', fontWeight: 900, color: 'var(--wves-ink)' }}>27</span>
              <span className="wves312-gate__stat-label" style={{ fontFamily: 'var(--wves-font-mono)', fontSize: '11px', opacity: 0.5, color: 'var(--wves-ink)', fontWeight: 700 }}>CIPHERS</span>
            </div>
          </div>

          <div className="wves312-gate__actions" style={{ display: 'flex', gap: '24px', justifyContent: 'center' }}>
            <button
              type="button"
              className="button prestigious-shine"
              style={{ padding: '18px 40px', fontSize: '1.1rem' }}
              onClick={() => router.push(`/auth/signup?ref=wves312&next=${encodeURIComponent(returnPath)}`)}
            >
              DECRYPT DOSSIER FREE
            </button>
            <button
              type="button"
              className="button"
              style={{ background: 'transparent', border: '2px solid var(--wves-ink)', color: 'var(--wves-ink)', padding: '18px 40px', fontSize: '1.1rem' }}
              onClick={() => router.push(`/auth/login?ref=wves312&next=${encodeURIComponent(returnPath)}`)}
            >
              RESUME INVESTIGATION
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
