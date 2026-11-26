import Link from "next/link";

const NEXT_UP = [
  { title: "Revision — Quantum: Wave Mechanics", sub: "Physics · 12 mins · due now", tint: "proto-card--tint1", glyph: "◉", tag: "Start" },
  { title: "AI Tutor — Struggling with ratios?", sub: "Your tutor coaches you live", tint: "proto-card--tint2", glyph: "▲", tag: "Chat", cta: true },
  { title: "Daily Drill", sub: "5 questions · keep your streak", tint: "proto-card--tint3", glyph: "✦", tag: "Go" },
  { title: "Past paper — 2025 S1", sub: "65% last time · 45 min", tint: "proto-card--tint4", glyph: "✎", tag: "Retry" },
];

const YOUR_MODULES = [
  { code: "PHYS2002", name: "Quantum Physics", done: 72, tint: "proto-card--tint1" },
  { code: "MATH2001", name: "Calculus II", done: 48, tint: "proto-card--tint4" },
  { code: "WTTS2010", name: "Academic Writing", done: 90, tint: "proto-card--tint2" },
];

function ProgressBar({ value }: { value: number }) {
  return (
    <div style={{ height: 8, borderRadius: 999, background: "var(--pf-line)", overflow: "hidden" }}>
      <div style={{ width: `${value}%`, height: "100%", background: "var(--pf-accent)", borderRadius: 999 }} />
    </div>
  );
}

export default function PrototypeNowPage() {
  return (
    <main className="proto-main" style={{ paddingTop: "1rem" }}>
      <section className="proto-hero" style={{ paddingTop: "1rem" }}>
        <div className="proto-hero__row">
          <div>
            <div className="proto-eyebrow">Focus &amp; Flow</div>
            <h1>What matters today</h1>
          </div>
          <span className="proto-chip">🔥 3-day streak</span>
        </div>
        <Link className="proto-cta proto-card" href="/prototype/learn" style={{ textDecoration: "none", padding: "0.9rem 1.2rem", alignSelf: "start" }}>
          <span>▲</span>
          <span>Ask the AI Tutor what to do next</span>
        </Link>
      </section>

      <section>
        <p className="proto-section-label">Next up</p>
        <div className="proto-grid">
          {NEXT_UP.map((card) => (
            <Link key={card.title} href="/prototype/practice" className={`proto-card ${card.tint}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="proto-card__icon" style={card.cta ? { background: "var(--pf-coral)" } : undefined} aria-hidden="true">{card.glyph}</span>
                <span className={`proto-tag ${card.cta ? "proto-tag--amber" : "proto-tag--mint"}`}>{card.tag}</span>
              </div>
              <h3>{card.title}</h3>
              <p>{card.sub}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <p className="proto-section-label">Your modules</p>
        <div className="proto-grid">
          {YOUR_MODULES.map((mod) => (
            <div key={mod.code} className={`proto-card ${mod.tint}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="proto-card__meta">{mod.code}</span>
                <span style={{ fontWeight: 800, color: "var(--pf-accent)" }}>{mod.done}%</span>
              </div>
              <h3>{mod.name}</h3>
              <ProgressBar value={mod.done} />
              <Link href="/prototype/learn" style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--pf-accent)", textDecoration: "none" }}>
                Keep learning →
              </Link>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}