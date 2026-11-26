"use client";

import { useEffect, useState } from "react";
import styles from "./LivePresenceCounter.module.css";
import { useSession } from "@/components/SessionProvider";

type Props = {
  moduleCode: string;
};

export function LivePresenceCounter({ moduleCode }: Props) {
  const { isIdle } = useSession();
  const [count, setCount] = useState<number | null>(null);

  // Record presence once on mount — not idle-gated
  useEffect(() => {
    fetch("/api/community/presence", {
      method: "POST",
      body: JSON.stringify({ moduleCode }),
    }).catch(() => {});
  }, [moduleCode]);

  // Poll count every 30s — pauses when idle
  useEffect(() => {
    if (isIdle) return;
    const fetchCount = () => {
      fetch(`/api/community/presence?moduleCode=${moduleCode}`)
        .then(res => res.json())
        .then(data => setCount(data.count))
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => clearInterval(interval);
  }, [isIdle, moduleCode]);

  if (count === null || count < 1) return null;

  return (
    <div className={styles.container}>
      <span className={styles.dot} />
      <span className={styles.text}>
        {count} {count === 1 ? 'student' : 'students'} studying this now
      </span>
    </div>
  );
}
