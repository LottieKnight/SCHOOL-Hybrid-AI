import Link from "next/link";
import { headers } from "next/headers";
import PostCard from "@/components/community/PostCard";
import { getBackendSessionFromCookieHeader } from "@/lib/server/backendSession";
import { listSavedPosts } from "@/lib/server/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SavedPostsPage() {
  const headerStore = await headers();
  const session = await getBackendSessionFromCookieHeader(headerStore.get("cookie") || "");
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";

  const posts = userId ? await listSavedPosts(userId) : [];

  return (
    <main style={{ display: "grid", gap: "var(--space-4)", padding: "24px 16px 56px", maxWidth: "760px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <span className="eyebrow">Community</span>
          <h1 style={{ margin: "4px 0 0", fontSize: "clamp(1.5rem, 3vw, 2rem)" }}>Saved Posts</h1>
        </div>
        <Link
          href="/community"
          style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-3)", letterSpacing: "0.05em" }}
        >
          ← Community hub
        </Link>
      </div>

      {!userId ? (
        <div className="ui-card" style={{ padding: "24px", textAlign: "center" }}>
          <p style={{ color: "var(--text-2)", marginBottom: "12px" }}>Sign in to see your saved posts.</p>
          <Link className="button" href="/auth">Sign in</Link>
        </div>
      ) : posts.length === 0 ? (
        <div className="ui-card" style={{ padding: "32px 24px", textAlign: "center" }}>
          <strong style={{ display: "block", marginBottom: "8px", color: "var(--text-1)" }}>No saved posts yet</strong>
          <p style={{ color: "var(--text-3)", fontSize: "14px" }}>
            React with 🔖 <em>saving_this</em> on any post to bookmark it here.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "16px" }}>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} currentUserId={userId} />
          ))}
        </div>
      )}
    </main>
  );
}
