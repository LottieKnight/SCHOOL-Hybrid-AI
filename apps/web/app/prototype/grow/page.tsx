const GROW = [
  { icon: "◔", title: "Profile & achievements", desc: "Your progress, XP and badges", tint: "proto-card--tint1" },
  { icon: "✚", title: "Wallet", desc: "Savings, credits & bursaries", tint: "proto-card--tint2" },
  { icon: "☆", title: "Settings & privacy", desc: "Account, notifications and your data", tint: "proto-card--tint3" },
];

export default function PrototypeGrowPage() {
  return (
    <main className="proto-main" style={{ paddingTop: "1rem" }}>
      <section className="proto-hero" style={{ paddingTop: "1rem" }}>
        <div>
          <div className="proto-eyebrow">Grow</div>
          <h1>You &amp; your future</h1>
        </div>
      </section>
      <section>
        <div className="proto-grid">
          {GROW.map((item) => (
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