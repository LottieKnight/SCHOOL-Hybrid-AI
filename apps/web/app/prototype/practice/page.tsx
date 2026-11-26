import Link from "next/link";

const SESSIONS = [
  { icon: "✎", title: "Exam Practice — Quantum", desc: "2025 S1 paper · 12 questions · graded", tint: "proto-card--tint1", tag: "65%" },
  { icon: "⚡", title: "Adaptive Drill", desc: "Targets your weak spots in ratios & probability", tint: "proto-card--tint2", tag: "Go" },
  { icon: "◔", title: "Timed quiz", desc: "8 minutes · boosts retention", tint: "proto-card--tint4", tag: "Start" },
];

export default function PrototypePracticePage() {
  return (
    <main className="proto-main" style={{ paddingTop: "1rem" }}>
      <section className="proto-hero" style={{ paddingTop: "1rem" }}>
        <div className="proto-hero__row">
          <div>
            <div className="proto-eyebrow">Practice</div>
            <h1>Sharpen it</h1>
          </div>
        </div>
        <p style={{ margin: 0, color: "var(--pf-ink-2)", fontSize: "0.95rem" }}>
          Deliberate, spaced practice on the things that pull your grade down.
        </p>
      </section>

      <section>
        <p className="proto-section-label">Recommended for you</p>
        <div className="proto-grid">
          {SESSIONS.map((session) => (
            <Link key={session.title} href="/prototype/practice" className={`proto-card ${session.tint}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="proto-card__icon" aria-hidden="true">{session.icon}</span>
                <span className="proto-tag proto-tag--amber">{session.tag}</span>
              </div>
              <h3>{session.title}</h3>
              <p>{session.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <p className="proto-section-label">Past papers</p>
        <div className="proto-grid">
          {["2025 S1", "2024 S2", "2024 S1"].map((paper) => (
            <div key={paper} className="proto-card" style={{ alignItems: "start", background: "var(--pf-bg-raised)" }}>
              <span className="proto-card__meta">{paper}</span>
              <h3>Quantum Physics</h3>
              <p>Full paper, exam conditions</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}