"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import type { SearchResponse } from "@/lib/language/types";

type Props = {
  moduleCode?: string;
  title?: string;
  description?: string;
};

export function LanguageSearchPanel({
  moduleCode,
  title = "Smart search",
  description = "Search with typos, shorthand, or mixed wording. SCHOOL will normalize the query and expand it before retrieval.",
}: Props) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResponse | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setError("Type a search query first.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/language/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: trimmed,
          surface: "search",
          moduleCode,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as SearchResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data?.error || "Search failed.");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SectionCard className="glass card animate-fade-up">
      <div style={{ display: "grid", gap: "12px" }}>
        <div style={{ display: "grid", gap: "6px" }}>
          <span className="eyebrow">Language Layer</span>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <p className="assistant-helper" style={{ margin: 0 }}>{description}</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "10px" }}>
          <textarea
            className="assistant-textarea"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            rows={3}
            placeholder={moduleCode ? `Try: \"oppertunity cost\" or \"${moduleCode} inflation\"` : 'Try: "nsfas cant register" or "oppertunity cost"'}
          />
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <Button type="submit" variant="gold" disabled={loading || !query.trim()}>
              {loading ? "Searching..." : "Search with language layer"}
            </Button>
            {moduleCode ? <span className="assistant-context-chip">Module context: {moduleCode}</span> : null}
          </div>
        </form>

        {error ? <div className="assistant-error">{error}</div> : null}

        {result ? (
          <div style={{ display: "grid", gap: "12px" }}>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <span className="assistant-context-chip">Intent: {result.intent ?? "general"}</span>
              <span className="assistant-context-chip">Normalized: {result.normalizedQuery}</span>
            </div>

            {result.expansions.length > 0 ? (
              <div style={{ display: "grid", gap: "6px" }}>
                <strong>Query expansions</strong>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {result.expansions.map((item) => (
                    <span key={item} className="assistant-context-chip">{item}</span>
                  ))}
                </div>
              </div>
            ) : null}

            {result.debug ? (
              <div className="glass" style={{ borderRadius: 14, padding: 12, display: "grid", gap: 8 }}>
                <strong>Grounding debug</strong>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span className="assistant-context-chip">Strategy: {result.debug.strategy ?? "unknown"}</span>
                  <span className="assistant-context-chip">Grounded: {String(result.debug.groundedResultCount ?? 0)}</span>
                  <span className="assistant-context-chip">Fallback: {String(result.debug.fallbackResultCount ?? 0)}</span>
                  <span className="assistant-context-chip">Module boost: {((result.debug.moduleBoost ?? 0) * 100).toFixed(1)}%</span>
                  <span className="assistant-context-chip">Surface boost: {((result.debug.surfaceBoost ?? 0) * 100).toFixed(1)}%</span>
                  <span className="assistant-context-chip">Module feedback: {((result.debug.moduleFeedbackBoost ?? 0) * 100).toFixed(1)}%</span>
                  <span className="assistant-context-chip">Surface feedback: {((result.debug.surfaceFeedbackBoost ?? 0) * 100).toFixed(1)}%</span>
                </div>
                {result.debug.explicitModuleCode ? (
                  <span className="text-dim">Explicit module: {result.debug.explicitModuleCode}</span>
                ) : null}
                {result.debug.inferredModules?.length ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {result.debug.inferredModules.map((item) => (
                      <span key={item.moduleCode} className="assistant-context-chip">
                        {item.moduleCode} ({Math.round(item.confidence * 100)}%)
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div style={{ display: "grid", gap: "10px" }}>
              <strong>Results</strong>
              {result.results.length === 0 ? (
                <div className="text-dim">No seed-backed results matched yet.</div>
              ) : (
                result.results.map((item) => (
                  <article key={`${item.sourceId ?? item.title}-${item.score}`} className="skeu-card" style={{ display: "grid", gap: "6px", padding: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                      <strong>{item.title}</strong>
                      <span className="assistant-context-chip">{Math.round(item.score * 100)}% match</span>
                    </div>
                    <span className="text-dim">{item.sourceType}</span>
                    <p style={{ margin: 0 }}>{item.snippet}</p>
                  </article>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
