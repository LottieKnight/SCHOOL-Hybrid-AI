import { Suspense } from "react";
import { getCatalogFilterOptions, searchPastPapers } from "@/lib/pastPapers/catalog";
import { parseGradeQuery } from "@/lib/pastPapers/indexing";
import { PastPapersFilterBar } from "@/components/PastPapersFilterBar";
import { PastPaperCard } from "@/components/PastPaperCard";
import { ProfilePathHint } from "@/components/profile/ProfilePathHint";

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

function toInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
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
  const gradeQuery = parseGradeQuery(sp.grade);

  const [{ items, total }, filters] = await Promise.all([
    searchPastPapers({
      grade: gradeQuery.grade,
      allGrades: gradeQuery.allGrades,
      subject: sp.subject || undefined,
      year: toInt(sp.year),
      session: sp.session || undefined,
      language: sp.language || undefined,
      hasMemo: sp.hasMemo === "1" ? true : undefined,
      q: sp.q || undefined,
      limit: PAGE_SIZE,
      offset,
    }),
    getCatalogFilterOptions(),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const scopeLabel = sp.grade === "all" ? "All grades" : sp.grade ? `Grade ${sp.grade}` : "Grades 10–12";

  return (
    <div className="past-papers-root">
      <header className="pp-head">
        <div>
          <p className="pp-kicker">NSC catalogue</p>
          <h1 className="pp-title">Past papers</h1>
        </div>
        <p className="pp-count">
          {total > 0 ? `${total.toLocaleString()} papers` : "No matches"}
          <span>{scopeLabel}</span>
        </p>
      </header>

      <Suspense>
        <ProfilePathHint surface="past-papers" />
        <PastPapersFilterBar
          activeGrade={sp.grade}
          activeSubject={sp.subject}
          activeYear={sp.year}
          activeSession={sp.session}
          activeLanguage={sp.language}
          activeMemo={sp.hasMemo}
          activeQ={sp.q}
          subjects={filters.subjects}
          years={filters.years}
        />
      </Suspense>

      {items.length === 0 ? (
        <div className="past-papers-empty">
          <p>No papers match these filters. Clear one and try again.</p>
        </div>
      ) : (
        <>
          <div className="past-papers-grid">
            {items.map((paper) => (
              <PastPaperCard key={paper.id} paper={paper} />
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="past-papers-pagination">
              {page > 1 ? (
                <a className="pp-action" href={buildPageHref(sp, page - 1)}>
                  Previous
                </a>
              ) : (
                <span />
              )}
              <span className="past-papers-page-info">
                {page} / {totalPages}
              </span>
              {page < totalPages ? (
                <a className="pp-action" href={buildPageHref(sp, page + 1)}>
                  Next
                </a>
              ) : (
                <span />
              )}
            </div>
          ) : null}
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
