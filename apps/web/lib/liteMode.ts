export const LITE_MODE_STORAGE_KEY = "saedu-lite-mode";
export const LITE_MODE_SUGGESTED_KEY = "saedu-lite-mode-suggested";
export const LITE_MODE_EVENT = "saedu-lite-mode-change";

export function getStoredLiteMode() {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(LITE_MODE_STORAGE_KEY);
  if (stored === null) return null;
  return stored === "true";
}

export function setStoredLiteMode(enabled: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LITE_MODE_STORAGE_KEY, String(enabled));
  window.document.documentElement.classList.toggle("lite-mode", enabled);
  window.dispatchEvent(new CustomEvent(LITE_MODE_EVENT, { detail: enabled }));
}

export function isLiteModeEnabled() {
  if (typeof window === "undefined") return false;
  return window.document.documentElement.classList.contains("lite-mode");
}
