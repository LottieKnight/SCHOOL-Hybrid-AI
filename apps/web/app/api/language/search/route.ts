import { searchLanguage } from '@/lib/language/service';
import { inferRelevantGeneratedModules, searchAcrossGeneratedModules, searchGeneratedModuleContent } from '@/lib/server/languageContent';
import { insertLanguageSearchEvent } from '@/lib/server/languageEvents';
import { getLanguageUsageSignals } from '@/lib/server/languageRankingSignals';
import { getBackendSessionFromRequest } from '@/lib/server/backendSession';
import { NextRequest, NextResponse } from 'next/server';

function dedupeResults<T extends { sourceId?: string; title: string; snippet: string; score: number }>(items: T[]) {
  const seen = new Map<string, T>();
  for (const item of items) {
    const key = `${item.sourceId ?? item.title}::${item.snippet}`;
    const existing = seen.get(key);
    if (!existing || item.score > existing.score) {
      seen.set(key, item);
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.score - a.score);
}

function normalizeUsageBoost(count: number, maxCount: number, ceiling: number) {
  if (!count || !maxCount) return 0;
  return Math.min(ceiling, (count / maxCount) * ceiling);
}

function normalizeFeedbackBoost(score: number, ceiling: number) {
  if (!score) return 0;
  if (score > 0) return Math.min(ceiling, score * (ceiling / 3));
  return Math.max(-ceiling, score * (ceiling / 3));
}

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = searchLanguage(body);
  const query = typeof body?.query === 'string' ? body.query : '';
  const explicitModuleCode = typeof body?.moduleCode === 'string' ? body.moduleCode : null;
  const sourceSurface = typeof body?.surface === 'string' ? body.surface : 'search';
  const usageSignals = await getLanguageUsageSignals();
  const maxModuleCount = Math.max(0, ...Object.values(usageSignals.moduleCounts));
  const maxSurfaceCount = Math.max(0, ...Object.values(usageSignals.surfaceCounts));
  const inferredModules = inferRelevantGeneratedModules({ query, preferredModuleCode: explicitModuleCode, limit: 3 }).map((item) => ({
    ...item,
    confidence: Math.min(
      0.99,
      item.confidence + normalizeUsageBoost(usageSignals.moduleCounts[item.moduleCode] ?? 0, maxModuleCount, 0.05)
    ),
  }));
  const groundedBaseResults = explicitModuleCode
    ? searchGeneratedModuleContent({ moduleCode: explicitModuleCode, query })
    : searchAcrossGeneratedModules({ query, limit: 8 });
  const targetModuleCode = explicitModuleCode?.toUpperCase() ?? inferredModules[0]?.moduleCode ?? null;
  const moduleBoost = targetModuleCode
    ? normalizeUsageBoost(usageSignals.moduleCounts[targetModuleCode] ?? 0, maxModuleCount, 0.04)
    : 0;
  const surfaceBoost = normalizeUsageBoost(usageSignals.surfaceCounts[sourceSurface] ?? 0, maxSurfaceCount, 0.02);
  const moduleFeedbackBoost = targetModuleCode
    ? normalizeFeedbackBoost(usageSignals.moduleFeedbackScores[targetModuleCode] ?? 0, 0.03)
    : 0;
  const surfaceFeedbackBoost = normalizeFeedbackBoost(usageSignals.surfaceFeedbackScores[sourceSurface] ?? 0, 0.02);
  const groundedResults = groundedBaseResults.map((item) => ({
    ...item,
    score: Math.min(0.99, Math.max(0, item.score + moduleBoost + surfaceBoost + moduleFeedbackBoost + surfaceFeedbackBoost)),
  }));
  const mergedResults = dedupeResults([...groundedResults, ...result.results]).slice(0, 10);
  const mergedResult = {
    ...result,
    expansions: inferredModules.length > 0
      ? [...result.expansions, ...inferredModules.map((item) => `module:${item.moduleCode}`)].slice(0, 10)
      : result.expansions,
    results: mergedResults,
    debug: {
      explicitModuleCode,
      inferredModules,
      groundedResultCount: groundedResults.length,
      fallbackResultCount: result.results.length,
      strategy: explicitModuleCode ? 'explicit-module-grounding' : 'cross-module-inference',
      moduleBoost,
      surfaceBoost,
      moduleFeedbackBoost,
      surfaceFeedbackBoost,
    },
  };
  const session = await getBackendSessionFromRequest(request).catch(() => null);
  const userId = typeof session?.user?.id === 'string' ? session.user.id : null;
  const sessionId = request.headers.get('x-session-id');

  void insertLanguageSearchEvent({
    userId,
    sessionId,
    sourceSurface: typeof body?.surface === 'string' ? body.surface : 'search',
    rawQuery: typeof body?.query === 'string' ? body.query : '',
    normalizedQuery: mergedResult.normalizedQuery,
    intent: mergedResult.intent ?? null,
    moduleCode: typeof body?.moduleCode === 'string' ? body.moduleCode : null,
    expansions: mergedResult.expansions,
    results: mergedResult.results,
  });

  return NextResponse.json(mergedResult);
}
