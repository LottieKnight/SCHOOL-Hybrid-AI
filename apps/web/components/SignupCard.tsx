"use client";

import { useState } from "react";
import { SignupForm } from "./SignupForm";
import { useSession } from "./SessionProvider";
import styles from "../app/page.module.css";

export function SignupCard() {
  const [hidden, setHidden] = useState(false);
  const { session, loading } = useSession();

  if (hidden || loading || session) {
    return null;
  }

  return (
    <div className={`${styles.signupCard} glass card`}>
      <h2 className={styles.cardTitle}>Sign up</h2>
      <p className="subtitle">Get early access to updates, resources, and new content drops.</p>

      <SignupForm onSuccess={() => setHidden(true)} />
    </div>
  );
}
