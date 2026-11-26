"use client";

import { useEffect, useState } from "react";
import { applyTheme, getCurrentTheme, loadSavedTheme } from "@/lib/theme";

export function DarkLightToggle({ className = "" }: { className?: string }) {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    loadSavedTheme();
    setIsLight(getCurrentTheme() === "light");

    const observer = new MutationObserver(() => {
      setIsLight(getCurrentTheme() === "light");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const toggle = () => {
    const next = isLight ? "scholar" : "light";
    applyTheme(next);
    setIsLight(!isLight);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      className={["sidebar-item", "skeu-btn-ghost", className].filter(Boolean).join(" ")}
      style={{ display: "flex", alignItems: "center", gap: "8px" }}
    >
      <span className="sidebar-link__meta">
        <span className="side-icon" aria-hidden="true" style={{ fontSize: "16px" }}>
          {isLight ? "☀" : "☾"}
        </span>
        <span>{isLight ? "Light mode" : "Dark mode"}</span>
      </span>
    </button>
  );
}
