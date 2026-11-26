import { LearnLayout } from "@/components/LearnLayout";
import { ExamSimulator, type ExamQuestion } from "@/components/ExamSimulator";
import { findLearnSubject, getTermInfo, parseGradeParam } from "@/lib/learnV2";
import { readGeneratedLesson } from "@saedu/shared";

export const runtime = "nodejs";
export const revalidate = 3600;

export default async function ExamPage({
  params,
}: {
  params: Promise<{ phase: string; grade: string; subject: string }>;
}) {
  const { phase, grade, subject } = await params;
  const subjectEntry = findLearnSubject(phase, grade, subject);
  const gradeNumber = parseGradeParam(grade);

  if (!subjectEntry || gradeNumber === null) {
    return (
      <LearnLayout
        title="Exam"
        backHref={`/learn/${phase}/${grade}/${subject}`}
        breadcrumbs={[{ label: "Learn", href: "/learn" }, { label: subject }]}
        subtitle="Subject not found."
      >
        <p className="badge">Check the subject key.</p>
      </LearnLayout>
    );
  }

  // Collect questions from all available generated lessons
  const questions: ExamQuestion[] = [];
  const terms = subjectEntry.terms || {};
  const termNumbers = Object.keys(terms)
    .map((k) => Number(k.replace(/\D/g, "")))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  const resolvedTerms = termNumbers.length ? termNumbers : [1, 2, 3, 4];

  for (const termNumber of resolvedTerms) {
    const { term } = getTermInfo(terms, termNumber);
    const weekCount = term?.weeks?.length ?? 10;
    for (let weekNumber = 1; weekNumber <= weekCount; weekNumber++) {
      try {
        const lesson = readGeneratedLesson({ phase, grade: gradeNumber, subjectKey: subject, term: termNumber, week: weekNumber });
        if (!lesson) continue;
        for (const q of lesson.quiz.questions) {
          questions.push({
            id: `${termNumber}-${weekNumber}-${q.id}`,
            prompt: q.prompt,
            type: q.type === "mcq" ? "mcq" : "short_answer",
            options: q.options,
            answer: q.answer,
            explanation: q.explanation,
            weekNumber,
            termNumber,
          });
        }
      } catch {
        // lesson not generated — skip
      }
    }
  }

  return (
    <LearnLayout
      title={`${subjectEntry.name} — Exam`}
      backHref={`/learn/${phase}/${grade}/${subject}`}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Learn", href: "/learn" },
        { label: phase, href: `/learn/${phase}` },
        { label: `Grade ${gradeNumber}`, href: `/learn/${phase}/${grade}` },
        { label: subjectEntry.name, href: `/learn/${phase}/${grade}/${subject}` },
        { label: "Exam" },
      ]}
      subtitle="Timed exam — 45 minutes, up to 20 questions from across all terms."
    >
      <ExamSimulator
        subject={subject}
        subjectName={subjectEntry.name}
        grade={gradeNumber}
        phase={phase}
        gradeSlug={grade}
        questions={questions}
      />
    </LearnLayout>
  );
}
