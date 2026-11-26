import { Suspense } from "react";
import { searchPastPapers } from "@/lib/pastPapers/catalog";
import { PastPapersFilterBar } from "@/components/PastPapersFilterBar";
import { PastPaperCard } from "@/components/PastPaperCard";

export const dynamic = "force-dynamic";

type SearchParams = {
  grade?: string;
  subject?: string;
  year?: string;
  session?: string;
  language?: string;
  hasMemo?: string;
  q?: string;
  page?: string;
};

function toInt(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

const PAGE_SIZE = 24;

export default async function PastPapersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const { items, total } = await searchPastPapers({
    grade: toInt(sp.grade),
    subject: sp.subject || undefined,
    year: toInt(sp.year),
    session: sp.session || undefined,
    language: sp.language || undefined,
    hasMemo: sp.hasMemo === "1" ? true : undefined,
    q: sp.q || undefined,
    limit: PAGE_SIZE,
    offset,
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="past-papers-root">
      <div className="past-papers-header">
        <h1 className="title">Past Papers</h1>
        <p className="subtitle">
          {total > 0
            ? `${total.toLocaleString()} paper${total !== 1 ? "s" : ""} available`
            : "Search and filter to find papers"}
        </p>
      </div>

      <Suspense>
        <PastPapersFilterBar
          activeGrade={sp.grade}
          activeSubject={sp.subject}
          activeYear={sp.year}
          activeSession={sp.session}
          activeLanguage={sp.language}
          activeMemo={sp.hasMemo}
          activeQ={sp.q}
        />
      </Suspense>

      {items.length === 0 ? (
        <div className="past-papers-empty">
          <p>No papers match these filters — try widening your search.</p>
        </div>
      ) : (
        <>
          <div className="past-papers-grid">
            {items.map((paper) => (
              <PastPaperCard key={paper.id} paper={paper} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="past-papers-pagination">
              {page > 1 && (
                <a
                  className="button"
                  href={buildPageHref(sp, page - 1)}
                >
                  ← Previous
                </a>
              )}
              <span className="past-papers-page-info">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <a
                  className="button"
                  href={buildPageHref(sp, page + 1)}
                >
                  Next →
                </a>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function buildPageHref(sp: SearchParams, page: number): string {
  const params = new URLSearchParams();
  if (sp.grade) params.set("grade", sp.grade);
  if (sp.subject) params.set("subject", sp.subject);
  if (sp.year) params.set("year", sp.year);
  if (sp.session) params.set("session", sp.session);
  if (sp.language) params.set("language", sp.language);
  if (sp.hasMemo) params.set("hasMemo", sp.hasMemo);
  if (sp.q) params.set("q", sp.q);
  params.set("page", String(page));
  return `/past-papers?${params.toString()}`;
}
