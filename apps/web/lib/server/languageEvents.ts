import "server-only";

import { queryPlannerDb } from "@/lib/server/plannerDb";

type SearchEventInput = {
  userId?: string | null;
  sessionId?: string | null;
  sourceSurface: string;
  rawQuery: string;
  normalizedQuery?: string | null;
  intent?: string | null;
  moduleCode?: string | null;
  expansions: string[];
  results: unknown[];
};

type RewriteEventInput = {
  userId?: string | null;
  sessionId?: string | null;
  sourceSurface: string;
  moduleCode?: string | null;
  rewriteMode: string;
  originalText: string;
  outputText: string;
  confidenceScore?: number | null;
  accepted?: boolean | null;
  metadata?: Record<string, unknown>;
};

type FeedbackEventInput = {
  userId?: string | null;
  sessionId?: string | null;
  eventType: string;
  sourceSurface: string;
  requestId?: string | null;
  outputId?: string | null;
  accepted?: boolean | null;
  editedAfterAccept?: boolean;
  rating?: number | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
};

function isSchemaUnavailable(error: unknown) {
  const code = (error as { code?: string })?.code;
  return code === "42P01" || code === "42703";
}

export async function insertLanguageSearchEvent(input: SearchEventInput) {
  try {
    await queryPlannerDb(
      `
        INSERT INTO language_search_events (
          user_id, session_id, source_surface, raw_query, normalized_query,
          intent, module_code, expansions, results
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)
      `,
      [
        input.userId ?? null,
        input.sessionId ?? null,
        input.sourceSurface,
        input.rawQuery,
        input.normalizedQuery ?? null,
        input.intent ?? null,
        input.moduleCode ?? null,
        JSON.stringify(input.expansions ?? []),
        JSON.stringify(input.results ?? []),
      ]
    );
  } catch (error) {
    if (!isSchemaUnavailable(error)) {
      console.error("Failed to insert language search event", error);
    }
  }
}

export async function insertLanguageRewriteEvent(input: RewriteEventInput) {
  try {
    await queryPlannerDb(
      `
        INSERT INTO language_rewrite_events (
          user_id, session_id, source_surface, module_code, rewrite_mode,
          original_text, output_text, confidence_score, accepted, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      `,
      [
        input.userId ?? null,
        input.sessionId ?? null,
        input.sourceSurface,
        input.moduleCode ?? null,
        input.rewriteMode,
        input.originalText,
        input.outputText,
        input.confidenceScore ?? null,
        input.accepted ?? null,
        JSON.stringify(input.metadata ?? {}),
      ]
    );
  } catch (error) {
    if (!isSchemaUnavailable(error)) {
      console.error("Failed to insert language rewrite event", error);
    }
  }
}

export async function insertLanguageFeedbackEvent(input: FeedbackEventInput) {
  try {
    await queryPlannerDb(
      `
        INSERT INTO language_feedback_events (
          user_id, session_id, event_type, source_surface, request_id, output_id,
          accepted, edited_after_accept, rating, note, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
      `,
      [
        input.userId ?? null,
        input.sessionId ?? null,
        input.eventType,
        input.sourceSurface,
        input.requestId ?? null,
        input.outputId ?? null,
        input.accepted ?? null,
        input.editedAfterAccept ?? false,
        input.rating ?? null,
        input.note ?? null,
        JSON.stringify(input.metadata ?? {}),
      ]
    );
  } catch (error) {
    if (!isSchemaUnavailable(error)) {
      console.error("Failed to insert language feedback event", error);
    }
  }
}
