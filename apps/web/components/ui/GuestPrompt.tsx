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
      <Link href={`/onboarding?returnUrl=${returnUrl}`} className={styles.compactBtn}>
        <span className={styles.lock} aria-hidden="true">🔒</span> Sign up to {reason} →
      </Link>
    );
  }

  return (
    <div className={styles.card}>
      <p className={styles.title}>Create an account to {reason}</p>
      <p className={styles.sub}>It takes 2 minutes. No credit card.</p>
      <Link href={`/onboarding?returnUrl=${returnUrl}`} className="button prestigious-shine">
        Join free →
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
