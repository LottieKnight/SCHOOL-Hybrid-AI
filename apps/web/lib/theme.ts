export type ThemeId =
  | "scholar"
  | "default"
  | "foundation"
  | "intermediate"
  | "university"
  | "light";

const STORAGE_KEY = "school:theme";
const VALID_THEMES: ThemeId[] = [
  "scholar",
  "default",
  "foundation",
  "intermediate",
  "university",
  "light",
];

export function applyTheme(id: ThemeId): void {
  document.documentElement.setAttribute("data-theme", id);
  localStorage.setItem(STORAGE_KEY, id);
}

export function loadSavedTheme(): void {
  const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
  if (saved && VALID_THEMES.includes(saved)) {
    document.documentElement.setAttribute("data-theme", saved);
  } else {
    document.documentElement.setAttribute("data-theme", "scholar");
  }
}

export function getCurrentTheme(): ThemeId {
  return (document.documentElement.getAttribute("data-theme") as ThemeId) ?? "scholar";
}