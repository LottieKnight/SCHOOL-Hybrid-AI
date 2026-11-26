import { queryPlannerDb } from '@/lib/server/plannerDb';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type CountRow = { count: string };
type QueryRow = { raw_query: string; count: string };
type ModeRow = { rewrite_mode: string; count: string };
type ModuleRow = { module_code: string; count: string };
type SurfaceRow = { source_surface: string; count: string };
type ModuleQueryRow = { module_code: string; raw_query: string; count: string };

async function safeCount(table: string) {
  try {
    const result = await queryPlannerDb<CountRow>(`SELECT COUNT(*)::text AS count FROM ${table}`);
    return Number(result.rows[0]?.count ?? '0');
  } catch {
    return 0;
  }
}

async function topQueries() {
  try {
    const result = await queryPlannerDb<QueryRow>(
      `
        SELECT raw_query, COUNT(*)::text AS count
        FROM language_search_events
        WHERE COALESCE(raw_query, '') <> ''
        GROUP BY raw_query
        ORDER BY COUNT(*) DESC, raw_query ASC
        LIMIT 5
      `
    );
    return result.rows.map((row) => ({ query: row.raw_query, count: Number(row.count) }));
  } catch {
    return [] as Array<{ query: string; count: number }>;
  }
}

async function topRewriteModes() {
  try {
    const result = await queryPlannerDb<ModeRow>(
      `
        SELECT rewrite_mode, COUNT(*)::text AS count
        FROM language_rewrite_events
        WHERE COALESCE(rewrite_mode, '') <> ''
        GROUP BY rewrite_mode
        ORDER BY COUNT(*) DESC, rewrite_mode ASC
        LIMIT 5
      `
    );
    return result.rows.map((row) => ({ mode: row.rewrite_mode, count: Number(row.count) }));
  } catch {
    return [] as Array<{ mode: string; count: number }>;
  }
}

async function topModules() {
  try {
    const result = await queryPlannerDb<ModuleRow>(
      `
        SELECT module_code, COUNT(*)::text AS count
        FROM language_search_events
        WHERE COALESCE(module_code, '') <> ''
        GROUP BY module_code
        ORDER BY COUNT(*) DESC, module_code ASC
        LIMIT 8
      `
    );
    return result.rows.map((row) => ({ moduleCode: row.module_code, count: Number(row.count) }));
  } catch {
    return [] as Array<{ moduleCode: string; count: number }>;
  }
}

async function topSurfaces() {
  try {
    const result = await queryPlannerDb<SurfaceRow>(
      `
        SELECT source_surface, COUNT(*)::text AS count
        FROM language_search_events
        WHERE COALESCE(source_surface, '') <> ''
        GROUP BY source_surface
        ORDER BY COUNT(*) DESC, source_surface ASC
        LIMIT 8
      `
    );
    return result.rows.map((row) => ({ surface: row.source_surface, count: Number(row.count) }));
  } catch {
    return [] as Array<{ surface: string; count: number }>;
  }
}

async function topModuleQueries() {
  try {
    const result = await queryPlannerDb<ModuleQueryRow>(
      `
        SELECT module_code, raw_query, COUNT(*)::text AS count
        FROM language_search_events
        WHERE COALESCE(module_code, '') <> ''
          AND COALESCE(raw_query, '') <> ''
        GROUP BY module_code, raw_query
        ORDER BY COUNT(*) DESC, module_code ASC, raw_query ASC
        LIMIT 10
      `
    );
    return result.rows.map((row) => ({
      moduleCode: row.module_code,
      query: row.raw_query,
      count: Number(row.count),
    }));
  } catch {
    return [] as Array<{ moduleCode: string; query: string; count: number }>;
  }
}

export async function GET() {
  const [searchEvents, rewriteEvents, feedbackEvents, queries, rewriteModes, modules, surfaces, moduleQueries] = await Promise.all([
    safeCount('language_search_events'),
    safeCount('language_rewrite_events'),
    safeCount('language_feedback_events'),
    topQueries(),
    topRewriteModes(),
    topModules(),
    topSurfaces(),
    topModuleQueries(),
  ]);

  return NextResponse.json({
    ok: true,
    totals: {
      searchEvents,
      rewriteEvents,
      feedbackEvents,
    },
    topQueries: queries,
    topRewriteModes: rewriteModes,
    topModules: modules,
    topSurfaces: surfaces,
    topModuleQueries: moduleQueries,
  });
}
