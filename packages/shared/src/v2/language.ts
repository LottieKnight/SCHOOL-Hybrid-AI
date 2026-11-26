// Native multi-language lesson generation support.
// All 11 official South African text languages. SASL is visual — excluded.
// Lessons are generated NATIVELY in the target language (the LLM writes the content
// directly), not machine-translated after the fact — this preserves pedagogical
// quality and mother-tongue learning benefits.

export const LESSON_LANGUAGES = [
  "en",
  "zu",
  "xh",
  "af",
  "st",
  "tn",
  "nso",
  "ts",
  "ss",
  "ve",
  "nr",
] as const;

export type LessonLanguage = (typeof LESSON_LANGUAGES)[number];

export const DEFAULT_LESSON_LANGUAGE: LessonLanguage = "en";

export const LESSON_LANGUAGE_NAMES: Record<LessonLanguage, string> = {
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

export function isLessonLanguage(value: unknown): value is LessonLanguage {
  return typeof value === "string" && (LESSON_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Returns a prompt directive that instructs the LLM to write the lesson natively in
 * the target language. For English it's empty (default). Always includes a glossary
 * safeguard so CAPS/technical terms without a standard equivalent stay in English.
 */
export function languageDirective(language: LessonLanguage | undefined): string {
  if (!language || language === "en") return "";
  const name = LESSON_LANGUAGE_NAMES[language];
  return [
    `Write the ENTIRE lesson natively in ${name} (${language}). This is for mother-tongue`,
    `South African learners in Grade R-12 — natural, age-appropriate ${name} with correct`,
    `spelling and grammar.`,
    `- Do NOT translate word-for-word from English; express concepts in fluent ${name}.`,
    `- For curriculum/technical terms with no widely-established ${name} equivalent (e.g.`,
    `  specific CAPS terminology, proper nouns, formulas), keep the English term in`,
    `  parentheses on first use.`,
    `- All headings, explanations, examples, practice, and quiz questions must be in ${name}.`,
  ].join("\n");
}
