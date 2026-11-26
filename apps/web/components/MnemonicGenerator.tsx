"use client";

import { useState } from "react";
import styles from "./MnemonicGenerator.module.css";
import { Button } from "@/components/ui/Button";

type Props = {
  terms: string[];
};

export function MnemonicGenerator({ terms }: Props) {
  const [loading, setLoading] = useState(false);
  const [mnemonic, setMnemonic] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/assistant/mnemonics", {
        method: "POST",
        body: JSON.stringify({ terms }),
      });
      const data = await res.json();
      setMnemonic(data.mnemonic);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {!mnemonic && (
        <Button variant="outline" size="sm" onClick={generate} disabled={loading}>
          {loading ? "Generating..." : "Generate Mnemonic 🧠"}
        </Button>
      )}
      {mnemonic && (
        <div className={styles.result}>
          <div className={styles.header}>
             <span className={styles.label}>Memory Aid</span>
             <button className={styles.close} onClick={() => setMnemonic(null)}>✕</button>
          </div>
          <p className={styles.text}>{mnemonic}</p>
        </div>
      )}
    </div>
  );
}
