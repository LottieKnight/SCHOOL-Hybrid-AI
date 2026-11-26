import { LearnLayout } from "@/components/LearnLayout";
import { TermProgressMap } from "@/components/TermProgressMap";
import { findLearnSubject, formatTermLabel, getTermInfo, parseGradeParam } from "@/lib/learnV2";
import { cookies } from "next/headers";
import { isLocale as isLessonLocale, type Locale } from "@/lib/locale";
import { LessonLanguageSelector } from "@/components/LessonLanguageSelector";

export default async function LearnTermPage({
  params,
}: {
  params: Promise<{ phase: string; grade: string; subject: string; term: string }>;
}) {
  const { phase, grade, subject, term } = await params;
  const termNumber = Number(term);
  const subjectEntry = findLearnSubject(phase, grade, subject);
  const gradeNumber = parseGradeParam(grade);
  const cookieStore = await cookies();
  const lessonLanguage =
    cookieStore.get("LESSON_LANGUAGE")?.value && isLessonLocale(cookieStore.get("LESSON_LANGUAGE")!.value)
      ? (cookieStore.get("LESSON_LANGUAGE")!.value as Locale)
      : "en";

  if (!subjectEntry || !Number.isFinite(termNumber)) {
    return (
      <LearnLayout
        title="Weeks"
        backHref={`/learn/${phase}/${grade}/${subject}`}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Learn", href: "/learn" },
          { label: phase, href: `/learn/${phase}` },
          { label: gradeNumber === null ? `Grade ${grade}` : `Grade ${gradeNumber}`, href: `/learn/${phase}/${grade}` },
          { label: subjectEntry?.name ?? subject, href: `/learn/${phase}/${grade}/${subject}` },
          { label: "Term" },
        ]}
        subtitle="Term not found."
      >
        <p className="badge">Check the term value.</p>
      </LearnLayout>
    );
  }

  const terms = subjectEntry.terms || {};
  const { term: termEntry } = getTermInfo(terms, termNumber);
  const weeks = termEntry?.weeks?.length ? termEntry.weeks : Array.from({ length: 10 }, (_, idx) => ({
    name: `Week ${idx + 1}`,
    topic_title: `Week ${idx + 1} overview`,
  }));

  return (
    <LearnLayout
      title={`${subjectEntry.name} · ${formatTermLabel(termNumber, termEntry?.name)}`}
      backHref={`/learn/${phase}/${grade}/${subject}`}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Learn", href: "/learn" },
        { label: phase, href: `/learn/${phase}` },
        { label: gradeNumber === null ? `Grade ${grade}` : `Grade ${gradeNumber}`, href: `/learn/${phase}/${grade}` },
        { label: subjectEntry.name, href: `/learn/${phase}/${grade}/${subject}` },
        { label: formatTermLabel(termNumber, termEntry?.name) },
      ]}
      subtitle="Follow the path — each node is a week. Gold means done, pulsing means in progress."
    >
      <div style={{ marginBottom: 16 }}>
        <LessonLanguageSelector current={lessonLanguage} />
      </div>
      <TermProgressMap
        phase={phase}
        grade={grade}
        subject={subject}
        termNumber={termNumber}
        weeks={weeks.map((week, idx) => ({
          index: idx + 1,
          name: week.name || `Week ${idx + 1}`,
          topicTitle: week.topic_title || "Weekly overview",
          href: `/learn/${phase}/${grade}/${subject}/term/${termNumber}/week/${idx + 1}`,
        }))}
      />
    </LearnLayout>
  );
}
