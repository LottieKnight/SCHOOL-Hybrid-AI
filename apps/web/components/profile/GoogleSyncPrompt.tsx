"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/SessionProvider";
import type { GoogleAccount } from "@/lib/firebaseGoogleAuth";
import styles from "./minimalProfile.module.css";

async function rememberGoogleProfile(account: GoogleAccount, csrfToken?: string | null) {
  const { persistGoogleAccount } = await import("@/lib/persistGoogleAccount");
  await persistGoogleAccount(account, csrfToken);
}

export function GoogleSyncPrompt({ compact = false }: { compact?: boolean }) {
  const { session } = useSession();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onGoogle = async () => {
    if (pending) return;
    setPending(true);
    setMessage(null);
    const { continueWithGoogle } = await import("@/lib/firebaseGoogleAuth");
    const result = await continueWithGoogle();
    if (!result.ok) {
      setMessage(result.message);
      setPending(false);
      return;
    }
    if (result.mode === "sign-in-redirect") return;
    await rememberGoogleProfile(result, session?.csrfToken);
    router.refresh();
    setPending(false);
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      const { completeGoogleRedirect } = await import("@/lib/firebaseGoogleAuth");
      const result = await completeGoogleRedirect();
      if (!active) return;
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      if (!result.account) return;
      await rememberGoogleProfile(result.account, session?.csrfToken);
      router.refresh();
    })();
    return () => {
      active = false;
    };
  }, [router, session?.csrfToken]);

  return (
    <div className={styles.sync} data-testid="google-sync-prompt">
      <p>{compact ? "Sign in with Google to sync across devices." : "Sign in with Google to keep this profile and your tutor history on every device."}</p>
      <div className={styles.actions}>
        <button className="button" type="button" onClick={() => void onGoogle()} disabled={pending}>
          {pending ? "Signing you in..." : "Continue with Google"}
        </button>
      </div>
      {message ? <p className={styles.error} role="alert">{message}</p> : null}
    </div>
  );
}
