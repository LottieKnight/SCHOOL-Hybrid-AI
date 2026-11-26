import "server-only";

import { queryPlannerDb } from "@/lib/server/plannerDb";

type ModuleUsageRow = {
  module_code: string;
  count: string;
};

type SurfaceUsageRow = {
  source_surface: string;
  count: string;
};

type ModuleFeedbackRow = {
  module_code: string;
  positive_count: string;
  negative_count: string;
};

type SurfaceFeedbackRow = {
  source_surface: string;
  positive_count: string;
  negative_count: string;
};

export type LanguageUsageSignals = {
  moduleCounts: Record<string, number>;
  surfaceCounts: Record<string, number>;
  moduleFeedbackScores: Record<string, number>;
  surfaceFeedbackScores: Record<string, number>;
};

function emptySignals(): LanguageUsageSignals {
  return { moduleCounts: {}, surfaceCounts: {}, moduleFeedbackScores: {}, surfaceFeedbackScores: {} };
}

export async function getLanguageUsageSignals(): Promise<LanguageUsageSignals> {
  try {
    const [modulesResult, surfacesResult, moduleFeedbackResult, surfaceFeedbackResult] = await Promise.all([
      queryPlannerDb<ModuleUsageRow>(
        `
          SELECT module_code, COUNT(*)::text AS count
          FROM language_search_events
          WHERE COALESCE(module_code, '') <> ''
          GROUP BY module_code
        `
      ),
      queryPlannerDb<SurfaceUsageRow>(
        `
          SELECT source_surface, COUNT(*)::text AS count
          FROM language_search_events
          WHERE COALESCE(source_surface, '') <> ''
          GROUP BY source_surface
        `
      ),
      queryPlannerDb<ModuleFeedbackRow>(
        `
          SELECT
            metadata->>'moduleCode' AS module_code,
            COUNT(*) FILTER (WHERE accepted = true)::text AS positive_count,
            COUNT(*) FILTER (WHERE accepted = false)::text AS negative_count
          FROM language_feedback_events
          WHERE COALESCE(metadata->>'moduleCode', '') <> ''
          GROUP BY metadata->>'moduleCode'
        `
      ),
      queryPlannerDb<SurfaceFeedbackRow>(
        `
          SELECT
            source_surface,
            COUNT(*) FILTER (WHERE accepted = true)::text AS positive_count,
            COUNT(*) FILTER (WHERE accepted = false)::text AS negative_count
          FROM language_feedback_events
          WHERE COALESCE(source_surface, '') <> ''
          GROUP BY source_surface
        `
      ),
    ]);

    return {
      moduleCounts: Object.fromEntries(
        modulesResult.rows.map((row) => [row.module_code.toUpperCase(), Number(row.count)])
      ),
      surfaceCounts: Object.fromEntries(
        surfacesResult.rows.map((row) => [row.source_surface, Number(row.count)])
      ),
      moduleFeedbackScores: Object.fromEntries(
        moduleFeedbackResult.rows.map((row) => [
          row.module_code.toUpperCase(),
          Number(row.positive_count) - Number(row.negative_count),
        ])
      ),
      surfaceFeedbackScores: Object.fromEntries(
        surfaceFeedbackResult.rows.map((row) => [
          row.source_surface,
          Number(row.positive_count) - Number(row.negative_count),
        ])
      ),
    };
  } catch {
    return emptySignals();
  }
}
