"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/components/SessionProvider";
import { StateCard } from "@/components/ui/StateCard";
import { MusicStudentCard } from "@/components/MusicStudentCard";
import { API_BASE } from "@/lib/apiBase";
import type { MusicDiscoveryRecord } from "@/lib/musicConstants";
import styles from "./page.module.css";

const PAGE_SIZE = 12;

type DiscoverResponse = {
  results: MusicDiscoveryRecord[];
  match: string;
  limit: number;
  offset: number;
};

type ApiErrorResponse = {
  error: string;
};

function isErrorResponse(data: unknown): data is ApiErrorResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof (data as ApiErrorResponse).error === "string"
  );
}

export default function CommunityMusicPage() {
  const { session, loading: sessionLoading } = useSession();
  const searchParams = useSearchParams();
  const initialMatch = useMemo(
    () => (searchParams.get("match") === "different" ? "different" : "similar") as "similar" | "different",
    [searchParams]
  );

  const [results, setResults] = useState<MusicDiscoveryRecord[]>([]);
  const [match, setMatch] = useState<"similar" | "different">(initialMatch);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = useCallback(
    async (currentMatch: "similar" | "different", currentOffset: number, append: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_BASE}/community/music/discover?match=${currentMatch}&limit=${PAGE_SIZE}&offset=${currentOffset}`,
          { credentials: "include" }
        );
        if (!res.ok && !res.headers.get("content-type")?.includes("application/json")) {
          setError("Failed to load results.");
          return;
        }
        const data: unknown = await res.json();

        if (isErrorResponse(data)) {
          setError(data.error);
          return;
        }

        const typed = data as DiscoverResponse;
        const incoming = typed.results ?? [];

        if (append) {
          setResults((prev) => [...prev, ...incoming]);
        } else {
          setResults(incoming);
        }
        setHasMore(incoming.length === PAGE_SIZE);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load results.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Initial fetch and whenever match changes
  useEffect(() => {
    if (sessionLoading || !session) return;
    setResults([]);
    setOffset(0);
    setHasMore(true);
    setError(null);
    fetchResults(match, 0, false);
  }, [match, session, sessionLoading, fetchResults]);

  const handleLoadMore = () => {
    const nextOffset = offset + PAGE_SIZE;
    setOffset(nextOffset);
    fetchResults(match, nextOffset, true);
  };

  const handleMatchChange = (newMatch: "similar" | "different") => {
    if (newMatch === match) return;
    setMatch(newMatch);
  };

  // Not logged in
  if (!sessionLoading && !session) {
    return (
      <main className={styles.page}>
        <StateCard
          title="Sign in to discover"
          description="You need an account to see music discovery."
        />
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Discover Music Matches</h1>
        <p className={styles.subtitle}>
          Find students who share — or contrast — your music taste.
        </p>
      </header>

      <div className={styles.toggleRow}>
        <button
          type="button"
          className={match === "similar" ? styles.toggleActive : styles.toggleGhost}
          onClick={() => handleMatchChange("similar")}
        >
          Similar tastes
        </button>
        <button
          type="button"
          className={match === "different" ? styles.toggleActive : styles.toggleGhost}
          onClick={() => handleMatchChange("different")}
        >
          Different tastes
        </button>
      </div>

      {error === "complete_your_music_profile" && (
        <div className={styles.emptyState}>
          <p>
            Set up your music identity on your profile to discover other students.
          </p>
          <Link href="/community" className={styles.emptyLink}>
            Go to Community →
          </Link>
        </div>
      )}

      {error !== null && error !== "complete_your_music_profile" && (
        <div className={styles.emptyState}>
          <p className={styles.errorText}>{error}</p>
        </div>
      )}

      {!error && (
        <>
          {results.length > 0 && (
            <div className={styles.grid}>
              {results.map((r) => (
                <MusicStudentCard key={r.user_id} record={r} />
              ))}
            </div>
          )}

          {!loading && results.length === 0 && (
            <div className={styles.emptyState}>
              <p>No students found. Try switching to a different match type.</p>
            </div>
          )}

          {loading && (
            <div className={styles.emptyState}>
              <p>Loading…</p>
            </div>
          )}

          {hasMore && results.length > 0 && (
            <div className={styles.loadMoreRow}>
              <button
                type="button"
                className={styles.loadMoreBtn}
                onClick={handleLoadMore}
                disabled={loading}
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
