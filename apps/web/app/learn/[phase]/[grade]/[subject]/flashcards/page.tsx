import { LearnLayout } from "@/components/LearnLayout";
import { FlashcardDeck, type Flashcard } from "@/components/FlashcardDeck";
import { findLearnSubject, getTermInfo, parseGradeParam } from "@/lib/learnV2";
import { readGeneratedLesson } from "@saedu/shared";

export const runtime = "nodejs";
export const revalidate = 3600;

export default async function FlashcardsPage({
  params,
}: {
  params: Promise<{ phase: string; grade: string; subject: string }>;
}) {
  const { phase, grade, subject } = await params;
  const subjectEntry = findLearnSubject(phase, grade, subject);
  const gradeNumber = parseGradeParam(grade);

  if (!subjectEntry || gradeNumber === null) {
    return (
      <LearnLayout title="Flashcards" backHref={`/learn/${phase}/${grade}/${subject}`}
        breadcrumbs={[{ label: "Learn", href: "/learn" }]} subtitle="Subject not found.">
        <p className="badge">Check the subject key.</p>
      </LearnLayout>
    );
  }

  const cards: Flashcard[] = [];
  const terms = subjectEntry.terms || {};
  const termNumbers = Object.keys(terms).map((k) => Number(k.replace(/\D/g, ""))).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  const resolvedTerms = termNumbers.length ? termNumbers : [1, 2, 3, 4];

  for (const termNumber of resolvedTerms) {
    const { term } = getTermInfo(terms, termNumber);
    const weekCount = term?.weeks?.length ?? 10;
    for (let weekNumber = 1; weekNumber <= weekCount; weekNumber++) {
      try {
        const lesson = readGeneratedLesson({ phase, grade: gradeNumber, subjectKey: subject, term: termNumber, week: weekNumber });
        if (!lesson) continue;
        // One card per objective
        for (const obj of lesson.objectives) {
          cards.push({
            id: `${termNumber}-${weekNumber}-obj-${cards.length}`,
            front: obj,
            back: lesson.summary,
            weekNumber, termNumber,
          });
        }
        // One card per quiz question
        for (const q of lesson.quiz.questions) {
          if (q.type === "mcq") {
            cards.push({
              id: `${termNumber}-${weekNumber}-q-${q.id}`,
              front: q.prompt,
              back: `${q.answer} — ${q.explanation}`,
              weekNumber, termNumber,
            });
          }
        }
      } catch { /* skip */ }
    }
  }

  return (
    <LearnLayout
      title={`${subjectEntry.name} — Flashcards`}
      backHref={`/learn/${phase}/${grade}/${subject}`}
      breadcrumbs={[
        { label: "Home", href: "/" }, { label: "Learn", href: "/learn" },
        { label: phase, href: `/learn/${phase}` },
        { label: `Grade ${gradeNumber}`, href: `/learn/${phase}/${grade}` },
        { label: subjectEntry.name, href: `/learn/${phase}/${grade}/${subject}` },
        { label: "Flashcards" },
      ]}
      subtitle={`${cards.length} cards across all lessons. Tap a card to flip it, then rate your confidence.`}
    >
      <FlashcardDeck subject={subject} grade={gradeNumber} cards={cards} />
    </LearnLayout>
  );
}
