import type { Metadata } from "next";
import { getGrowthSnapshot } from "@/lib/server/growthDb";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "Growth Overview | Admin",
};

function StatCard({ label, value, sub, variant }: {
  label: string;
  value: string | number;
  sub?: string;
  variant?: "gold" | "green" | "neutral";
}) {
  return (
    <div className="glass card" style={{ padding: "20px 24px", display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.6 }}>{label}</div>
      <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1 }}>{value.toLocaleString()}</div>
      {sub && <div style={{ fontSize: 13, opacity: 0.55 }}>{sub}</div>}
      {variant && <Badge variant={variant}>{variant === "gold" ? "Paid" : variant === "green" ? "Active" : "Total"}</Badge>}
    </div>
  );
}

function ConversionBar({ paid, total }: { paid: number; total: number }) {
  const rate = total > 0 ? Math.round((paid / total) * 100) : 0;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <span>Trial → Paid conversion</span>
        <strong>{rate}%</strong>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${rate}%`, background: "var(--color-gold, #c9a227)", borderRadius: 4, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

export default async function AdminGrowthPage() {
  const snap = await getGrowthSnapshot();
  const now = new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", dateStyle: "medium", timeStyle: "short" });

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="glass card" style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Growth Overview</h1>
          <p style={{ margin: "4px 0 0 0", opacity: 0.55, fontSize: 13 }}>Last refreshed: {now} · auto-refreshes every 5 min</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Badge variant="green">Live</Badge>
          <Badge variant="neutral">ISR · 5 min cache</Badge>
        </div>
      </div>

      {/* Key metrics grid */}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
        <StatCard label="Total users" value={snap.totalUsers} sub="All registered accounts" variant="neutral" />
        <StatCard label="New this week" value={snap.newThisWeek} sub="Signups in last 7 days" variant="green" />
        <StatCard label="Paid users" value={snap.paidUsers} sub="Active paid plans" variant="gold" />
        <StatCard label="Active today" value={snap.activeToday} sub="Unique sessions today" variant="green" />
        <StatCard label="Active this week" value={snap.activeThisWeek} sub="Unique sessions this week" />
        <StatCard label="AI calls today" value={snap.aiCallsToday} sub="Total LLM requests today" />
      </div>

      {/* Conversion funnel */}
      <div className="glass card" style={{ padding: "20px 24px", display: "grid", gap: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Conversion funnel</h2>
        <ConversionBar paid={snap.paidUsers} total={snap.totalUsers} />
        <div style={{ display: "grid", gap: 6, gridTemplateColumns: "1fr 1fr 1fr", fontSize: 13 }}>
          <div className="glass" style={{ borderRadius: 10, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{snap.totalUsers.toLocaleString()}</div>
            <div style={{ opacity: 0.55 }}>Registered</div>
          </div>
          <div className="glass" style={{ borderRadius: 10, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{snap.activeThisWeek.toLocaleString()}</div>
            <div style={{ opacity: 0.55 }}>Engaged (week)</div>
          </div>
          <div className="glass" style={{ borderRadius: 10, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{snap.paidUsers.toLocaleString()}</div>
            <div style={{ opacity: 0.55 }}>Converted</div>
          </div>
        </div>
      </div>

      {/* Capacity status */}
      <div className="glass card" style={{ padding: "20px 24px", display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Platform capacity status</h2>
        <div style={{ display: "grid", gap: 8 }}>
          {[
            { label: "DB connection pool", value: "25 connections", status: "green", note: "Upgraded from 5 — supports ~1500 concurrent users" },
            { label: "Session caching", value: "Redis · 10 min TTL", status: "green", note: "Eliminates DB lookup per request" },
            { label: "AI rate limiting", value: "10 req / 60s per user", status: "green", note: "Sliding window on all LLM endpoints" },
            { label: "Leaderboard cache", value: "Redis · 5 min TTL", status: "green", note: "Aggregate query cached — sub-5ms on hit" },
            { label: "API rate limit", value: "300 req / min global", status: "green", note: "Raised from 120 — accommodates growth" },
            { label: "DB indexes", value: "Pending", status: "amber", note: "quiz_sessions, user_quests, user_notifications — apply migration" },
          ].map((item) => (
            <div key={item.label} className="glass" style={{ borderRadius: 10, padding: "10px 14px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.status === "green" ? "#4caf7d" : "#e8a838", flexShrink: 0 }} />
              <strong style={{ minWidth: 200, fontSize: 13 }}>{item.label}</strong>
              <code style={{ fontSize: 12, opacity: 0.8 }}>{item.value}</code>
              <span style={{ fontSize: 12, opacity: 0.5 }}>{item.note}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
