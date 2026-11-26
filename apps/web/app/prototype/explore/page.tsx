const EXPLORE = [
  { icon: "❐", title: "Community", desc: "Circles, rooms, leaderboards & questions", tint: "proto-card--tint1" },
  { icon: "⇅", title: "Marketplace", desc: "Sellers, equipment & the economy", tint: "proto-card--tint2" },
  { icon: "✥", title: "Library", desc: "Notes, textbooks & past papers", tint: "proto-card--tint3" },
  { icon: "⊕", title: "Resources", desc: "Extra material to go deeper", tint: "proto-card--tint4" },
];

export default function PrototypeExplorePage() {
  return (
    <main className="proto-main" style={{ paddingTop: "1rem" }}>
      <section className="proto-hero" style={{ paddingTop: "1rem" }}>
        <div className="proto-hero__row">
          <div>
            <div className="proto-eyebrow">Explore</div>
            <h1>Everything else</h1>
          </div>
        </div>
        <p style={{ margin: 0, color: "var(--pf-ink-2)", fontSize: "0.95rem" }}>
          Companion surfaces — easily reachable, but never in the way of your work.
        </p>
      </section>

      <section>
        <div className="proto-grid">
          {EXPLORE.map((item) => (
            <div key={item.title} className={`proto-card ${item.tint}`}>
              <span className="proto-card__icon" aria-hidden="true">{item.icon}</span>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}