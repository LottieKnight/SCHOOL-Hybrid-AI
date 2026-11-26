import React from "react";

interface JsonLdProps {
  data: Record<string, unknown> | Record<string, unknown>[];
}

/**
 * Renders a schema.org JSON-LD script tag. Used across the SCHOOL platform
 * to expose machine-readable facts to search engines and AI answer engines
 * (Google SGE, Bing Chat, Perplexity, etc.).
 */
export default function JsonLd({ data }: JsonLdProps) {
  const payload = Array.isArray(data) ? data : data;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
