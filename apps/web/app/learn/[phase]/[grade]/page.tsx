import { LearnLayout } from "@/components/LearnLayout";
import { LearnSubjectGroupsExplorer } from "@/components/LearnSubjectGroupsExplorer";
import { ContinueLearningCard } from "@/components/ContinueLearningCard";
import { getLearnGrades, getLearnSubjectGroups, type LearnGrade } from "@/lib/learnV2";

export default async function LearnGradePage({
  params,
}: {
  params: Promise<{ phase: string; grade: string }>;
}) {
  const { phase, grade } = await params;
  const grades: LearnGrade[] = getLearnGrades(phase);
  const gradeEntry: LearnGrade | undefined = grades.find((entry) => entry.slug === grade);
  const subjectGroups = gradeEntry ? getLearnSubjectGroups(phase, grade) : [];
  const subjectCount = subjectGroups.reduce((total, group) => total + group.subjects.length, 0);

  if (!gradeEntry) {
    return (
      <LearnLayout
        title="Subjects"
        backHref={`/learn/${phase}`}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Learn", href: "/learn" },
          { label: phase, href: `/learn/${phase}` },
          { label: `Grade ${grade}` },
        ]}
        subtitle="Invalid grade."
      >
        <p className="badge">Check the grade value.</p>
      </LearnLayout>
    );
  }

  return (
    <LearnLayout
      title={`${gradeEntry.name} subjects`}
      backHref={`/learn/${phase}`}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Learn", href: "/learn" },
        { label: phase, href: `/learn/${phase}` },
        { label: gradeEntry.name },
      ]}
      subtitle="Choose a subject to explore terms. Subjects are grouped so electives and core subjects are easier to scan."
    >
      <ContinueLearningCard phase={phase} grade={grade} />
      {subjectCount > 0 ? (
        <LearnSubjectGroupsExplorer
          phase={phase}
          grade={grade}
          gradeName={gradeEntry.name}
          groups={subjectGroups.map((group) => ({
            key: group.key,
            name: group.name,
            category: group.category,
            subjects: group.subjects.map((subject) => ({
              key: subject.key,
              name: subject.name,
              termCount: Object.keys(subject.terms || {}).length || 4,
            })),
          }))}
        />
      ) : (
        <div className="list">
          <div className="list-item">
            <strong>No subjects available yet</strong>
            <div className="badge">This grade has not been mapped in the CAPS scaffold.</div>
          </div>
        </div>
      )}
    </LearnLayout>
  );
}
