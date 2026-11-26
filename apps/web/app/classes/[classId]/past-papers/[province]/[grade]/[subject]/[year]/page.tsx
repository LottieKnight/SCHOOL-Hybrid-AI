import Link from "next/link";
import { getPastPaperSessions } from "@/lib/pastPapers/catalog";
import { PastPapersPrefetchLinks } from "@/components/PastPapersPrefetchLinks";

type SessionItem = Awaited<ReturnType<typeof getPastPaperSessions>>[number];

function formatGrade(grade: number) {
  return grade === 0 ? "R" : String(grade);
}

export default async function PastPaperYearPage({
  params,
}: {
  params: Promise<{ classId: string; province: string; grade: string; subject: string; year: string }>;
}) {
  const resolvedParams = await params;
  const province = decodeURIComponent(resolvedParams.province);
  const gradeNumber = Number(resolvedParams.grade);
  const subject = decodeURIComponent(resolvedParams.subject);
  const yearNumber = Number(resolvedParams.year);
  const sessions = await getPastPaperSessions(province, gradeNumber, subject, yearNumber);
  const sessionLinks = sessions.map(
    (item: SessionItem) =>
      "/classes/" +
      resolvedParams.classId +
      "/past-papers/" +
      encodeURIComponent(province) +
      "/" +
      gradeNumber +
      "/" +
      encodeURIComponent(subject) +
      "/" +
      yearNumber +
      "/" +
      encodeURIComponent(item.session)
  );

  return (
    <section className="card glass">
      <PastPapersPrefetchLinks hrefs={sessionLinks} />
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
        <Link
          href={
            "/classes/" +
            resolvedParams.classId +
            "/past-papers/" +
            encodeURIComponent(province) +
            "/" +
            gradeNumber +
            "/" +
            encodeURIComponent(subject)
          }
        >
          {subject}
        </Link>
        <span>/</span>
        <span>{yearNumber}</span>
      </div>
      <h1 className="title">Select a session</h1>
      <p className="subtitle">Choose the exam session.</p>
      <div className="grid">
        {sessions.length ? (
          sessions.map((item: SessionItem) => (
            <Link
              key={item.session}
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
                yearNumber +
                "/" +
                encodeURIComponent(item.session)
              }
            >
              {item.session}
            </Link>
          ))
        ) : (
          <div className="list-item">No sessions available yet.</div>
        )}
      </div>
    </section>
  );
}
