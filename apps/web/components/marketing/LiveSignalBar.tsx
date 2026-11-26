'use client'

import { useEffect, useState } from 'react'

type GrowthSummary = {
  activeToday: number
  activeThisWeek: number
  totalUsers: number
  newThisWeek: number
}

function AnimatedCount({ value }: { value: number }) {
  const [display, setDisplay] = useState(value)

  useEffect(() => {
    if (display === value) return
    const step = Math.ceil(Math.abs(value - display) / 20)
    const id = setInterval(() => {
      setDisplay((prev) => {
        if (Math.abs(prev - value) <= step) {
          clearInterval(id)
          return value
        }
        return prev < value ? prev + step : prev - step
      })
    }, 30)
    return () => clearInterval(id)
  }, [value, display])

  return <>{display.toLocaleString()}</>
}

export function LiveSignalBar() {
  const [data, setData] = useState<GrowthSummary | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/growth/summary', { cache: 'no-store' })
        if (res.ok) setData(await res.json())
      } catch { /* ignore — bar is best-effort */ }
    }
    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [])

  if (!data) return null

  return (
    <div
      style={{
        display: 'flex',
        gap: 24,
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px 20px',
        background: 'rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        fontSize: 13,
        fontFamily: 'var(--font-geist-mono, monospace)',
      }}
    >
      <span>
        <strong><AnimatedCount value={data.totalUsers} /></strong>
        <span style={{ opacity: 0.55 }}> students registered</span>
      </span>
      <span style={{ opacity: 0.25 }}>·</span>
      <span>
        <strong><AnimatedCount value={data.activeThisWeek} /></strong>
        <span style={{ opacity: 0.55 }}> studying this week</span>
      </span>
      <span style={{ opacity: 0.25 }}>·</span>
      <span>
        <strong>+<AnimatedCount value={data.newThisWeek} /></strong>
        <span style={{ opacity: 0.55 }}> joined in 7 days</span>
      </span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          color: '#4caf7d',
          fontWeight: 600,
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4caf7d', display: 'inline-block', animation: 'pulse 2s infinite' }} />
        LIVE
      </span>
    </div>
  )
}
