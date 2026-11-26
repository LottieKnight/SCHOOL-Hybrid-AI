"use client";

import { useEffect, useMemo, useState } from "react";
import { applyTheme as applyInstitutionTheme, deriveInstitutionThemeId, resetTheme as resetInstitutionTheme } from "@/lib/institutionTheme";
import { applyTheme as applyShellTheme, getCurrentTheme, type ThemeId } from "@/lib/theme";

type ThemeToggleProps = {
  institutionSlug?: string | null;
  className?: string;
};

function readThemeLabel(theme: ThemeId, institutionSlug?: string | null) {
  if (theme === "university") {
    const institutionId = deriveInstitutionThemeId(institutionSlug);
    return institutionId === "default" ? "University Theme" : `${institutionId.toUpperCase()} Theme`;
  }
  return "Scholar Theme";
}

export function ThemeToggle({ institutionSlug = null, className = "" }: ThemeToggleProps) {
  const [theme, setTheme] = useState<ThemeId>("scholar");

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const syncTheme = () => {
      setTheme(getCurrentTheme());
    };

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    const handleStorage = () => syncTheme();
    window.addEventListener("storage", handleStorage);

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const nextTheme = theme === "university" ? "scholar" : "university";
  const label = useMemo(() => readThemeLabel(theme, institutionSlug), [theme, institutionSlug]);

  return (
    <button
      type="button"
      className={["sidebar-item", "skeu-btn-ghost", className].filter(Boolean).join(" ")}
      aria-label={`Switch to ${nextTheme === "university" ? "university" : "scholar"} theme`}
      onClick={() => {
        if (nextTheme === "university") {
          applyInstitutionTheme(institutionSlug ?? "default");
        } else {
          resetInstitutionTheme();
        }
        applyShellTheme(nextTheme);
        setTheme(nextTheme);
      }}
    >
      <span className="sidebar-link__meta">
        <span className="side-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M12 3.5 4.5 7v10L12 20.5 19.5 17V7L12 3.5Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <path d="M12 3.5v17M4.5 7 12 10.5 19.5 7" fill="none" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </span>
        <span>{`Theme · ${label}`}</span>
      </span>
    </button>
  );
}
