"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ExplainResponse } from "@/lib/language/types";

type Props = {
  moduleCode?: string;
  concept: string;
  label?: string;
};

export function InlineExplainButton({ moduleCode, concept, label = "Explain deeper" }: Props) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExplainResponse | null>(null);

  const handleExplain = async () => {
    if (open && result) {
      setOpen(false);
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
          text: concept,
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
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Explanation failed.");
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: "8px" }}>
      <Button variant="outline" size="sm" type="button" onClick={handleExplain} disabled={loading}>
        {loading ? "Explaining..." : open && result ? "Hide explanation" : label}
      </Button>
      {open ? (
        <div className="glass" style={{ borderRadius: 12, padding: 12, display: "grid", gap: 8 }}>
          {error ? (
            <div className="assistant-error">{error}</div>
          ) : result ? (
            <>
              <strong style={{ fontSize: 14 }}>{result.term}</strong>
              <p style={{ margin: 0, lineHeight: 1.55 }}>{result.explanation}</p>
              {result.relatedTerms.length > 0 ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {result.relatedTerms.map((item) => (
                    <span key={item} className="assistant-context-chip">{item}</span>
                  ))}
                </div>
              ) : null}
              {result.debug ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span className="assistant-context-chip">{result.debug.strategy ?? "unknown"}</span>
                  <span className="assistant-context-chip">grounded={String(result.debug.grounded ?? false)}</span>
                  <span className="assistant-context-chip">sources={String(result.debug.sourceCount ?? 0)}</span>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
