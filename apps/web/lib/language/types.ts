export type UUID = string;

export type SourceSurface =
  | 'search'
  | 'writer'
  | 'tutor'
  | 'admin-assistant'
  | 'assignment-box'
  | 'keyboard';

export type RewriteMode =
  | 'grammar_fix'
  | 'simpler_english'
  | 'academic_tone'
  | 'concise'
  | 'bilingual_explain';

export type IntentType =
  | 'academic_search'
  | 'admin_help'
  | 'writing_help'
  | 'concept_explanation'
  | 'student_services'
  | 'general';

export type CorrectionType =
  | 'typo'
  | 'phonetic'
  | 'slang-normalization'
  | 'spacing'
  | 'normalization';

export type KnowledgeSourceType =
  | 'module'
  | 'guide'
  | 'admin'
  | 'policy'
  | 'faq'
  | 'glossary'
  | 'study-guide'
  | 'module-note'
  | 'admin-doc';

export type LanguageAnalysis = {
  normalizedText: string;
  languages: Array<{
    code: string;
    confidence: number;
  }>;
  codeSwitchScore: number;
  intent?: IntentType;
  domain?: string;
  confidence: number;
};

export type CorrectionChange = {
  from: string;
  to: string;
  type: CorrectionType;
};

export type CorrectionSuggestion = {
  text: string;
  confidence: number;
  changes: CorrectionChange[];
};

export type RewriteOutput = {
  text: string;
  confidence: number;
  notes?: string[];
};

export type SearchResult = {
  title: string;
  sourceType: KnowledgeSourceType | string;
  sourceId?: string;
  snippet: string;
  score: number;
};

export type SourceRef = {
  type: string;
  id: string;
};

export type AnalyzeRequest = {
  text: string;
  surface: SourceSurface;
  moduleCode?: string;
};

export type AnalyzeResponse = LanguageAnalysis;

export type CorrectRequest = {
  text: string;
  surface: SourceSurface;
  moduleCode?: string;
  mode?: 'suggest' | 'auto';
};

export type CorrectResponse = {
  originalText: string;
  suggestions: CorrectionSuggestion[];
};

export type RewriteRequestPayload = {
  text: string;
  mode: RewriteMode;
  surface: SourceSurface;
  moduleCode?: string;
  domain?: string;
};

export type RewriteResponsePayload = {
  outputs: RewriteOutput[];
};

export type ExplainRequest = {
  text: string;
  moduleCode?: string;
  targetStyle: 'plain_language' | 'academic' | 'bilingual';
  targetLanguage?: string;
};

export type ExplainResponse = {
  term: string;
  explanation: string;
  relatedTerms: string[];
  sourceRefs: SourceRef[];
  debug?: {
    strategy?: string;
    grounded?: boolean;
    sourceCount?: number;
  };
};

export type SearchRequest = {
  query: string;
  surface: SourceSurface;
  moduleCode?: string;
};

export type SearchResponse = {
  normalizedQuery: string;
  intent?: IntentType;
  expansions: string[];
  results: SearchResult[];
  debug?: {
    explicitModuleCode?: string | null;
    inferredModules?: Array<{
      moduleCode: string;
      confidence: number;
    }>;
    groundedResultCount?: number;
    fallbackResultCount?: number;
    strategy?: string;
    moduleBoost?: number;
    surfaceBoost?: number;
    moduleFeedbackBoost?: number;
    surfaceFeedbackBoost?: number;
  };
};

export type GlossaryLookupRequest = {
  term: string;
  moduleCode?: string;
  targetLanguage?: string;
};

export type GlossaryLookupResponse = {
  canonicalTerm: string;
  plainDefinition: string;
  localizedExplanation?: {
    language: string;
    text: string;
  };
  relatedTerms: string[];
};

export type FeedbackEventType =
  | 'rewrite_accept'
  | 'rewrite_reject'
  | 'rewrite_edit'
  | 'correction_accept'
  | 'correction_reject'
  | 'search_helpful'
  | 'search_unhelpful';

export type FeedbackRequest = {
  eventType: FeedbackEventType;
  surface: SourceSurface;
  requestId?: UUID;
  outputId?: UUID;
  accepted?: boolean;
  editedAfterAccept?: boolean;
  rating?: number;
  note?: string;
};

export type FeedbackResponse = {
  ok: true;
};
