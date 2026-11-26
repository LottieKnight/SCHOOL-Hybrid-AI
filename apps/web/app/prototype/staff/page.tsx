import Link from "next/link";

export default function PrototypeStaffPage() {
  return (
    <main className="proto-main" style={{ paddingTop: "1rem" }}>
      <section className="proto-hero" style={{ paddingTop: "1rem" }}>
        <div>
          <div className="proto-eyebrow">Staff</div>
          <h1>Operations &amp; administration</h1>
        </div>
        <p style={{ margin: 0, color: "var(--pf-ink-2)", fontSize: "0.95rem" }}>
          Fully separated from the learner journey. Operate the platform here.
        </p>
      </section>
      <section>
        <div className="proto-grid">
          <div className="proto-card proto-card--tint1" style={{ alignItems: "start" }}>
            <span className="proto-card__icon" aria-hidden="true">⚙</span>
            <h3>Admin console</h3>
            <p>The live admin area already exists and stays as-is.</p>
          </div>
          <Link href="/admin" className="proto-card proto-card--tint2" style={{ textDecoration: "none", color: "inherit", alignItems: "start" }}>
            <span className="proto-card__icon" aria-hidden="true">→</span>
            <h3>Open the current admin</h3>
            <p>Jump to the existing, fully-featured console.</p>
          </Link>
        </div>
      </section>
    </main>
  );
}