import { LearnLayout } from "@/components/LearnLayout";
import { SubjectRoadmap } from "@/components/SubjectRoadmap";
import { ScopeProgress } from "@/components/learn/ScopeProgress";
import { findLearnSubject, formatTermLabel, getTermInfo, parseGradeParam } from "@/lib/learnV2";
import { enumerateLessonIds } from "@/lib/lessons/schema";
import { cookies } from "next/headers";
import { isLocale as isLessonLocale, type Locale } from "@/lib/locale";
import { LessonLanguageSelector } from "@/components/LessonLanguageSelector";

function sortedTermNumbers(terms: Record<string, { name: string }>) {
  return Object.keys(terms)
    .map((key) => Number(key.replace(/\D/g, "")))
    .filter((num) => Number.isFinite(num))
    .sort((a, b) => a - b);
}

export default async function LearnSubjectPage({
  params,
}: {
  params: Promise<{ phase: string; grade: string; subject: string }>;
}) {
  const { phase, grade, subject } = await params;
  const subjectEntry = findLearnSubject(phase, grade, subject);
  const gradeNumber = parseGradeParam(grade);
  const cookieStore = await cookies();
  const lessonLanguage =
    cookieStore.get("LESSON_LANGUAGE")?.value && isLessonLocale(cookieStore.get("LESSON_LANGUAGE")!.value)
      ? (cookieStore.get("LESSON_LANGUAGE")!.value as Locale)
      : "en";

  if (!subjectEntry || gradeNumber === null) {
    return (
      <LearnLayout
        title="Terms"
        backHref={`/learn/${phase}/${grade}`}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Learn", href: "/learn" },
          { label: phase, href: `/learn/${phase}` },
          { label: `Grade ${gradeNumber ?? grade}`, href: `/learn/${phase}/${grade}` },
          { label: subject },
        ]}
        subtitle="Subject not found."
      >
        <p className="badge">Check the subject key.</p>
      </LearnLayout>
    );
  }

  const terms = subjectEntry.terms || {};
  const termNumbers = sortedTermNumbers(terms);
  const resolvedTerms = termNumbers.length ? termNumbers : [1, 2, 3, 4];

  const termPanels = resolvedTerms.map((termNumber) => {
    const { term } = getTermInfo(terms, termNumber);
    const weeks = term?.weeks?.length
      ? term.weeks.map((week, idx) => ({
          index: idx + 1,
          topicTitle: week.topic_title || `Week ${idx + 1} overview`,
          href: `/learn/${phase}/${grade}/${subject}/term/${termNumber}/week/${idx + 1}`,
        }))
      : Array.from({ length: 10 }, (_, idx) => ({
          index: idx + 1,
          topicTitle: `Week ${idx + 1} overview`,
          href: `/learn/${phase}/${grade}/${subject}/term/${termNumber}/week/${idx + 1}`,
        }));
    return {
      termNumber,
      termName: formatTermLabel(termNumber, term?.name),
      weekCount: weeks.length,
      weeks,
      href: `/learn/${phase}/${grade}/${subject}/term/${termNumber}`,
    };
  });

  return (
    <LearnLayout
      title={subjectEntry.name}
      backHref={`/learn/${phase}/${grade}`}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Learn", href: "/learn" },
        { label: phase, href: `/learn/${phase}` },
        { label: `Grade ${gradeNumber}`, href: `/learn/${phase}/${grade}` },
        { label: subjectEntry.name },
      ]}
    >
      <div style={{ marginBottom: 16 }}>
        <LessonLanguageSelector current={lessonLanguage} />
      </div>
      <ScopeProgress
        label={`${subjectEntry.name} progress`}
        groups={termPanels.map((term) => ({
          key: String(term.termNumber),
          label: term.termName,
          lessonIds: enumerateLessonIds([
            {
              phase,
              grade: gradeNumber,
              subjectKey: subject,
              term: term.termNumber,
              weeks: term.weekCount,
            },
          ]),
        }))}
      />
      <SubjectRoadmap
        phase={phase}
        grade={grade}
        subject={subject}
        subjectName={subjectEntry.name}
        gradeNumber={gradeNumber}
        terms={termPanels}
      />
    </LearnLayout>
  );
}
