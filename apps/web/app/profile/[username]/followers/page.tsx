"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import { useSession } from "@/components/SessionProvider";
import { StateCard } from "@/components/ui/StateCard";

type FollowUser = {
  id: string;
  username: string | null;
  avatar_uniform: unknown;
  school_name: string | null;
  is_following_back: boolean;
};

type FollowListResponse = {
  users: FollowUser[];
  total: number;
  limit: number;
  offset: number;
};

export default function FollowersPage() {
  const { username } = useParams<{ username: string }>();
  const { session } = useSession();
  const [userId, setUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const limit = 20;

  const loadUserId = useCallback(async () => {
    const res = await fetch(`${API_BASE}/profile/users/${encodeURIComponent(username)}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Profile not found.");
    const data = (await res.json()) as { userId?: string; isSelf?: boolean };
    return data.userId ?? null;
  }, [username]);

  const loadFollowers = useCallback(async (uid: string, offset: number) => {
    const res = await fetch(
      `${API_BASE}/profile/follow-list?userId=${uid}&type=followers&limit=${limit}&offset=${offset}`,
      { credentials: "include" }
    );
    if (res.status === 403) throw new Error("This user's follower list is private.");
    if (!res.ok) throw new Error("Failed to load followers.");
    return (await res.json()) as FollowListResponse;
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    setLoading(true);
    setError(null);
    loadUserId()
      .then((uid) => {
        if (!uid) { setError("User not found."); return; }
        setUserId(uid);
        return loadFollowers(uid, 0);
      })
      .then((data) => {
        if (!data) return;
        setUsers(data.users);
        setTotal(data.total);
        const alreadyFollowing = new Set(data.users.filter((u) => u.is_following_back).map((u) => u.id));
        setFollowing(alreadyFollowing);
      })
      .catch((err: unknown) => setError(getApiErrorMessage(err, "Could not load followers.")))
      .finally(() => setLoading(false));
  }, [session, loadUserId, loadFollowers]);

  const loadMore = async () => {
    if (!userId) return;
    const offset = (page + 1) * limit;
    setPage((p) => p + 1);
    const data = await loadFollowers(userId, offset).catch(() => null);
    if (data) setUsers((prev) => [...prev, ...data.users]);
  };

  const toggleFollow = async (targetId: string) => {
    const isFollowing = following.has(targetId);
    setFollowing((prev) => {
      const next = new Set(prev);
      if (isFollowing) next.delete(targetId); else next.add(targetId);
      return next;
    });
    await fetch(`${API_BASE}/profile/following${isFollowing ? `/${targetId}` : ""}`, {
      method: isFollowing ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: isFollowing ? undefined : JSON.stringify({ userId: targetId }),
    }).catch(() => {
      setFollowing((prev) => {
        const next = new Set(prev);
        if (isFollowing) next.add(targetId); else next.delete(targetId);
        return next;
      });
    });
  };

  return (
    <div className="route-lock-dock">
      <div className="route-lock-frame glass card">
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link className="button" href={`/profile/${username}`}>← @{username}</Link>
            <h1 style={{ margin: 0, fontSize: "1.3rem" }}>Followers {total > 0 && <span style={{ fontSize: "1rem", color: "var(--muted)", fontWeight: 400 }}>({total})</span>}</h1>
          </div>

          {loading && <StateCard title="Loading followers…" description="Fetching follower list." />}
          {error && <StateCard title="Error" description={error} tone="danger" />}

          {!loading && !error && users.length === 0 && (
            <StateCard title="No followers yet" description={`@${username} doesn't have any followers yet.`} />
          )}

          {users.map((user) => (
            <div key={user.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(54,45,30,0.06)" }}>
              <div className="avatar avatar--sm" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {user.username ? (
                  <Link href={`/profile/${user.username}`} style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                    @{user.username}
                  </Link>
                ) : (
                  <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--muted)" }}>Unknown</span>
                )}
                {user.school_name && (
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--muted)" }}>{user.school_name}</p>
                )}
              </div>
              {session && user.id !== (session as { user?: { id?: string } }).user?.id && (
                <button
                  className="button"
                  style={{ fontSize: "0.8rem", padding: "5px 12px" }}
                  onClick={() => toggleFollow(user.id)}
                >
                  {following.has(user.id) ? "Unfollow" : "Follow back"}
                </button>
              )}
            </div>
          ))}

          {users.length < total && (
            <button className="button" onClick={loadMore} style={{ marginTop: 8 }}>
              Load more
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
