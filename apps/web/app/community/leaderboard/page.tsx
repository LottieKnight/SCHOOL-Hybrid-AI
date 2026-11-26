import Link from "next/link";
import { headers } from "next/headers";
import { getBackendSessionFromCookieHeader } from "@/lib/server/backendSession";
import { getCommunityLeaderboard } from "@/lib/server/community";
import { getInstitutionContextForUser } from "@/lib/server/institutions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

export default async function LeaderboardPage() {
  const headerStore = await headers();
  const session = await getBackendSessionFromCookieHeader(headerStore.get("cookie") || "");
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  const institutionId = userId
    ? await getInstitutionContextForUser(userId).then((ctx) => ctx?.id ?? null).catch(() => null)
    : null;

  const entries = await getCommunityLeaderboard(institutionId).catch(() => null);

  return (
    <main style={{ maxWidth: "640px", margin: "0 auto", padding: "32px 16px 64px", display: "grid", gap: "24px" }}>
      <div>
        <span className="eyebrow">Community</span>
        <h1 style={{ margin: "4px 0 4px", fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>Weekly Leaderboard</h1>
        <p style={{ color: "var(--text-3)", fontSize: "13px", margin: 0 }}>
          Top contributors this week by Scholar Credits earned from posts, replies, reactions, and accepted answers.
          Resets every Monday.
        </p>
      </div>

      {entries === null ? (
        <div className="ui-card" style={{ padding: "32px 24px", textAlign: "center" }}>
          <strong style={{ display: "block", color: "var(--text-1)", marginBottom: "8px" }}>Leaderboard is temporarily unavailable</strong>
          <p style={{ color: "var(--text-3)", fontSize: "13px" }}>
            The leaderboard service is offline right now. Check back in a little while — your credits are still safe.
          </p>
        </div>
      ) : entries.length === 0 ? (
        <div className="ui-card" style={{ padding: "32px 24px", textAlign: "center" }}>
          <strong style={{ display: "block", color: "var(--text-1)", marginBottom: "8px" }}>No data yet this week</strong>
          <p style={{ color: "var(--text-3)", fontSize: "13px" }}>
            Post a question or answer in any module room to appear here.
          </p>
        </div>
      ) : (
        <div className="ui-card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-3)", fontWeight: 600 }}>Rank</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-3)", fontWeight: 600 }}>Student</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-3)", fontWeight: 600 }}>Credits</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-3)", fontWeight: 600 }}>Accepted</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.rank}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    background: entry.rank === 1 ? "color-mix(in srgb, var(--gold-dim, rgba(255,215,0,0.06)) 80%, transparent)" : undefined,
                  }}
                >
                  <td style={{ padding: "14px 16px", fontSize: "18px" }}>
                    {RANK_MEDALS[entry.rank - 1] ?? `#${entry.rank}`}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <strong style={{ color: "var(--text-1)", fontSize: "14px" }}>{entry.label}</strong>
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--inst-primary)" }}>
                    {entry.totalCredits}
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--text-2)" }}>
                    {entry.acceptedAnswers}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <Link
          href="/community"
          style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-3)", letterSpacing: "0.05em" }}
        >
          ← Community hub
        </Link>
        <Link
          href="/community/questions"
          style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-3)", letterSpacing: "0.05em" }}
        >
          Ask the Campus →
        </Link>
      </nav>
    </main>
  );
}
