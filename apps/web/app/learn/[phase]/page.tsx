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
        <p className="badge">Check the phase value or scaffold data.</p>
      </LearnLayout>
    );
  }

  return (
    <LearnLayout
      title="Grades"
      backHref="/learn"
      subtitle="Choose a grade to explore subjects."
    >
      <div className={styles.grid}>
        {grades.map((grade) => {
          const num = grade.key === "R" ? "R" : grade.key;
          const count = gradeSubjectCounts[grade.key];
          return (
            <Link
              key={grade.key}
              href={`/learn/${phase}/${grade.slug}`}
              className={styles.card}
              prefetch={false}
            >
              <div className={styles.badge} data-phase={phase}>{num}</div>
              <div className={styles.info}>
                <strong className={styles.name}>{grade.name}</strong>
                <span className={styles.meta}>{count ? `${count} subjects` : "View subjects"}</span>
              </div>
              <span className={styles.arrow} aria-hidden="true">→</span>
            </Link>
          );
        })}
      </div>
    </LearnLayout>
  );
}
