"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type ContentType = "all" | "article" | "book" | "journal" | "publication" | "past_paper" | "video_lesson";
type GradeBand = "all" | "foundation" | "intermediate" | "senior" | "fet" | "university";

type LibraryResource = {
  id: string;
  title: string;
  description: string | null;
  content_type: string;
  subject: string | null;
  grade_band: string | null;
  topic_tags: string[];
  author: string | null;
  publisher: string | null;
  language: string;
  access_type: string;
  thumbnail_url: string | null;
  resource_url: string | null;
  file_type: string | null;
  created_at: string;
};

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "article", label: "Articles" },
  { value: "book", label: "Books" },
  { value: "journal", label: "Journals" },
  { value: "publication", label: "Publications" },
  { value: "past_paper", label: "Past Papers" },
  { value: "video_lesson", label: "Video Lessons" },
];

const GRADE_BANDS: { value: GradeBand; label: string }[] = [
  { value: "all", label: "All Grades" },
  { value: "foundation", label: "Foundation" },
  { value: "intermediate", label: "Intermediate" },
  { value: "senior", label: "Senior" },
  { value: "fet", label: "FET" },
  { value: "university", label: "University" },
];

const ACCESS_BADGE: Record<string, string> = {
  free: "Free",
  premium: "Premium",
  subscription: "Subscription",
};

export function LibraryCatalogClient() {
  const [contentType, setContentType] = useState<ContentType>("all");
  const [gradeBand, setGradeBand] = useState<GradeBand>("all");
  const [search, setSearch] = useState("");
  const [resources, setResources] = useState<LibraryResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchResources() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (contentType !== "all") params.set("content_type", contentType);
      if (gradeBand !== "all") params.set("grade_band", gradeBand);
      if (search.trim()) params.set("search", search.trim());
      params.set("limit", "24");

      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
      const res = await fetch(`${apiBase}/library/resources?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load resources");
      const data = await res.json();
      setResources(data.resources ?? []);
    } catch {
      setError("Could not load library resources. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      fetchResources();
    }, 300);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [contentType, gradeBand, search]);

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <div
        style={{
          display: "flex",
          gap: "var(--space-1)",
          flexWrap: "wrap",
          borderBottom: "1px solid var(--color-border)",
          paddingBottom: "var(--space-2)",
        }}
      >
        {CONTENT_TYPES.map((ct) => (
          <button
            key={ct.value}
            onClick={() => setContentType(ct.value)}
            style={{
              padding: "6px 14px",
              borderRadius: "var(--radius-full)",
              border: "1px solid var(--color-border)",
              cursor: "pointer",
              background: contentType === ct.value ? "var(--color-primary)" : "transparent",
              color: contentType === ct.value ? "var(--color-primary-fg)" : "inherit",
              fontWeight: contentType === ct.value ? 600 : 400,
            }}
          >
            {ct.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap" }}>
          {GRADE_BANDS.map((gb) => (
            <button
              key={gb.value}
              onClick={() => setGradeBand(gb.value)}
              style={{
                padding: "4px 10px",
                borderRadius: "var(--radius-full)",
                border: "1px solid var(--color-border)",
                cursor: "pointer",
                fontSize: "var(--text-sm)",
                background: gradeBand === gb.value ? "var(--color-surface-raised)" : "transparent",
                fontWeight: gradeBand === gb.value ? 600 : 400,
              }}
            >
              {gb.label}
            </button>
          ))}
        </div>

        <input
          type="search"
          placeholder="Search title or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            marginLeft: "auto",
            padding: "6px 12px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)",
            minWidth: 220,
            background: "var(--color-surface)",
            color: "inherit",
          }}
        />
      </div>

      {error && (
        <p style={{ color: "var(--color-error)" }}>{error}</p>
      )}

      {loading && (
        <p style={{ color: "var(--color-fg-muted)" }}>Loading…</p>
      )}

      {!loading && !error && resources.length === 0 && (
        <div style={{ textAlign: "center", padding: "var(--space-8) 0", color: "var(--color-fg-muted)" }}>
          <p>No resources found for your current filters.</p>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "var(--space-3)",
        }}
      >
        {resources.map((r) => (
          <Link
            key={r.id}
            href={`/library/${r.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div
              className="list-item"
              style={{
                display: "grid",
                gap: "var(--space-2)",
                height: "100%",
                cursor: "pointer",
              }}
            >
              {r.thumbnail_url && (
                <img
                  src={r.thumbnail_url}
                  alt={r.title}
                  style={{
                    width: "100%",
                    aspectRatio: "16/9",
                    objectFit: "cover",
                    borderRadius: "var(--radius-sm)",
                  }}
                />
              )}
              <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    padding: "2px 6px",
                    borderRadius: "var(--radius-full)",
                    background: "var(--color-surface-raised)",
                    textTransform: "capitalize",
                  }}
                >
                  {r.content_type.replace(/_/g, " ")}
                </span>
                {r.access_type !== "free" && (
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      padding: "2px 6px",
                      borderRadius: "var(--radius-full)",
                      background: "var(--color-primary)",
                      color: "var(--color-primary-fg)",
                    }}
                  >
                    {ACCESS_BADGE[r.access_type] ?? r.access_type}
                  </span>
                )}
              </div>
              <p style={{ fontWeight: 600, margin: 0, lineHeight: 1.3 }}>{r.title}</p>
              {r.author && (
                <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--color-fg-muted)" }}>
                  {r.author}
                </p>
              )}
              {r.description && (
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--text-sm)",
                    color: "var(--color-fg-muted)",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {r.description}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
