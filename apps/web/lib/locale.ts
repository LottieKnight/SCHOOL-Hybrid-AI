// Single source of truth for supported UI locales.
// All 11 official South African text languages (SASL is visual — excluded).
export const LOCALES = ["en", "zu", "xh", "af", "st", "tn", "nso", "ts", "ss", "ve", "nr"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  zu: "isiZulu",
  xh: "isiXhosa",
  af: "Afrikaans",
  st: "Sesotho",
  tn: "Setswana",
  nso: "Sepedi",
  ts: "Xitsonga",
  ss: "siSwati",
  ve: "Tshivenda",
  nr: "isiNdebele",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
