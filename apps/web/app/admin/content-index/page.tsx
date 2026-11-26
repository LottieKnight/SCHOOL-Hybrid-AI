import { BackLink } from "@/components/BackLink";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ContentIndexAdminActions } from "@/components/ContentIndexAdminActions";
import { AdminQuickLinks } from "@/components/AdminQuickLinks";
import { AdminGenerateTermV1 } from "@/components/AdminGenerateTermV1";
import { AdminGenerateWeekRangeV1 } from "@/components/AdminGenerateWeekRangeV1";
import { loadContentIndex } from "@/lib/contentIndex";
import { summarizeContentIndex } from "@saedu/shared";

export default async function ContentIndexAdminPage() {
  const index = loadContentIndex();
  const summary = index?.stats ?? summarizeContentIndex(index);
  const missingAreas: { label: string; count: number }[] = [];

  if (index) {
    for (const [phaseKey, phase] of Object.entries(index.phases || {})) {
      for (const [gradeKey, grade] of Object.entries(phase.grades || {})) {
        for (const [subjectKey, subject] of Object.entries(grade.subjects || {})) {
          let resourcesOnlyCount = 0;
          for (const term of Object.values(subject.terms || {})) {
            for (const week of Object.values(term.weeks || {})) {
              if (!week.hasLessonJson && week.resourcesCount > 0) {
                resourcesOnlyCount += 1;
              }
            }
          }
          if (resourcesOnlyCount > 0) {
            missingAreas.push({
              label: `${phaseKey} Grade ${gradeKey} ${subjectKey}`,
              count: resourcesOnlyCount,
            });
          }
        }
      }
    }
  }

  missingAreas.sort((a, b) => b.count - a.count);

  return (
    <div className="glass card card-with-back">
      <BackLink href="/admin" />
      <Breadcrumbs items={[{ label: "Admin", href: "/admin" }, { label: "Content Index" }]} />
      <h1 className="title">Content Index</h1>
      <p className="subtitle">Track and regenerate available content inventory.</p>
      <AdminQuickLinks />

      <div className="spacer" />
      <ContentIndexAdminActions initialSummary={summary} />
      <AdminGenerateWeekRangeV1 />
      <AdminGenerateTermV1 />

      {missingAreas.length ? (
        <>
          <div className="spacer" />
          <h2 className="subtitle">Top missing areas (resources only)</h2>
          <div className="grid">
            {missingAreas.slice(0, 10).map((area) => (
              <div key={area.label} className="list-item">
                <strong>{area.label}</strong>
                <div className="badge">{area.count} weeks</div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
