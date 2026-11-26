import Link from "next/link";
import { getPastPaperSubjects } from "@/lib/pastPapers/catalog";
import { PastPapersPrefetchLinks } from "@/components/PastPapersPrefetchLinks";

type SubjectItem = Awaited<ReturnType<typeof getPastPaperSubjects>>[number];

function formatGrade(grade: number) {
  return grade === 0 ? "R" : String(grade);
}

export default async function PastPaperGradePage({
  params,
}: {
  params: Promise<{ classId: string; province: string; grade: string }>;
}) {
  const resolvedParams = await params;
  const province = decodeURIComponent(resolvedParams.province);
  const gradeNumber = Number(resolvedParams.grade);
  const subjects = await getPastPaperSubjects(province, gradeNumber);
  const subjectLinks = subjects.map(
    (item: SubjectItem) =>
      "/classes/" +
      resolvedParams.classId +
      "/past-papers/" +
      encodeURIComponent(province) +
      "/" +
      gradeNumber +
      "/" +
      encodeURIComponent(item.subject)
  );

  return (
    <section className="card glass">
      <PastPapersPrefetchLinks hrefs={subjectLinks} />
      <div className="crumbs">
        <Link href={"/classes/" + resolvedParams.classId + "/past-papers"}>Past Papers</Link>
        <span>/</span>
        <Link href={"/classes/" + resolvedParams.classId + "/past-papers/" + encodeURIComponent(province)}>
          {province}
        </Link>
        <span>/</span>
        <span>Grade {formatGrade(gradeNumber)}</span>
      </div>
      <h1 className="title">Choose a subject</h1>
      <p className="subtitle">Pick the subject to explore available years.</p>
      <div className="grid">
        {subjects.length ? (
          subjects.map((item: SubjectItem) => (
            <Link
              key={item.subject}
              className="button"
              href={
                "/classes/" +
                resolvedParams.classId +
                "/past-papers/" +
                encodeURIComponent(province) +
                "/" +
                gradeNumber +
                "/" +
                encodeURIComponent(item.subject)
              }
            >
              {item.subject}
            </Link>
          ))
        ) : (
          <div className="list-item">No subjects available yet.</div>
        )}
      </div>
    </section>
  );
}
