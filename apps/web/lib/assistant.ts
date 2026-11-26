export type AssistantMode = "explain" | "quiz" | "mixed";

type UpstreamErrorPayload = {
  error?: {
    code?: string;
    type?: string;
    message?: string;
  };
};

const QUESTION_STARTERS =
  /^(what|why|how|when|where|who|which|can|could|would|should|is|are|do|does|did|define|explain|compare|describe|calculate|solve|summarise|summarize|list|outline|discuss|evaluate|analyse|analyze|prove|name|state|identify|generate|create)\b/i;

function getQuestionWords(value: string) {
  return value.match(/[A-Za-z0-9']+/g) ?? [];
}

export function isSpecificStudyQuestion(value: string) {
  const trimmed = value.trim();
  if (trimmed.length < 12) return false;

  const words = getQuestionWords(trimmed);
  if (words.length < 3) return false;

  return trimmed.includes("?") || QUESTION_STARTERS.test(trimmed);
}

export function getAssistantValidationError(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Body must include a non-empty 'material' string.";
  }

  if (trimmed.length >= 25 || isSpecificStudyQuestion(trimmed)) {
    return null;
  }

  return "Please paste at least a sentence of notes or a specific question.";
}

function parseUpstreamError(bodyText: string) {
  try {
    return JSON.parse(bodyText) as UpstreamErrorPayload;
  } catch {
    return null;
  }
}

export function mapAssistantUpstreamError(status: number, bodyText: string) {
  const parsed = parseUpstreamError(bodyText);
  const upstreamCode = parsed?.error?.code || parsed?.error?.type || "";
  const upstreamMessage = parsed?.error?.message || "";
  const details = `${upstreamCode} ${upstreamMessage}`.toLowerCase();

  if (status === 429 && /quota|billing|insufficient_quota/.test(details)) {
    return {
      status: 503,
      error: "The study assistant is temporarily unavailable because the AI quota is exhausted.",
    };
  }

  if (status === 429) {
    return {
      status: 503,
      error: "The study assistant is currently rate-limited. Please try again shortly.",
    };
  }

  if (status === 401 || status === 403) {
    return {
      status: 502,
      error: "The study assistant could not authenticate with the AI provider.",
    };
  }

  if (status >= 500) {
    return {
      status: 502,
      error: "The AI provider is temporarily unavailable. Please try again shortly.",
    };
  }

  return {
    status: 502,
    error: "The study assistant could not complete the request. Please try again shortly.",
  };
}

export function buildAssistantModeInstruction(mode: AssistantMode) {
  if (mode === "explain") {
    return `You are in EXPLAIN mode.

Return STRICT JSON with this shape:
{
  "explanation": "detailed explanation",
  "summary": "short bullet-style or paragraph summary",
  "quiz": {
    "questions": []
  }
}

Where "quiz.questions" is always an empty array in this mode. Do not include extra fields.`;
  }

  if (mode === "quiz") {
    return `You are in QUIZ mode.

Return STRICT JSON with this shape:
{
  "explanation": "",
  "summary": "",
  "quiz": {
    "questions": [
      { "question": "...", "answer": "..." }
    ]
  }
}

Create 5-10 questions and answers based ONLY on the student's material. Leave "explanation" and "summary" as empty strings. Do not include extra fields.`;
  }

  return `You are in MIXED mode.

Return STRICT JSON with this shape:
{
  "explanation": "detailed explanation",
  "summary": "short bullet-style or paragraph summary",
  "quiz": {
    "questions": [
      { "question": "...", "answer": "..." }
    ]
  }
}

Create 5-10 questions and answers based ONLY on the student's material. Do not include extra fields.`;
}

// Builds a system prompt block instructing the LLM to respond in a specific SA language.
// languageName is the human-readable name resolved from SA_LANGUAGES (e.g. "isiZulu").
// For low-resource languages, we allow English fallback for technical terms that lack
// established equivalents — without this caveat the model hallucinates terminology.
export function buildLanguageInstruction(languageName: string): string {
  if (!languageName || languageName === "English") return "";
  return `LANGUAGE: Respond entirely in ${languageName}. Use ${languageName} for all explanations, examples, and questions. Academic or scientific terms may remain in English only when no established ${languageName} equivalent exists — in that case, write the English term in brackets after the ${languageName} equivalent.`.trim();
}
