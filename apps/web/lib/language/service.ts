import type {
  AnalyzeRequest,
  AnalyzeResponse,
  CorrectRequest,
  CorrectResponse,
  FeedbackRequest,
  FeedbackResponse,
  GlossaryLookupRequest,
  GlossaryLookupResponse,
  IntentType,
  RewriteMode,
  RewriteRequestPayload,
  RewriteResponsePayload,
  SearchRequest,
  SearchResponse,
  SourceRef,
} from '@/lib/language/types';
import {
  seedCorrectionCandidates,
  seedGlossaryTerms,
  seedKnowledgeSnippets,
  seedLanguages,
} from '@/lib/language/seed';

const shorthandMap: Record<string, string> = {
  pls: 'please',
  u: 'you',
  cant: 'cannot',
  im: 'i am',
  nwu: 'North-West University',
};

const languageHints = {
  zu: ['ngicela', 'usizo', 'umfundi', 'imali', 'ngabe', 'yini'],
  tn: ['thuso', 'tsamaiso', 'akhaonto', 'madi', 'morutwana'],
};

const intentHints: Array<{ intent: IntentType; terms: string[] }> = [
  { intent: 'admin_help', terms: ['nsfas', 'financial hold', 'student portal', 'efundi', 'register', 'registration'] },
  { intent: 'concept_explanation', terms: ['explain', 'what is', 'meaning', 'define', 'understand'] },
  { intent: 'writing_help', terms: ['rewrite', 'fix grammar', 'grammar', 'essay', 'assignment', 'academic tone'] },
  { intent: 'academic_search', terms: ['gdp', 'inflation', 'repo rate', 'opportunity cost', 'is-lm', 'econ211'] },
];

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyShorthand(text: string): string {
  return text
    .split(/\b/)
    .map((token) => {
      const key = token.toLowerCase();
      return shorthandMap[key] ?? token;
    })
    .join('');
}

function normalizeText(text: string): string {
  return normalizeWhitespace(applyShorthand(text));
}

function detectLanguages(text: string) {
  const lowered = text.toLowerCase();
  const matches = [
    { code: 'zu', confidence: languageHints.zu.some((w) => lowered.includes(w)) ? 0.76 : 0 },
    { code: 'tn', confidence: languageHints.tn.some((w) => lowered.includes(w)) ? 0.72 : 0 },
  ].filter((entry) => entry.confidence > 0);

  if (matches.length === 0) return [{ code: 'en', confidence: 0.91 }];

  if (/\b(explain|what|assignment|help|register|portal|cost|inflation)\b/i.test(text)) {
    matches.unshift({ code: 'en', confidence: 0.68 });
  }

  return matches;
}

function detectIntent(text: string): IntentType {
  const lowered = text.toLowerCase();
  for (const hint of intentHints) {
    if (hint.terms.some((term) => lowered.includes(term))) return hint.intent;
  }
  return 'general';
}

function calcCodeSwitchScore(languages: Array<{ code: string; confidence: number }>) {
  if (languages.length <= 1) return 0.05;
  const nonZero = languages.filter((entry) => entry.confidence > 0.1).length;
  return Math.min(0.95, 0.35 + nonZero * 0.2);
}

function titleCaseAcronymAware(text: string): string {
  return text
    .replace(/\befundi\b/gi, 'eFundi')
    .replace(/\bnsfas\b/gi, 'NSFAS')
    .replace(/\bnwu\b/gi, 'North-West University')
    .replace(/\becon\s*211\b/gi, 'ECON211')
    .replace(/\bislm\b/gi, 'IS-LM');
}

function sentenceCase(text: string): string {
  const trimmed = normalizeWhitespace(text);
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function grammarFix(text: string): string {
  let out = normalizeText(text);
  out = titleCaseAcronymAware(out);
  out = sentenceCase(out);
  if (!/[.!?]$/.test(out)) out += '.';
  return out;
}

function simplerEnglish(text: string): string {
  let out = normalizeText(text);
  out = out.replace(/forgone/gi, 'given up').replace(/alternative/gi, 'option');
  out = titleCaseAcronymAware(out);
  out = sentenceCase(out);
  if (!/[.!?]$/.test(out)) out += '.';
  return out;
}

function rewriteAcademic(text: string): string {
  let out = normalizeText(text);
  out = out.replace(/\blike\b/gi, '');
  out = out.replace(/\bwhat you leave\b/gi, 'the value of the next best alternative forgone');
  out = out.replace(/\bwhat you lose\b/gi, 'the value of the next best alternative forgone');
  out = out.replace(/\bthing\b/gi, 'option');
  out = titleCaseAcronymAware(out);
  out = sentenceCase(out);
  if (!/[.!?]$/.test(out)) out += '.';
  return out;
}

function bilingualExplain(text: string): string {
  const glossary = seedGlossaryTerms.find((term) => term.canonicalTerm.toLowerCase() === text.toLowerCase());
  if (!glossary) return simplerEnglish(text);
  return `${glossary.plainDefinition} In simple terms: this is the idea in plain student-friendly language.`;
}

export function analyzeLanguage(input: AnalyzeRequest): AnalyzeResponse {
  const normalizedText = normalizeText(input.text);
  const languages = detectLanguages(normalizedText);
  const intent = detectIntent(normalizedText);
  const domain = input.moduleCode === 'ECON211' || /\b(gdp|inflation|repo rate|opportunity cost|is-lm)\b/i.test(normalizedText)
    ? 'economics'
    : intent === 'admin_help'
      ? 'student-services'
      : 'general';

  return {
    normalizedText,
    languages,
    codeSwitchScore: calcCodeSwitchScore(languages),
    intent,
    domain,
    confidence: 0.84,
  };
}

export function correctText(input: CorrectRequest): CorrectResponse {
  const originalText = input.text;
  const normalized = normalizeText(input.text);
  const changes: CorrectResponse['suggestions'][number]['changes'] = [];

  let corrected = normalized;
  for (const candidate of seedCorrectionCandidates) {
    const pattern = new RegExp(`\\b${escapeRegExp(candidate.incorrectForm)}\\b`, 'gi');
    if (pattern.test(corrected)) {
      corrected = corrected.replace(pattern, candidate.correctedForm);
      changes.push({
        from: candidate.incorrectForm,
        to: candidate.correctedForm,
        type: candidate.correctionType,
      });
    }
  }

  corrected = sentenceCase(titleCaseAcronymAware(corrected));
  if (!/[.!?]$/.test(corrected)) corrected += '.';

  return {
    originalText,
    suggestions: [{ text: corrected, confidence: changes.length ? 0.9 : 0.72, changes }],
  };
}

export function rewriteText(input: RewriteRequestPayload): RewriteResponsePayload {
  const modeHandlers: Record<RewriteMode, (text: string) => string> = {
    grammar_fix: grammarFix,
    simpler_english: simplerEnglish,
    academic_tone: rewriteAcademic,
    concise: (text) => sentenceCase(titleCaseAcronymAware(normalizeText(text))),
    bilingual_explain: bilingualExplain,
  };

  const output = modeHandlers[input.mode](input.text);

  return {
    outputs: [{ text: output, confidence: 0.86, notes: ['seed-backed v1 rewrite', `mode=${input.mode}`] }],
  };
}

export function searchLanguage(input: SearchRequest): SearchResponse {
  const normalizedQuery = normalizeText(input.query);
  const analysis = analyzeLanguage({ text: input.query, surface: input.surface, moduleCode: input.moduleCode });
  const lowered = normalizedQuery.toLowerCase();

  const expansions = new Set<string>();
  if (lowered.includes('nsfas')) {
    expansions.add('financial hold');
    expansions.add('registration blocked');
    expansions.add('student finances');
  }
  if (lowered.includes('econ211') || lowered.includes('opportunity cost') || lowered.includes('inflation')) {
    expansions.add('economics');
    expansions.add('study guide');
    expansions.add('module concepts');
  }
  if (lowered.includes('portal')) expansions.add('student portal');
  if (lowered.includes('efundi')) expansions.add('learning management system');

  const results = seedKnowledgeSnippets
    .filter((snippet) => {
      const hay = `${snippet.title} ${snippet.domain} ${snippet.text}`.toLowerCase();
      return lowered.split(' ').some((token) => token.length > 2 && hay.includes(token))
        || Array.from(expansions).some((item) => hay.includes(item.toLowerCase()));
    })
    .map((snippet, index) => ({
      title: snippet.title,
      sourceType: snippet.sourceType,
      sourceId: `seed:${index + 1}`,
      snippet: snippet.text,
      score: Math.max(0.72, 0.94 - index * 0.08),
    }));

  return {
    normalizedQuery,
    intent: analysis.intent,
    expansions: Array.from(expansions),
    results,
  };
}

export function lookupGlossary(input: GlossaryLookupRequest): GlossaryLookupResponse {
  const match = seedGlossaryTerms.find((term) => {
    const byTerm = term.canonicalTerm.toLowerCase() === input.term.toLowerCase();
    const byModule = !input.moduleCode || term.moduleCode === input.moduleCode;
    return byTerm && byModule;
  });

  if (!match) {
    return {
      canonicalTerm: input.term,
      plainDefinition: 'No glossary match yet in the starter seed pack.',
      relatedTerms: [],
    };
  }

  const relatedTerms = seedGlossaryTerms
    .filter((term) => term.id !== match.id && term.domain === match.domain)
    .slice(0, 3)
    .map((term) => term.canonicalTerm);

  return {
    canonicalTerm: match.canonicalTerm,
    plainDefinition: match.plainDefinition,
    localizedExplanation: input.targetLanguage && input.targetLanguage !== 'en'
      ? { language: input.targetLanguage, text: 'Localized explanation available in the seed data expansion path.' }
      : undefined,
    relatedTerms,
  };
}

export function explainConcept(input: { text: string; moduleCode?: string; targetStyle: 'plain_language' | 'academic' | 'bilingual'; targetLanguage?: string }) {
  const glossary = lookupGlossary({ term: input.text, moduleCode: input.moduleCode, targetLanguage: input.targetLanguage });
  const sourceRefs: SourceRef[] = glossary.plainDefinition !== 'No glossary match yet in the starter seed pack.'
    ? [{ type: 'glossary', id: glossary.canonicalTerm }]
    : [];

  return {
    term: glossary.canonicalTerm,
    explanation:
      input.targetStyle === 'academic'
        ? seedGlossaryTerms.find((item) => item.canonicalTerm === glossary.canonicalTerm)?.academicDefinition ?? glossary.plainDefinition
        : glossary.plainDefinition,
    relatedTerms: glossary.relatedTerms,
    sourceRefs,
  };
}

export function submitFeedback(_input: FeedbackRequest): FeedbackResponse {
  return { ok: true };
}

export const languageSeedMetadata = {
  languages: seedLanguages.map((item) => item.code),
  glossaryTerms: seedGlossaryTerms.length,
  correctionCandidates: seedCorrectionCandidates.length,
  knowledgeSnippets: seedKnowledgeSnippets.length,
};
