"use client";

import { useState } from "react";
import styles from "./AudioPlayer.module.css";
import { Button } from "@/components/ui/Button";

type Props = {
  text: string;
};

export function AudioPlayer({ text }: Props) {
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    if (playing) {
      window.speechSynthesis.cancel();
      setPlaying(false);
    } else {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.onend = () => setPlaying(false);
      window.speechSynthesis.speak(utterance);
      setPlaying(true);
    }
  };

  return (
    <div className={styles.container}>
      <Button variant="outline" size="sm" onClick={toggle}>
        <span className={styles.icon}>{playing ? "⏸" : "🎧"}</span>
        <span>{playing ? "Pause Lesson" : "Listen to Lesson"}</span>
      </Button>
    </div>
  );
}
