"use client";

import { useEffect, useState } from "react";
import styles from "./ThemePicker.module.css";

const THEMES = [
  { id: "scholar", name: "Scholar Gold", colors: ["#0a0a0a", "#e8c15a"] },
  { id: "obsidian", name: "Obsidian Dark", colors: ["#0d0d0d", "#f0f0f0"] },
  { id: "vanta", name: "Vanta Red", colors: ["#000000", "#ff0000"] },
];

export function ThemePicker() {
  const [currentTheme, setCurrentTheme] = useState("scholar");

  useEffect(() => {
    const saved = localStorage.getItem("saedu_theme") ?? "scholar";
    setCurrentTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  const setTheme = (themeId: string) => {
    setCurrentTheme(themeId);
    localStorage.setItem("saedu_theme", themeId);
    document.documentElement.setAttribute("data-theme", themeId);
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Visual Theme</h3>
      <div className={styles.grid}>
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            type="button"
            className={styles.themeBtn}
            data-active={currentTheme === theme.id}
            onClick={() => setTheme(theme.id)}
          >
            <div className={styles.preview} style={{ background: theme.colors[0] }}>
              <div className={styles.accent} style={{ background: theme.colors[1] }} />
            </div>
            <span>{theme.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
