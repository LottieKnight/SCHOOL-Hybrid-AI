import Link from "next/link";
import { getPastPaperGrades } from "@/lib/pastPapers/catalog";
import { PastPapersPrefetchLinks } from "@/components/PastPapersPrefetchLinks";

type GradeRow = Awaited<ReturnType<typeof getPastPaperGrades>>[number];

function formatGrade(grade: number) {
  return grade === 0 ? "R" : String(grade);
}

export default async function PastPaperProvincePage({
  params,
}: {
  params: Promise<{ classId: string; province: string }>;
}) {
  const resolvedParams = await params;
  const province = decodeURIComponent(resolvedParams.province);
  const grades = await getPastPaperGrades(province);

  const gradeItems = grades.map((row: GradeRow) => row.grade).filter((value: number | null): value is number => value !== null);
  const gradeLinks = gradeItems.map(
    (grade: number) =>
      "/classes/" +
      resolvedParams.classId +
      "/past-papers/" +
      encodeURIComponent(province) +
      "/" +
      grade
  );

  return (
    <section className="card glass">
      <PastPapersPrefetchLinks hrefs={gradeLinks} />
      <div className="crumbs">
        <Link href={"/classes/" + resolvedParams.classId + "/past-papers"}>Past Papers</Link>
        <span>/</span>
        <span>{province}</span>
      </div>
      <h1 className="title">Choose a grade</h1>
      <p className="subtitle">Select the grade level to continue.</p>
      <div className="grid">
        {gradeItems.length ? (
          gradeItems.map((grade: number) => (
            <Link
              key={grade}
              className="button"
              href={
                "/classes/" +
                resolvedParams.classId +
                "/past-papers/" +
                encodeURIComponent(province) +
                "/" +
                grade
              }
            >
              Grade {formatGrade(grade)}
            </Link>
          ))
        ) : (
          <div className="list-item">No grades available yet.</div>
        )}
      </div>
    </section>
  );
}
