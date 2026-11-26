import Link from "next/link";

const TOPICS = [
  { icon: "◉", title: "Wave Mechanics", desc: "The Schrödinger equation, superposition, and probability currents.", tint: "proto-card--tint1", tag: "Started" },
  { icon: "▣", title: "Lagrangian Dynamics", desc: "Energy-based formulation of mechanics.", tint: "proto-card--tint4", tag: "New" },
  { icon: "✦", title: "Electricity & Magnetism", desc: "Maxwell&rsquo;s equations in context.", tint: "proto-card--tint2", tag: "75%" },
  { icon: "✎", title: "Past Papers", desc: "Practice under real exam conditions.", tint: "proto-card--tint3", tag: "Try" },
];

export default function PrototypeLearnPage() {
  return (
    <main className="proto-main" style={{ paddingTop: "1rem" }}>
      <section className="proto-hero" style={{ paddingTop: "1rem" }}>
        <div className="proto-hero__row">
          <div>
            <div className="proto-eyebrow">Learn</div>
            <h1>Your capability path</h1>
          </div>
        </div>
        <div style={{ display: "grid", gap: "0.5rem", color: "var(--pf-ink-2)", fontSize: "0.95rem" }}>
          <span>Quantum Physics · PHYS2002 · Semester 1</span>
          <ProgressLabel />
        </div>
      </section>

      <section>
        <p className="proto-section-label">Topics</p>
        <div className="proto-grid">
          {TOPICS.map((topic) => (
            <Link key={topic.title} href="/prototype/learn" className={`proto-card ${topic.tint}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="proto-card__icon" aria-hidden="true">{topic.icon}</span>
                <span className="proto-tag proto-tag--mint">{topic.tag}</span>
              </div>
              <h3>{topic.title}</h3>
              <p>{topic.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function ProgressLabel() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
      <div style={{ flex: 1, maxWidth: 320, height: 8, borderRadius: 999, background: "var(--pf-line)", overflow: "hidden" }}>
        <div style={{ width: "40%", height: "100%", background: "var(--pf-coral)", borderRadius: 999 }} />
      </div>
      <span style={{ fontWeight: 700, color: "var(--pf-ink)" }}>40%</span>
    </div>
  );
}