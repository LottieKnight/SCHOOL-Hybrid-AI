import Link from "next/link";
import { getPastPapers } from "@/lib/pastPapers/catalog";
import { languageLabel, sessionLabel } from "@/lib/pastPapers/indexing";
import { PastPapersPrefetchLinks } from "@/components/PastPapersPrefetchLinks";

type PaperItem = Awaited<ReturnType<typeof getPastPapers>>[number];

function formatGrade(grade: number) {
  return grade === 0 ? "R" : String(grade);
}

export default async function PastPaperSessionPage({
  params,
}: {
  params: Promise<{
    classId: string;
    province: string;
    grade: string;
    subject: string;
    year: string;
    session: string;
  }>;
}) {
  const resolvedParams = await params;
  const province = decodeURIComponent(resolvedParams.province);
  const gradeNumber = Number(resolvedParams.grade);
  const subject = decodeURIComponent(resolvedParams.subject);
  const yearNumber = Number(resolvedParams.year);
  const session = decodeURIComponent(resolvedParams.session);

  const papers = await getPastPapers(province, gradeNumber, subject, yearNumber, session);
  const paperLinks = papers.map(
    (paper: PaperItem) =>
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
      encodeURIComponent(session) +
      "/" +
      paper.id
  );

  return (
    <section className="card glass">
      <PastPapersPrefetchLinks hrefs={paperLinks} />
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
        <Link
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
            yearNumber
          }
        >
          {yearNumber}
        </Link>
        <span>/</span>
        <span>{sessionLabel(session)}</span>
      </div>
      <h1 className="title">Available papers</h1>
      <p className="subtitle">Select a paper to view details and start a live attempt.</p>
      <div className="list">
        {papers.length ? (
          papers.map((paper: PaperItem) => (
            <Link
              key={paper.id}
              className="list-item"
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
                encodeURIComponent(session) +
                "/" +
                paper.id
              }
            >
              <div>
                <strong>{paper.title}</strong>
                <div className="badge">
                  Paper {paper.paperNumber} · {languageLabel(paper.language)}
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="list-item">No papers found for this session.</div>
        )}
      </div>
    </section>
  );
}
