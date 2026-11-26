import Link from "next/link";
import type { PastPaperListItem } from "@/lib/pastPapers/catalog";

function formatGrade(grade: number | null): string {
  if (grade === null) return "University";
  if (grade === 0) return "Grade R";
  return `Grade ${grade}`;
}

type Props = { paper: PastPaperListItem };

export function PastPaperCard({ paper }: Props) {
  return (
    <Link href={`/past-papers/${paper.id}`} className="pp-card">
      <div className="pp-card-subject">{paper.subject}</div>

      <div className="pp-card-badges">
        <span className="pp-badge pp-badge-grade">{formatGrade(paper.grade)}</span>
        {paper.year && <span className="pp-badge">{paper.year}</span>}
        {paper.session && <span className="pp-badge">{paper.session}</span>}
      </div>

      <div className="pp-card-meta">
        <span className="pp-badge pp-badge-muted">
          Paper {paper.paperNumber}
        </span>
        <span className="pp-badge pp-badge-muted">
          {paper.language}
        </span>
        {paper.moduleCode && (
          <span className="pp-badge pp-badge-muted">{paper.moduleCode}</span>
        )}
      </div>

      <div className="pp-card-footer">
        {paper.hasMemo ? (
          <span className="pp-memo-badge pp-memo-available">✓ Memo</span>
        ) : (
          <span className="pp-memo-badge pp-memo-pending">Memo pending</span>
        )}
        <span className="pp-card-cta">View Paper →</span>
      </div>
    </Link>
  );
}
