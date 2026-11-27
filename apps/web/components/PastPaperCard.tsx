import Link from "next/link";
import type { PastPaperListItem } from "@/lib/pastPapers/catalog";
import { formatGradeLabel, memoStatusLabel, practiceHref } from "@/lib/pastPapers/indexing";

type Props = { paper: PastPaperListItem };

export function PastPaperCard({ paper }: Props) {
  const detailHref = `/past-papers/${paper.id}`;
  const paperHref = `${detailHref}?doc=paper`;
  const memoHref = `${detailHref}?doc=memo`;

  return (
    <article className="pp-card">
      <Link href={detailHref} className="pp-card-open">
        <h2 className="pp-card-title">{paper.title}</h2>
      </Link>
      <div className="pp-card-badges">
        <span className="pp-badge pp-badge-grade">{formatGradeLabel(paper.grade)}</span>
        {paper.year ? <span className="pp-badge">{paper.year}</span> : null}
        {paper.session ? <span className="pp-badge">{paper.session}</span> : null}
        <span className="pp-badge">{paper.language}</span>
      </div>
      <div className="pp-card-actions">
        <span className={`pp-memo-badge pp-memo-${paper.memoStatus}`}>{memoStatusLabel(paper.memoStatus)}</span>
        <Link className="pp-action" href={paperHref}>
          Paper
        </Link>
        {paper.memoStatus === "available" ? (
          <Link className="pp-action" href={memoHref}>
            Memo
          </Link>
        ) : null}
        <Link className="pp-action pp-action-practice" href={practiceHref(paper)}>
          Practice
        </Link>
      </div>
    </article>
  );
}
