import type { Metadata } from "next";
import { RouteHeader } from "@/components/ui/RouteHeader";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Resource ${id} | Library`,
    description: "View this library resource on SCHOOL.",
  };
}

export default async function LibraryResourcePage({ params }: Props) {
  const { id } = await params;

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  let resource: Record<string, unknown> | null = null;
  try {
    const res = await fetch(`${apiBase}/library/resources/${id}`, { next: { revalidate: 60 } });
    if (res.ok) {
      const data = await res.json();
      resource = data.resource ?? null;
    }
  } catch {
    resource = null;
  }

  if (!resource) {
    return (
      <div style={{ display: "grid", gap: "var(--space-4)" }}>
        <RouteHeader eyebrow="Library" title="Resource not found" description="This resource could not be loaded." />
      </div>
    );
  }

  const contentType = String(resource.content_type ?? "").replace(/_/g, " ");
  const title = String(resource.title ?? "");
  const description = resource.description ? String(resource.description) : null;
  const author = resource.author ? String(resource.author) : null;
  const publisher = resource.publisher ? String(resource.publisher) : null;
  const publishedYear = resource.published_year ? Number(resource.published_year) : null;
  const gradeBand = resource.grade_band ? String(resource.grade_band) : null;
  const subject = resource.subject ? String(resource.subject) : null;
  const accessType = String(resource.access_type ?? "free");
  const resourceUrl = resource.resource_url ? String(resource.resource_url) : null;
  const topicTags = Array.isArray(resource.topic_tags) ? (resource.topic_tags as string[]) : [];

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <RouteHeader
        eyebrow={contentType}
        title={title}
        description={description ?? ""}
      />
      <div className="list-item" style={{ display: "grid", gap: "var(--space-3)" }}>
        <dl style={{ display: "grid", gap: "var(--space-2)" }}>
          {author && (
            <div>
              <dt style={{ fontWeight: 600 }}>Author</dt>
              <dd>{author}</dd>
            </div>
          )}
          {publisher && (
            <div>
              <dt style={{ fontWeight: 600 }}>Publisher</dt>
              <dd>{publisher}</dd>
            </div>
          )}
          {publishedYear && (
            <div>
              <dt style={{ fontWeight: 600 }}>Year</dt>
              <dd>{publishedYear}</dd>
            </div>
          )}
          {subject && (
            <div>
              <dt style={{ fontWeight: 600 }}>Subject</dt>
              <dd>{subject}</dd>
            </div>
          )}
          {gradeBand && (
            <div>
              <dt style={{ fontWeight: 600 }}>Grade Band</dt>
              <dd style={{ textTransform: "capitalize" }}>{gradeBand}</dd>
            </div>
          )}
          <div>
            <dt style={{ fontWeight: 600 }}>Access</dt>
            <dd style={{ textTransform: "capitalize" }}>{accessType}</dd>
          </div>
        </dl>

        {topicTags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1)" }}>
            {topicTags.map((tag) => (
              <span
                key={tag}
                style={{
                  padding: "2px 8px",
                  borderRadius: "var(--radius-full)",
                  background: "var(--color-surface-raised)",
                  fontSize: "var(--text-sm)",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {resourceUrl && (
          <a
            href={resourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-block" }}
          >
            Open resource
          </a>
        )}
      </div>
    </div>
  );
}
