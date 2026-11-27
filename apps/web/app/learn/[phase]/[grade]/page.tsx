import { LearnLayout } from "@/components/LearnLayout";
import { LearnSubjectGroupsExplorer } from "@/components/LearnSubjectGroupsExplorer";
import { ContinueLearningCard } from "@/components/ContinueLearningCard";
import { termPlansFromTerms } from "@/lib/lessons/catalogue";
import { getLearnGrades, getLearnSubjectGroups, parseGradeParam, type LearnGrade } from "@/lib/learnV2";

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
      title={gradeEntry.name}
      backHref={`/learn/${phase}`}
      breadcrumbs={[
        { label: "Learn", href: "/learn" },
        { label: phase, href: `/learn/${phase}` },
        { label: gradeEntry.name },
      ]}
    >
      <ContinueLearningCard phase={phase} grade={grade} />
      {subjectCount > 0 ? (
        <LearnSubjectGroupsExplorer
          phase={phase}
          grade={grade}
          gradeNumber={parseGradeParam(grade) ?? 0}
          gradeName={gradeEntry.name}
          groups={subjectGroups.map((group) => ({
            key: group.key,
            name: group.name,
            category: group.category,
            subjects: group.subjects.map((subject) => {
              const terms = termPlansFromTerms(subject.terms);
              return {
                key: subject.key,
                name: subject.name,
                termCount: terms.length,
                terms,
              };
            }),
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
