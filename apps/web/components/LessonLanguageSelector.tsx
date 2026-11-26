"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/locale";

/**
 * Lets a learner choose the language their LESSON CONTENT is generated/served in
 * (distinct from the UI locale). Preference is stored in the LESSON_LANGUAGE cookie
 * (set via /api/lesson-language), which the Server Component learn page reads to pick
 * lesson.<lang>.json. Falls back to lesson.json when a language variant isn't generated.
 */
export function LessonLanguageSelector({ current }: { current: Locale }) {
  const router = useRouter();
  const [value, setValue] = useState<Locale>(current);
  const [saving, setSaving] = useState(false);

  async function onChange(next: Locale) {
    setValue(next);
    setSaving(true);
    try {
      await fetch("/api/lesson-language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: next }),
      });
      router.refresh();
    } catch {
      // Non-fatal: preference is kept client-side; refresh will reconcile.
    } finally {
      setSaving(false);
    }
  }

  return (
    <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 13 }}>
      <span aria-hidden>🌐</span>
      <span>Lesson language:</span>
      <select
        value={value}
        disabled={saving}
        onChange={(e) => onChange(e.target.value as Locale)}
        aria-label="Lesson content language"
        style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border, #333)" }}
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_NAMES[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
