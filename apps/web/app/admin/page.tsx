import Link from "next/link";
import { AdminQuickLinks } from "@/components/AdminQuickLinks";

export default function AdminHomePage() {
  return (
    <div className="glass card card-with-back">
      <h1 className="title">Admin</h1>
      <p className="subtitle">Administrative tools and reports.</p>
      <AdminQuickLinks />

      <div className="spacer" />
      <div className="list">
        <div className="list-item">
          <strong>Generate lessons (v1)</strong>
          <p className="subtitle">Generate AI-first lessons into content/generated_lessons/v1.</p>
          <Link className="button" href="/admin/generate">
            Open
          </Link>
        </div>
        <div className="list-item">
          <strong>Lesson generation queue</strong>
          <p className="subtitle">Inspect the saved onboarding-derived queue for school and university learners.</p>
          <Link className="button" href="/admin/lesson-generation-queue">
            Open
          </Link>
        </div>
        <div className="list-item">
          <strong>Content mapping</strong>
          <p className="subtitle">Map incoming PDF resources into the canonical week structure.</p>
          <Link className="button" href="/admin/content-mapping">
            Open
          </Link>
        </div>
        <div className="list-item">
          <strong>Resolve subjects</strong>
          <p className="subtitle">Resolve unclassified subject folders into canonical keys.</p>
          <Link className="button" href="/admin/resolve-subjects">
            Open
          </Link>
        </div>
        <div className="list-item">
          <strong>Content index</strong>
          <p className="subtitle">Regenerate and review the content index summary.</p>
          <Link className="button" href="/admin/content-index">
            Open
          </Link>
        </div>
        <div className="list-item">
          <strong>Learning analytics</strong>
          <p className="subtitle">Review lesson engagement and quiz performance.</p>
          <Link className="button" href="/admin/learning-analytics">
            Open
          </Link>
        </div>
        <div className="list-item">
          <strong>Language insights</strong>
          <p className="subtitle">Inspect language-layer usage, top queries, and rewrite-mode trends.</p>
          <Link className="button" href="/admin/language-insights">
            Open
          </Link>
        </div>
        <div className="list-item">
          <strong>Funnel metrics</strong>
          <p className="subtitle">Review unlock conversion, quote funnel status, and wallet totals together.</p>
          <Link className="button" href="/admin/metrics">
            Open
          </Link>
        </div>
        <div className="list-item">
          <strong>Monetisation</strong>
          <p className="subtitle">Track unlock conversion, learner spend, weekly top-up count, and ARPU proxy.</p>
          <Link className="button" href="/admin/monetisation">
            Open
          </Link>
        </div>
        <div className="list-item">
          <strong>Wallet health</strong>
          <p className="subtitle">Review wallet ledger totals and reconciliation mismatches.</p>
          <Link className="button" href="/admin/wallet-health">
            Open
          </Link>
        </div>
        <div className="list-item">
          <strong>Tutor disputes</strong>
          <p className="subtitle">Review and resolve tutor disputes.</p>
          <Link className="button" href="/admin/tutor-disputes">
            Open
          </Link>
        </div>
        <div className="list-item">
          <strong>BrandOS</strong>
          <p className="subtitle">Autonomous personal brand: drafts, analytics, voice model, manual signals.</p>
          <Link className="button" href="/admin/brand">
            Open
          </Link>
        </div>
        <div className="list-item">
          <strong>User management</strong>
          <p className="subtitle">Search, inspect, suspend, and unsuspend user accounts.</p>
          <Link className="button" href="/admin/users">
            Open
          </Link>
        </div>
        <div className="list-item">
          <strong>Audit log</strong>
          <p className="subtitle">Browse security-critical events: logins, password resets, email changes, and more.</p>
          <Link className="button" href="/admin/audit-log">
            Open
          </Link>
        </div>
        <div className="list-item">
          <strong>Feature flags</strong>
          <p className="subtitle">Toggle platform features, set rollout percentages, and use kill switches.</p>
          <Link className="button" href="/admin/feature-flags">
            Open
          </Link>
        </div>
      </div>
    </div>
  );
}
