"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getApiErrorMessage } from "@/lib/apiBase";
import { StateCard } from "@/components/ui/StateCard";
import styles from "./page.module.css";

type CircleDetail = {
  id: string; name: string; module_code: string | null;
  description: string | null; is_public: boolean;
  invite_code: string; max_members: number; member_count: string;
};

type Member = {
  user_id: string; username: string | null; avatar_uniform: unknown; joined_at: string;
};

type CircleResponse = {
  circle: CircleDetail;
  members: Member[];
  isMember: boolean;
  isOwner: boolean;
};

export default function CircleDetailPage() {
  const { circleId } = useParams<{ circleId: string }>();
  const router = useRouter();
  const [data, setData] = useState<CircleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/community/circles/${circleId}`, { credentials: "include" });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setError(err.error ?? "Failed to load circle.");
        return;
      }
      setData(await res.json() as CircleResponse);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to load circle."));
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => { load(); }, [load]);

  const copyInvite = async () => {
    if (!data) return;
    const url = `${window.location.origin}/community/circles?invite=${data.circle.invite_code}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const leave = async () => {
    if (!confirm("Leave this circle?")) return;
    const res = await fetch(`/api/community/circles/${circleId}/leave`, {
      method: "DELETE", credentials: "include",
    });
    if (res.ok) router.push("/community/circles");
    else {
      const err = (await res.json()) as { error?: string };
      setNotice(err.error ?? "Could not leave circle.");
    }
  };

  if (loading) return (
    <div className="route-lock-dock">
      <div className="route-lock-frame glass card">
        <StateCard title="Loading circle…" description="Fetching circle details and members." />
      </div>
    </div>
  );

  if (error) return (
    <div className="route-lock-dock">
      <div className="route-lock-frame glass card">
        <StateCard title="Error" description={error} tone="danger" />
        <Link className="button" href="/community/circles" style={{ marginTop: 12 }}>← Circles</Link>
      </div>
    </div>
  );

  if (!data) return null;

  const { circle, members, isMember, isOwner } = data;

  return (
    <div className="route-lock-dock">
      <div className="route-lock-frame glass card">
        <div className={styles.header}>
          <Link className="button" href="/community/circles">← Circles</Link>
          <h1>{circle.name}</h1>
          <div className={styles.headerMeta}>
            {circle.module_code && <span>{circle.module_code}</span>}
            <span>{circle.member_count} / {circle.max_members} members</span>
            <span>{circle.is_public ? "Public" : "Private"}</span>
          </div>
          {circle.description && <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>{circle.description}</p>}
        </div>

        {isMember && (
          <div className={styles.inviteRow}>
            <span className={styles.inviteCode}>{circle.invite_code}</span>
            <button className="button" style={{ fontSize: "0.78rem", padding: "4px 10px" }} onClick={copyInvite}>
              {copied ? "Copied!" : "Copy invite link"}
            </button>
          </div>
        )}

        {notice && (
          <p style={{ color: "var(--red, #dc2626)", fontSize: "0.82rem", marginBottom: 12 }}>{notice}</p>
        )}

        <div className={styles.section}>
          <p className={styles.sectionTitle}>Members ({circle.member_count})</p>
          <div className={styles.memberList}>
            {members.map((m) => (
              <Link
                key={m.user_id}
                href={m.username ? `/profile/${m.username}` : "#"}
                className={`${styles.memberChip}${m.user_id === (data as { userId?: string }).userId ? ` ${styles.memberChipSelf}` : ""}`}
              >
                @{m.username ?? "user"}
              </Link>
            ))}
          </div>
        </div>

        {isMember && (
          <div className={styles.actions}>
            {!isOwner && (
              <button className="button" style={{ color: "var(--red, #dc2626)" }} onClick={leave}>
                Leave circle
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
