"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import type { ExplainResponse } from "@/lib/language/types";

type Props = {
  moduleCode?: string;
  title?: string;
  description?: string;
  initialText?: string;
  suggestions?: string[];
};

export function GroundedExplainPanel({
  moduleCode,
  title = "Explain a concept",
  description = "Ask SCHOOL to explain a concept using grounded module context before it falls back to general explanation.",
  initialText = "",
  suggestions = [],
}: Props) {
  const [text, setText] = useState(initialText);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExplainResponse | null>(null);

  const runExplain = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Enter a concept first.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/language/explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: trimmed,
          moduleCode,
          targetStyle: "plain_language",
          targetLanguage: "en",
        }),
      });

      const data = (await response.json().catch(() => ({}))) as ExplainResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data?.error || "Explanation failed.");
      }

      setResult(data);
      setText(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Explanation failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await runExplain(text);
  };

  return (
    <SectionCard className="glass card animate-fade-up" title={title} description={description}>
      <div style={{ display: "grid", gap: "12px" }}>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "10px" }}>
          <textarea
            className="assistant-textarea"
            rows={3}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={moduleCode ? `Try: "Ubuntu", "stakeholder theory", or "Chapter 3 accountability"` : 'Try: "opportunity cost"'}
          />
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            <Button type="submit" variant="gold" disabled={loading || !text.trim()}>
              {loading ? "Explaining..." : "Explain with grounding"}
            </Button>
            {moduleCode ? <span className="assistant-context-chip">Module context: {moduleCode}</span> : null}
          </div>
        </form>

        {suggestions.length > 0 ? (
          <div style={{ display: "grid", gap: "6px" }}>
            <strong>Try one of these</strong>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {suggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="badge skeu-badge"
                  onClick={() => void runExplain(item)}
                  style={{ cursor: "pointer" }}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {error ? <div className="assistant-error">{error}</div> : null}

        {result ? (
          <article className="skeu-card" style={{ display: "grid", gap: "10px", padding: "16px" }}>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <strong>{result.term}</strong>
              {result.sourceRefs.length > 0 ? <span className="assistant-context-chip">Grounded</span> : null}
            </div>
            <p style={{ margin: 0, lineHeight: 1.65 }}>{result.explanation}</p>
            {result.relatedTerms.length > 0 ? (
              <div style={{ display: "grid", gap: "6px" }}>
                <strong>Related terms</strong>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {result.relatedTerms.map((item) => (
                    <span key={item} className="assistant-context-chip">{item}</span>
                  ))}
                </div>
              </div>
            ) : null}
            {result.sourceRefs.length > 0 ? (
              <div style={{ display: "grid", gap: "6px" }}>
                <strong>Source refs</strong>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {result.sourceRefs.map((item) => (
                    <span key={`${item.type}:${item.id}`} className="assistant-context-chip">{item.type}</span>
                  ))}
                </div>
              </div>
            ) : null}
            {result.debug ? (
              <div className="glass" style={{ borderRadius: 12, padding: 12, display: "grid", gap: 6 }}>
                <strong>Explain debug</strong>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span className="assistant-context-chip">Strategy: {result.debug.strategy ?? "unknown"}</span>
                  <span className="assistant-context-chip">Grounded: {String(result.debug.grounded ?? false)}</span>
                  <span className="assistant-context-chip">Sources: {String(result.debug.sourceCount ?? 0)}</span>
                </div>
              </div>
            ) : null}
          </article>
        ) : null}
      </div>
    </SectionCard>
  );
}
