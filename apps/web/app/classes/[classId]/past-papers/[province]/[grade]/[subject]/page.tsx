import Link from "next/link";
import { getPastPaperYears } from "@/lib/pastPapers/catalog";
import { PastPapersPrefetchLinks } from "@/components/PastPapersPrefetchLinks";

type YearRow = Awaited<ReturnType<typeof getPastPaperYears>>[number];

function formatGrade(grade: number) {
  return grade === 0 ? "R" : String(grade);
}

export default async function PastPaperSubjectPage({
  params,
}: {
  params: Promise<{ classId: string; province: string; grade: string; subject: string }>;
}) {
  const resolvedParams = await params;
  const province = decodeURIComponent(resolvedParams.province);
  const gradeNumber = Number(resolvedParams.grade);
  const subject = decodeURIComponent(resolvedParams.subject);
  const years = await getPastPaperYears(province, gradeNumber, subject);

  const yearItems = years.map((row: YearRow) => row.year).filter((value: number | null): value is number => value !== null);
  const yearLinks = yearItems.map(
    (item: number) =>
      "/classes/" +
      resolvedParams.classId +
      "/past-papers/" +
      encodeURIComponent(province) +
      "/" +
      gradeNumber +
      "/" +
      encodeURIComponent(subject) +
      "/" +
      item
  );

  return (
    <section className="card glass">
      <PastPapersPrefetchLinks hrefs={yearLinks} />
      <div className="crumbs">
        <Link href={"/classes/" + resolvedParams.classId + "/past-papers"}>Past Papers</Link>
        <span>/</span>
        <Link href={"/classes/" + resolvedParams.classId + "/past-papers/" + encodeURIComponent(province)}>
          {province}
        </Link>
        <span>/</span>
        <Link
          href={
            "/classes/" +
            resolvedParams.classId +
            "/past-papers/" +
            encodeURIComponent(province) +
            "/" +
            gradeNumber
          }
        >
          Grade {formatGrade(gradeNumber)}
        </Link>
        <span>/</span>
        <span>{subject}</span>
      </div>
      <h1 className="title">Select a year</h1>
      <p className="subtitle">Pick the year of the exam paper.</p>
      <div className="grid">
        {yearItems.length ? (
          yearItems.map((item: number) => (
            <Link
              key={item}
              className="button"
              href={
                "/classes/" +
                resolvedParams.classId +
                "/past-papers/" +
                encodeURIComponent(province) +
                "/" +
                gradeNumber +
                "/" +
                encodeURIComponent(subject) +
                "/" +
                item
              }
            >
              {item}
            </Link>
          ))
        ) : (
          <div className="list-item">No years available yet.</div>
        )}
      </div>
    </section>
  );
}
