export declare const LESSON_LANGUAGES: readonly ["en", "zu", "xh", "af", "st", "tn", "nso", "ts", "ss", "ve", "nr"];
export type LessonLanguage = (typeof LESSON_LANGUAGES)[number];
export declare const DEFAULT_LESSON_LANGUAGE: LessonLanguage;
export declare const LESSON_LANGUAGE_NAMES: Record<LessonLanguage, string>;
export declare function isLessonLanguage(value: unknown): value is LessonLanguage;
/**
 * Returns a prompt directive that instructs the LLM to write the lesson natively in
 * the target language. For English it's empty (default). Always includes a glossary
 * safeguard so CAPS/technical terms without a standard equivalent stay in English.
 */
export declare function languageDirective(language: LessonLanguage | undefined): string;
//# sourceMappingURL=language.d.ts.map