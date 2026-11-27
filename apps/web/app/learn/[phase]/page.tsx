import Link from "next/link";
import { LearnLayout } from "@/components/LearnLayout";
import { getLearnGrades, getLearnSubjectGroups } from "@/lib/learnV2";
import styles from "./GradeCards.module.css";

export default async function LearnPhasePage({ params }: { params: Promise<{ phase: string }> }) {
  const { phase } = await params;
  const grades = getLearnGrades(phase);
  const gradeSubjectCounts = Object.fromEntries(
    grades.map((g) => {
      const groups = getLearnSubjectGroups(phase, g.slug);
      return [g.key, groups.reduce((n, gr) => n + gr.subjects.length, 0)];
    })
  );

  if (!grades.length) {
    return (
      <LearnLayout
        title="Grades"
        backHref="/learn"
        subtitle="No grades available for this phase yet."
      >
        <p className="badge">This phase does not have grades yet.</p>
      </LearnLayout>
    );
  }

  const phaseTitle =
    phase === "foundation"
      ? "Foundation"
      : phase === "intermediate"
        ? "Intermediate"
        : phase === "senior"
          ? "Senior"
          : phase === "fet"
            ? "FET"
            : phase;
  const orderedGrades = [...grades].sort((a, b) => {
    const rank = (key: string) => (key === "R" ? -1 : Number(key));
    return rank(a.key) - rank(b.key);
  });

  return (
    <LearnLayout title={phaseTitle} backHref="/learn">
      <div className={styles.grid}>
        {orderedGrades.map((grade) => {
          const num = grade.key === "R" ? "R" : grade.key;
          const count = gradeSubjectCounts[grade.key];
          return (
            <Link
              key={grade.key}
              href={`/learn/${phase}/${grade.slug}`}
              className={styles.card}
              prefetch={false}
            >
              <div className={styles.badge}>{num}</div>
              <div className={styles.info}>
                <strong className={styles.name}>{grade.name}</strong>
                <span className={styles.meta}>{count ? `${count} subjects` : "View subjects"}</span>
              </div>
              <span className={styles.arrow} aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </Link>
          );
        })}
      </div>
    </LearnLayout>
  );
}
