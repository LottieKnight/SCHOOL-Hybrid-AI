"use client";

import { useState } from "react";
import styles from "./RaiseHandButton.module.css";

export function RaiseHandButton() {
  const [raised, setRaised] = useState(false);

  const toggle = () => {
    setRaised(!raised);
    // In a real app, this would publish an SSE event or update DB presence
  };

  return (
    <button className={styles.btn} data-active={raised} onClick={toggle}>
      <span className={styles.icon}>{raised ? "✋" : "🤚"}</span>
      <span>{raised ? "Lower Hand" : "Raise Hand (Need Help)"}</span>
    </button>
  );
}
