"use client";

import { useEffect, useId, useRef, useState } from "react";

let mermaidPromise: Promise<typeof import("mermaid").default> | null = null;
let initialized = false;

async function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((mod) => {
      const mermaid = mod.default;
      if (!initialized) {
        mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "strict" });
        initialized = true;
      }
      return mermaid;
    });
  }
  return mermaidPromise;
}

/**
 * Renders a Mermaid diagram from diagramCode. Falls back to the raw code block if the
 * diagram is invalid or mermaid fails to load (so a bad LLM diagram never breaks the
 * lesson view). This completes the "diagram" visual kind that previously only showed code.
 */
export function DiagramVisual({ code, caption }: { code: string; caption?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const id = `mermaid-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    let cancelled = false;
    getMermaid()
      .then(async (mermaid) => {
        const { svg } = await mermaid.render(id, code);
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (error) {
    return (
      <pre className="glass" style={{ overflowX: "auto", padding: 12, fontSize: 13, whiteSpace: "pre-wrap" }}>
        {code}
      </pre>
    );
  }

  return (
    <div>
      <div ref={ref} className="mermaid-diagram" style={{ overflowX: "auto", padding: "8px 0" }} />
      {caption ? <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 8 }}>{caption}</p> : null}
    </div>
  );
}
