import "server-only";

import type { BookstoreProduct } from "@/lib/bookstore";
import {
  buildFallbackConceptSlug,
  getMasteryBand,
  scoreMemoryRelevance,
  type MemoryBand,
} from "@/lib/memoryShared";
import { queryPlannerDb } from "@/lib/server/plannerDb";

export { buildFallbackConceptSlug, getMasteryBand, scoreMemoryRelevance } from "@/lib/memoryShared";

export const GENERAL_MODULE_CODE = "__general__";
const MEMORY_WORD_LIMIT = 200;
const TABLE_CACHE_TTL_MS = 30000;

export const MEMORY_EVENT_TYPES = [
  "assistant_question",
  "assistant_followup",
  "struggle_signal",
  "resource_open",
  "resource_revisit",
  "resource_dwell",
  "quiz_correct",
  "quiz_incorrect",
  "concept_reviewed",
  "recommendation_clicked",
] as const;

export const MEMORY_SOURCE_TYPES = ["assistant", "quiz", "resource", "manual_feedback"] as const;

export type MemoryEventType = (typeof MEMORY_EVENT_TYPES)[number];
export type MemorySourceType = (typeof MEMORY_SOURCE_TYPES)[number];

export type MemorySummaryItem = {
  concept_key: string;
  concept_label: string;
  module_code: string | null;
  module_label: string;
  qualitative_band: MemoryBand;
  is_new_concept: boolean;
  last_seen_at: string | null;
  last_practiced_at: string | null;
};

export type MemorySummary = {
  struggling_concepts: MemorySummaryItem[];
  recent_concepts: MemorySummaryItem[];
  confident_concepts: MemorySummaryItem[];
  new_concepts: MemorySummaryItem[];
  recommended_review: MemorySummaryItem[];
};

export type MemoryProfileConcept = MemorySummaryItem;

export type MemoryProfileModule = {
  module_code: string | null;
  module_label: string;
  bands: {
    new_concepts: MemoryProfileConcept[];
    needs_review: MemoryProfileConcept[];
    developing: MemoryProfileConcept[];
    confident: MemoryProfileConcept[];
  };
};

export type MemoryProfile = {
  modules: MemoryProfileModule[];
};

export type AppendMemoryEventInput = {
  userId: string;
  moduleCode?: string | null;
  eventType: MemoryEventType;
  sourceType: MemorySourceType;
  conceptKey?: string | null;
  resourceId?: string | null;
  quizAttemptId?: string | null;
  sessionId?: string | null;
  eventWeight?: number;
  isNewConcept?: boolean;
  metadata?: Record<string, unknown>;
};

export type ResetMemoryInput = {
  conceptKey?: string | null;
  moduleCode?: string | null;
};

export type ExtractedMemoryConcept = {
  conceptKey: string | null;
  conceptLabel: string | null;
  moduleCode: string | null;
};

export type MemoryResourceSection = {
  id: "continue" | "weak" | "module" | "universal";
  title: string;
  description: string;
  items: BookstoreProduct[];
};

type MemoryStateRow = {
  module_code: string;
  concept_key: string;
  concept_label: string;
  mastery_score: number;
  is_new_concept: boolean;
  last_seen_at: string | null;
  last_practiced_at: string | null;
  updated_at: string;
  struggle_count?: number;
  resource_open_count?: number;
};

type ConceptDictionaryRow = {
  module_code: string | null;
  concept_key: string;
  concept_label: string;
  aliases: string[] | null;
};

type ResourceEventSummary = {
  productId: string;
  openCount: number;
  revisitCount: number;
  recommendationClicks: number;
  lastOpenedAt: string | null;
};

type TableCache = {
  checkedAt: number;
  available: boolean;
};

let memoryTableCache: TableCache = {
  checkedAt: 0,
  available: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeModuleCode(moduleCode: string | null | undefined) {
  const trimmed = typeof moduleCode === "string" ? moduleCode.trim() : "";
  return trimmed || GENERAL_MODULE_CODE;
}

function normalizeModuleForDisplay(moduleCode: string | null | undefined) {
  const normalized = normalizeModuleCode(moduleCode);
  return normalized === GENERAL_MODULE_CODE ? "General" : normalized;
}

function toIsoOrNull(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function wordsWithinLimit(value: string, wordLimit = MEMORY_WORD_LIMIT) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length <= wordLimit) return value.trim();
  return `${words.slice(0, wordLimit).join(" ")}...`;
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapStateRow(row: MemoryStateRow): MemorySummaryItem {
  return {
    concept_key: row.concept_key,
    concept_label: row.concept_label,
    module_code: row.module_code === GENERAL_MODULE_CODE ? null : row.module_code,
    module_label: normalizeModuleForDisplay(row.module_code),
    qualitative_band: getMasteryBand(toNumber(row.mastery_score)),
    is_new_concept: Boolean(row.is_new_concept),
    last_seen_at: toIsoOrNull(row.last_seen_at),
    last_practiced_at: toIsoOrNull(row.last_practiced_at),
  };
}

async function memoryTablesAvailable() {
  const now = Date.now();
  if (now - memoryTableCache.checkedAt < TABLE_CACHE_TTL_MS) {
    return memoryTableCache.available;
  }

  try {
    const result = await queryPlannerDb<{
      concept_dictionary: string | null;
      learning_events: string | null;
      student_concept_state: string | null;
    }>(
      `
        SELECT
          to_regclass('public.concept_dictionary')::text AS concept_dictionary,
          to_regclass('public.learning_events')::text AS learning_events,
          to_regclass('public.student_concept_state')::text AS student_concept_state
      `
    );
    const row = result.rows[0];
    memoryTableCache = {
      checkedAt: now,
      available: Boolean(row?.concept_dictionary && row?.learning_events && row?.student_concept_state),
    };
  } catch {
    memoryTableCache = {
      checkedAt: now,
      available: false,
    };
  }

  return memoryTableCache.available;
}

async function loadStateRows(userId: string, moduleCode?: string | null) {
  if (!(await memoryTablesAvailable())) return [] as MemoryStateRow[];

  try {
    const values: unknown[] = [userId];
    const where = ["user_id = $1"];

    if (moduleCode) {
      values.push(normalizeModuleCode(moduleCode));
      where.push(`module_code = $${values.length}`);
    }

    const result = await queryPlannerDb<MemoryStateRow>(
      `
        SELECT
          module_code,
          concept_key,
          concept_label,
          mastery_score::float AS mastery_score,
          is_new_concept,
          last_seen_at::text,
          last_practiced_at::text,
          updated_at::text,
          struggle_count,
          resource_open_count
        FROM student_concept_state
        WHERE ${where.join(" AND ")}
        ORDER BY updated_at DESC
      `,
      values
    );

    return result.rows;
  } catch {
    return [] as MemoryStateRow[];
  }
}

async function hasPriorConcept(userId: string, conceptKey: string, moduleCode?: string | null) {
  if (!(await memoryTablesAvailable())) return false;

  try {
    const normalizedModule = moduleCode ? normalizeModuleCode(moduleCode) : null;
    const result = await queryPlannerDb<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM student_concept_state
          WHERE user_id = $1
            AND concept_key = $2
            AND ($3::text IS NULL OR module_code = $3)
        ) AS exists
      `,
      [userId, conceptKey, normalizedModule]
    );
    return Boolean(result.rows[0]?.exists);
  } catch {
    return false;
  }
}

function sortByRecent(items: MemoryStateRow[]) {
  return [...items].sort((left, right) => {
    const rightTime = new Date(right.last_seen_at || right.updated_at).getTime();
    const leftTime = new Date(left.last_seen_at || left.updated_at).getTime();
    return rightTime - leftTime;
  });
}

function sortByRecommendedReview(items: MemoryStateRow[]) {
  return [...items].sort((left, right) => {
    const leftScore = toNumber(left.mastery_score);
    const rightScore = toNumber(right.mastery_score);
    if (leftScore !== rightScore) return leftScore - rightScore;
    const leftPractice = new Date(left.last_practiced_at || left.updated_at).getTime();
    const rightPractice = new Date(right.last_practiced_at || right.updated_at).getTime();
    return leftPractice - rightPractice;
  });
}

export async function getMemorySummary(userId: string, moduleCode?: string | null): Promise<MemorySummary> {
  const emptySummary: MemorySummary = {
    struggling_concepts: [],
    recent_concepts: [],
    confident_concepts: [],
    new_concepts: [],
    recommended_review: [],
  };

  if (!userId) return emptySummary;

  const rows = await loadStateRows(userId, moduleCode);
  if (rows.length === 0) return emptySummary;

  const struggling = rows
    .filter((row) => !row.is_new_concept && getMasteryBand(toNumber(row.mastery_score)) === "Needs Review")
    .sort((left, right) => {
      const scoreDelta = toNumber(left.mastery_score) - toNumber(right.mastery_score);
      if (scoreDelta !== 0) return scoreDelta;
      return toNumber(right.struggle_count) - toNumber(left.struggle_count);
    })
    .slice(0, 3)
    .map(mapStateRow);

  const recent = sortByRecent(rows).slice(0, 3).map(mapStateRow);
  const confident = rows
    .filter((row) => !row.is_new_concept && getMasteryBand(toNumber(row.mastery_score)) === "Confident")
    .sort((left, right) => toNumber(right.mastery_score) - toNumber(left.mastery_score))
    .slice(0, 3)
    .map(mapStateRow);
  const newConcepts = sortByRecent(rows.filter((row) => row.is_new_concept)).slice(0, 2).map(mapStateRow);
  const recommendedReview = sortByRecommendedReview(rows.filter((row) => !row.is_new_concept))
    .slice(0, 2)
    .map(mapStateRow);

  return {
    struggling_concepts: struggling,
    recent_concepts: recent,
    confident_concepts: confident,
    new_concepts: newConcepts,
    recommended_review: recommendedReview,
  };
}

export async function getMemoryProfile(userId: string): Promise<MemoryProfile> {
  if (!userId) {
    return { modules: [] };
  }

  const rows = await loadStateRows(userId);
  if (rows.length === 0) {
    return { modules: [] };
  }

  const grouped = new Map<string, MemoryProfileModule>();

  for (const row of sortByRecent(rows)) {
    const moduleCode = normalizeModuleCode(row.module_code);
    if (!grouped.has(moduleCode)) {
      grouped.set(moduleCode, {
        module_code: moduleCode === GENERAL_MODULE_CODE ? null : moduleCode,
        module_label: normalizeModuleForDisplay(moduleCode),
        bands: {
          new_concepts: [],
          needs_review: [],
          developing: [],
          confident: [],
        },
      });
    }

    const concept = mapStateRow(row);
    const bucket = grouped.get(moduleCode)!;

    if (concept.is_new_concept) {
      bucket.bands.new_concepts.push(concept);
      continue;
    }

    switch (concept.qualitative_band) {
      case "Needs Review":
        bucket.bands.needs_review.push(concept);
        break;
      case "Developing":
        bucket.bands.developing.push(concept);
        break;
      case "Confident":
        bucket.bands.confident.push(concept);
        break;
    }
  }

  return {
    modules: Array.from(grouped.values()).sort((left, right) => left.module_label.localeCompare(right.module_label)),
  };
}

export function buildMemoryPromptBlock(summary: MemorySummary, wordLimit = MEMORY_WORD_LIMIT) {
  const lines: string[] = [];

  if (summary.struggling_concepts.length > 0) {
    lines.push(`Needs review: ${summary.struggling_concepts.map((item) => item.concept_label).join(", ")}.`);
  }
  if (summary.confident_concepts.length > 0) {
    lines.push(`More confident with: ${summary.confident_concepts.map((item) => item.concept_label).join(", ")}.`);
  }
  if (summary.new_concepts.length > 0) {
    lines.push(`New territory: ${summary.new_concepts.map((item) => item.concept_label).join(", ")}.`);
  }
  if (summary.recommended_review.length > 0) {
    lines.push(`Good review targets: ${summary.recommended_review.map((item) => item.concept_label).join(", ")}.`);
  }

  if (lines.length === 0) {
    return "";
  }

  const block = [
    "Student learning memory:",
    ...lines,
    "Treat this as context, not mandate.",
    "If a needs-review concept appears, start simpler and use a concrete South African example before formal abstraction.",
    "Do not assume prior mastery of needs-review concepts.",
    "If a concept appears new, treat it as fresh territory and build carefully.",
  ].join(" ");

  return wordsWithinLimit(block, wordLimit);
}

export async function appendMemoryEvent(input: AppendMemoryEventInput) {
  if (!input.userId || !(await memoryTablesAvailable())) {
    return null;
  }

  const conceptKey = typeof input.conceptKey === "string" && input.conceptKey.trim() ? input.conceptKey.trim() : null;
  const resolvedIsNewConcept =
    typeof input.isNewConcept === "boolean"
      ? input.isNewConcept
      : conceptKey
        ? !(await hasPriorConcept(input.userId, conceptKey, input.moduleCode))
        : false;

  try {
    const result = await queryPlannerDb<{
      id: string;
      concept_key: string | null;
      module_code: string | null;
      is_new_concept: boolean;
      created_at: string;
    }>(
      `
        INSERT INTO learning_events (
          user_id,
          module_code,
          event_type,
          source_type,
          concept_key,
          resource_id,
          quiz_attempt_id,
          session_id,
          event_weight,
          is_new_concept,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
        RETURNING id::text, concept_key, module_code, is_new_concept, created_at::text
      `,
      [
        input.userId,
        input.moduleCode?.trim() || null,
        input.eventType,
        input.sourceType,
        conceptKey,
        input.resourceId ?? null,
        input.quizAttemptId ?? null,
        input.sessionId ?? null,
        typeof input.eventWeight === "number" && Number.isFinite(input.eventWeight) ? input.eventWeight : 1,
        resolvedIsNewConcept,
        JSON.stringify(isRecord(input.metadata) ? input.metadata : {}),
      ]
    );

    return result.rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function resetMemoryPersonalization(userId: string, input: ResetMemoryInput = {}) {
  if (!userId || !(await memoryTablesAvailable())) {
    return { success: true, resetCount: 0 };
  }

  const conceptKey = typeof input.conceptKey === "string" && input.conceptKey.trim() ? input.conceptKey.trim() : null;
  const moduleCode = typeof input.moduleCode === "string" && input.moduleCode.trim() ? normalizeModuleCode(input.moduleCode) : null;

  try {
    const result = await queryPlannerDb<{ reset_count: number }>(
      `
        WITH updated_events AS (
          UPDATE learning_events
          SET excluded_from_personalization = TRUE
          WHERE user_id = $1
            AND excluded_from_personalization = FALSE
            AND ($2::text IS NULL OR concept_key = $2)
            AND (
              $3::text IS NULL
              OR COALESCE(NULLIF(module_code, ''), '${GENERAL_MODULE_CODE}') = $3
            )
          RETURNING 1
        ),
        deleted_state AS (
          DELETE FROM student_concept_state
          WHERE user_id = $1
            AND ($2::text IS NULL OR concept_key = $2)
            AND ($3::text IS NULL OR module_code = $3)
          RETURNING 1
        )
        SELECT
          (SELECT COUNT(*)::int FROM updated_events)
          + (SELECT COUNT(*)::int FROM deleted_state) AS reset_count
      `,
      [userId, conceptKey, moduleCode]
    );

    return {
      success: true,
      resetCount: Number(result.rows[0]?.reset_count ?? 0),
    };
  } catch {
    return {
      success: false,
      resetCount: 0,
    };
  }
}

function chooseModuleFromInput(material: string, currentModules: string[]) {
  if (currentModules.length === 0) return null;

  const normalizedMaterial = normalizeSearchText(material);
  const sortedModules = [...currentModules]
    .map((moduleCode) => moduleCode.trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);

  for (const moduleCode of sortedModules) {
    const normalizedModule = normalizeSearchText(moduleCode);
    if (normalizedModule && normalizedMaterial.includes(normalizedModule)) {
      return moduleCode;
    }
  }

  return sortedModules[0] ?? null;
}

async function loadConceptDictionary(
  institutionId: string | null | undefined,
  moduleCodes: string[]
): Promise<ConceptDictionaryRow[]> {
  if (!(await memoryTablesAvailable())) return [];

  try {
    const normalizedModules = Array.from(
      new Set(moduleCodes.map((value) => value.trim()).filter(Boolean))
    );
    const values: unknown[] = [];
    const clauses: string[] = [];

    if (normalizedModules.length > 0) {
      values.push(normalizedModules);
      clauses.push(`module_code = ANY($${values.length}::text[])`);
    }

    if (institutionId) {
      values.push(institutionId);
      clauses.push(`institution_id = $${values.length}`);
    }

    if (clauses.length === 0) {
      return [];
    }

    const result = await queryPlannerDb<ConceptDictionaryRow>(
      `
        SELECT module_code, concept_key, concept_label, aliases
        FROM concept_dictionary
        WHERE ${clauses.join(" OR ")}
        ORDER BY module_code ASC NULLS LAST, concept_label ASC
      `,
      values
    );

    return result.rows;
  } catch {
    return [];
  }
}

function localConceptMatch(material: string, entries: ConceptDictionaryRow[]) {
  if (entries.length === 0) return null;
  const normalizedMaterial = normalizeSearchText(material);
  const candidates: Array<ConceptDictionaryRow & { score: number }> = [];

  for (const entry of entries) {
    const phrases = [entry.concept_label, entry.concept_key.replace(/[-_]/g, " "), ...(entry.aliases ?? [])]
      .map((value) => normalizeSearchText(value))
      .filter(Boolean);

    for (const phrase of phrases) {
      if (phrase && normalizedMaterial.includes(phrase)) {
        candidates.push({
          ...entry,
          score: phrase.split(" ").length * 10 + phrase.length,
        });
        break;
      }
    }
  }

  candidates.sort((left, right) => right.score - left.score);
  return candidates[0] ?? null;
}

function safeConceptLabelFromKey(value: string | null) {
  if (!value) return null;
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function runConceptExtractionModel(
  material: string,
  dictionary: ConceptDictionaryRow[]
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || dictionary.length === 0) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  const openAiBase =
    process.env.OPENAI_API_BASE && process.env.OPENAI_API_BASE.trim().length > 0
      ? process.env.OPENAI_API_BASE.replace(/\/+$/, "")
      : "https://api.openai.com/v1";
  const model =
    process.env.OPENAI_MODEL && process.env.OPENAI_MODEL.trim().length > 0
      ? process.env.OPENAI_MODEL
      : "gpt-4o-mini";
  const options = dictionary.slice(0, 60).map((entry) => ({
    concept_key: entry.concept_key,
    concept_label: entry.concept_label,
    module_code: entry.module_code,
  }));

  try {
    const response = await fetch(`${openAiBase}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 50,
        messages: [
          {
            role: "system",
            content:
              "Return only valid JSON with the shape {\"concept_key\": string | null}. Use one of the provided concept_key values if it matches the student input. If nothing matches, return a short 2-3 word slug or null.",
          },
          {
            role: "user",
            content: JSON.stringify({
              student_input: material.slice(0, 600),
              concept_options: options,
            }),
          },
        ],
      }),
    });

    if (!response.ok) return null;
    const data = (await response.json().catch(() => ({}))) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!raw) return null;
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as { concept_key?: unknown };
    const conceptKey = typeof parsed.concept_key === "string" ? parsed.concept_key.trim() : "";
    return conceptKey || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function extractMemoryConcept(input: {
  material: string;
  institutionId?: string | null;
  currentModules?: string[];
}): Promise<ExtractedMemoryConcept> {
  const currentModules = Array.isArray(input.currentModules)
    ? input.currentModules.map((value) => value.trim()).filter(Boolean)
    : [];
  const activeModule = chooseModuleFromInput(input.material, currentModules);
  const dictionary = await loadConceptDictionary(input.institutionId, activeModule ? [activeModule, ...currentModules] : currentModules);

  const activeModuleEntries = activeModule
    ? dictionary.filter((entry) => normalizeModuleCode(entry.module_code) === normalizeModuleCode(activeModule))
    : [];
  const institutionEntries = dictionary.filter((entry) => !activeModuleEntries.includes(entry));

  const localMatch = localConceptMatch(input.material, activeModuleEntries) || localConceptMatch(input.material, institutionEntries);
  if (localMatch) {
    return {
      conceptKey: localMatch.concept_key,
      conceptLabel: localMatch.concept_label,
      moduleCode: localMatch.module_code || activeModule || null,
    };
  }

  const aiGuess = await runConceptExtractionModel(input.material, activeModuleEntries.length > 0 ? activeModuleEntries : dictionary);
  if (aiGuess) {
    const exact = dictionary.find((entry) => entry.concept_key === aiGuess);
    if (exact) {
      return {
        conceptKey: exact.concept_key,
        conceptLabel: exact.concept_label,
        moduleCode: exact.module_code || activeModule || null,
      };
    }

    const slug = buildFallbackConceptSlug(aiGuess);
    if (slug) {
      return {
        conceptKey: slug,
        conceptLabel: safeConceptLabelFromKey(slug),
        moduleCode: activeModule,
      };
    }
  }

  const fallbackSlug = buildFallbackConceptSlug(input.material);
  if (!fallbackSlug) {
    return {
      conceptKey: null,
      conceptLabel: null,
      moduleCode: activeModule,
    };
  }

  return {
    conceptKey: fallbackSlug,
    conceptLabel: safeConceptLabelFromKey(fallbackSlug),
    moduleCode: activeModule,
  };
}

async function getRecentResourceEvents(userId: string) {
  if (!userId || !(await memoryTablesAvailable())) return new Map<string, ResourceEventSummary>();

  try {
    const result = await queryPlannerDb<{
      product_id: string | null;
      open_count: number;
      revisit_count: number;
      recommendation_clicks: number;
      last_opened_at: string | null;
    }>(
      `
        SELECT
          metadata->>'productId' AS product_id,
          COUNT(*) FILTER (WHERE event_type = 'resource_open')::int AS open_count,
          COUNT(*) FILTER (WHERE event_type = 'resource_revisit')::int AS revisit_count,
          COUNT(*) FILTER (WHERE event_type = 'recommendation_clicked')::int AS recommendation_clicks,
          MAX(created_at)::text AS last_opened_at
        FROM learning_events
        WHERE user_id = $1
          AND excluded_from_personalization = FALSE
          AND event_type IN ('resource_open', 'resource_revisit', 'recommendation_clicked')
          AND metadata ? 'productId'
          AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY metadata->>'productId'
      `,
      [userId]
    );

    const map = new Map<string, ResourceEventSummary>();
    for (const row of result.rows) {
      if (!row.product_id) continue;
      map.set(row.product_id, {
        productId: row.product_id,
        openCount: toNumber(row.open_count),
        revisitCount: toNumber(row.revisit_count),
        recommendationClicks: toNumber(row.recommendation_clicks),
        lastOpenedAt: toIsoOrNull(row.last_opened_at),
      });
    }
    return map;
  } catch {
    return new Map<string, ResourceEventSummary>();
  }
}

function productMatchesModule(product: BookstoreProduct, activeModule: string | null, currentModules: string[]) {
  const candidates = [activeModule, ...currentModules].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  if (candidates.length === 0) return false;

  const haystack = normalizeSearchText(
    [
      product.title,
      product.description,
      ...(product.subjects || []),
      ...(product.tags || []),
      ...((product.concepts || []) as string[]),
      typeof product.metadata_json?.moduleCode === "string" ? product.metadata_json.moduleCode : "",
    ]
      .filter(Boolean)
      .join(" ")
  );

  return candidates.some((moduleCode) => {
    const normalized = normalizeSearchText(moduleCode);
    return normalized.length > 0 && haystack.includes(normalized);
  });
}

export async function rankResourceProductsWithMemory(input: {
  products: BookstoreProduct[];
  userId: string;
  activeModule?: string | null;
  currentModules?: string[];
}) {
  const summary = await getMemorySummary(input.userId, input.activeModule ?? null);
  const recentEvents = await getRecentResourceEvents(input.userId);
  const hasMemorySignals =
    summary.struggling_concepts.length > 0 ||
    summary.recent_concepts.length > 0 ||
    summary.confident_concepts.length > 0 ||
    summary.new_concepts.length > 0 ||
    summary.recommended_review.length > 0 ||
    recentEvents.size > 0;

  if (!hasMemorySignals) {
    return {
      summary,
      products: input.products.map((product) => ({
        ...product,
        memory_relevance: null,
        recommendation_reason: null,
        memory_bucket: null,
      })),
      sections: [] as MemoryResourceSection[],
    };
  }

  const struggling = new Set(summary.struggling_concepts.map((item) => item.concept_key));
  const recent = new Set(summary.recent_concepts.map((item) => item.concept_key));
  const currentModules = Array.isArray(input.currentModules)
    ? input.currentModules.map((value) => value.trim()).filter(Boolean)
    : [];

  const scoredProducts = input.products.map((product) => {
    const productConcepts = Array.isArray(product.concepts)
      ? product.concepts.map((value) => value.trim()).filter(Boolean)
      : [];
    const strugglingMatches = productConcepts.filter((concept) => struggling.has(concept));
    const recentMatches = productConcepts.filter((concept) => recent.has(concept));
    const engagement = recentEvents.get(product.id);
    const openedButNotCompleted = Boolean(engagement?.openCount && !engagement?.revisitCount);
    const moduleMatch = productMatchesModule(product, input.activeModule ?? null, currentModules);
    const score = scoreMemoryRelevance({
      strugglingMatches: strugglingMatches.length,
      recentMatches: recentMatches.length,
      openedButNotCompleted,
      moduleMatch,
    });

    let recommendationReason: string | null = null;
    let bucket: MemoryResourceSection["id"] | null = null;

    if (openedButNotCompleted) {
      recommendationReason = "Continue where you left off. You opened this recently and have not revisited it yet.";
      bucket = "continue";
    } else if (strugglingMatches.length > 0) {
      recommendationReason = `Helpful for your weak areas: ${strugglingMatches
        .slice(0, 2)
        .map((concept) => safeConceptLabelFromKey(concept) || concept)
        .join(", ")}.`;
      bucket = "weak";
    } else if (moduleMatch) {
      recommendationReason = `Relevant to your current module${input.activeModule ? `: ${input.activeModule}` : ""}.`;
      bucket = "module";
    } else if (recentMatches.length > 0) {
      recommendationReason = `Connects to what you studied recently: ${recentMatches
        .slice(0, 2)
        .map((concept) => safeConceptLabelFromKey(concept) || concept)
        .join(", ")}.`;
      bucket = product.institution_id ? "module" : "universal";
    } else if (!product.institution_id) {
      recommendationReason = "Universal material you can use alongside your institution-specific resources.";
      bucket = "universal";
    }

    return {
      ...product,
      memory_relevance: score,
      recommendation_reason: score > 0.3 ? recommendationReason : null,
      memory_bucket: bucket,
    } as BookstoreProduct & {
      memory_relevance: number;
      recommendation_reason: string | null;
      memory_bucket: MemoryResourceSection["id"] | null;
    };
  });

  const bucketed = {
    continue: scoredProducts.filter((product) => product.memory_bucket === "continue"),
    weak: scoredProducts.filter((product) => product.memory_bucket === "weak"),
    module: scoredProducts.filter((product) => product.memory_bucket === "module"),
    universal: scoredProducts.filter((product) => product.memory_bucket === "universal" || !product.institution_id),
  };

  const uniqueById = (items: typeof scoredProducts) => {
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  };

  const sections: MemoryResourceSection[] = [
    {
      id: "continue" as const,
      title: "Continue Where You Left Off",
      description: "Resources you opened recently and should come back to.",
      items: uniqueById(bucketed.continue).slice(0, 6),
    },
    {
      id: "weak" as const,
      title: "Helpful for Your Weak Areas",
      description: "Resources aligned to concepts that still need review.",
      items: uniqueById(bucketed.weak).slice(0, 6),
    },
    {
      id: "module" as const,
      title: "Your Module",
      description: "Institution-aware resources that match your current learning track.",
      items: uniqueById(
        bucketed.module
          .sort((left, right) => (right.memory_relevance ?? 0) - (left.memory_relevance ?? 0))
      ).slice(0, 8),
    },
    {
      id: "universal" as const,
      title: "Universal Resources",
      description: "Open resources that work across modules and institutions.",
      items: uniqueById(
        bucketed.universal
          .sort((left, right) => (right.memory_relevance ?? 0) - (left.memory_relevance ?? 0))
      ).slice(0, 8),
    },
  ].filter((section) => section.items.length > 0);

  return {
    summary,
    products: scoredProducts,
    sections,
  };
}
