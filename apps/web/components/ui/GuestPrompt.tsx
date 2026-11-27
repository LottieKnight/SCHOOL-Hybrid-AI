"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/components/SessionProvider";
import styles from "./GuestPrompt.module.css";

type GuestPromptProps = {
  reason: string;
  compact?: boolean;
};

export function GuestPrompt({ reason, compact = false }: GuestPromptProps) {
  const { authState } = useSession();
  const pathname = usePathname();
  const returnUrl = encodeURIComponent(pathname ?? "/");

  if (!authState.isGuest) return null;

  if (compact) {
    return (
      <Link href={`/settings?returnUrl=${returnUrl}`} className={styles.compactBtn}>
        <span className={styles.lock} aria-hidden="true">•</span> Save a profile to {reason}
      </Link>
    );
  }

  return (
    <div className={styles.card}>
      <p className={styles.title}>Save a profile to {reason}</p>
      <p className={styles.sub}>Optional. You can keep going without an account.</p>
      <Link href="/settings" className="button prestigious-shine">
        Set up profile
      </Link>
      <p className={styles.signInRow}>
        Already have one?{" "}
        <Link href={`/auth?returnUrl=${returnUrl}`} className={styles.signInLink}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
