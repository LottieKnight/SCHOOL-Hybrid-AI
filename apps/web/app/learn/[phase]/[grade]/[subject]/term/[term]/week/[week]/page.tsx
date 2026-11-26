import Link from "next/link";
import { LearnLayout } from "@/components/LearnLayout";
import { LearnProgressPanel } from "@/components/LearnProgressPanel";
import { NextBestActionCard } from "@/components/NextBestActionCard";
import { PerformanceSampleBeacon } from "@/components/PerformanceSampleBeacon";
import { LivePresenceCounter } from "@/components/LivePresenceCounter";
import { MnemonicGenerator } from "@/components/MnemonicGenerator";
import { AudioPlayer } from "@/components/AudioPlayer";
import { SmartNotesEditor } from "@/components/SmartNotesEditor";
import { VideoPlayer } from "@/components/VideoPlayer";
import { findLearnSubject, formatTermLabel, getTermInfo, parseGradeParam } from "@/lib/learnV2";
import { resolveLearnPastPaperSuggestion } from "@/lib/nextBestActionServer";
import { readGeneratedLesson } from "@saedu/shared";
import { cookies } from "next/headers";
import { isLocale as isLessonLocale, type Locale } from "@/lib/locale";
import { LessonLanguageSelector } from "@/components/LessonLanguageSelector";

export const runtime = "nodejs";
export const revalidate = 900;

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export default async function LearnWeekPage({
  params,
}: {
  params: Promise<{ phase: string; grade: string; subject: string; term: string; week: string }>;
}) {
  const { phase, grade, subject, term, week } = await params;
  const termNumber = Number(term);
  const weekNumber = Number(week);
  const gradeNumber = parseGradeParam(grade);
  const subjectEntry = findLearnSubject(phase, grade, subject);

  // Learner's chosen lesson-content language (cookie set by LessonLanguageSelector).
  const cookieStore = await cookies();
  const lessonLangCookie = cookieStore.get("LESSON_LANGUAGE")?.value;
  const lessonLanguage = lessonLangCookie && isLessonLocale(lessonLangCookie) ? lessonLangCookie : "en";

  if (!subjectEntry || !Number.isFinite(termNumber) || !Number.isFinite(weekNumber) || gradeNumber === null) {
    return (
      <LearnLayout
        title="Week"
        backHref={`/learn/${phase}/${grade}/${subject}/term/${term}`}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Learn", href: "/learn" },
          { label: phase, href: `/learn/${phase}` },
          { label: gradeNumber === null ? `Grade ${grade}` : `Grade ${gradeNumber}`, href: `/learn/${phase}/${grade}` },
          { label: subjectEntry?.name ?? subject, href: `/learn/${phase}/${grade}/${subject}` },
          { label: `Term ${term}`, href: `/learn/${phase}/${grade}/${subject}/term/${term}` },
          { label: `Week ${week}` },
        ]}
        subtitle="Week not found."
      >
        <p className="badge">Check the week value.</p>
      </LearnLayout>
    );
  }

  const { term: termEntry } = getTermInfo(subjectEntry.terms || {}, termNumber);
  const weekEntry = termEntry?.weeks?.[weekNumber - 1];
  const lesson = readGeneratedLesson({
    phase,
    grade: gradeNumber,
    subjectKey: subject,
    term: termNumber,
    week: weekNumber,
    language: lessonLanguage,
  });
  const lessonKey = `${pad2(gradeNumber)}-${subject}-${pad2(termNumber)}-${pad2(weekNumber)}`;
  const totalWeeks = termEntry?.weeks?.length ?? 10;
  const prefetchHrefs = [weekNumber + 1, weekNumber + 2]
    .filter((nextWeek) => nextWeek <= totalWeeks)
    .map((nextWeek) => `/learn/${phase}/${grade}/${subject}/term/${termNumber}/week/${nextWeek}`);
  const pastPaperSuggestion = await resolveLearnPastPaperSuggestion({
    grade: gradeNumber,
    subjectKey: subject,
    subjectName: subjectEntry.name,
  });

  const mnemonicTerms = lesson?.quiz.questions.map(q => q.prompt.split(' ').slice(0, 3).join(' ')) || [];

  const fullText = lesson ? [
    lesson.title,
    lesson.summary,
    ...lesson.objectives,
    ...lesson.sections.explanation.map(s => `${s.heading}. ${s.content}`)
  ].join(". ") : "";

  return (
    <LearnLayout
      title={`${subjectEntry.name} - ${formatTermLabel(termNumber, termEntry?.name)} - Week ${weekNumber}`}
      backHref={`/learn/${phase}/${grade}/${subject}/term/${termNumber}`}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Learn", href: "/learn" },
        { label: phase, href: `/learn/${phase}` },
        { label: gradeNumber === null ? `Grade ${grade}` : `Grade ${gradeNumber}`, href: `/learn/${phase}/${grade}` },
        { label: subjectEntry.name, href: `/learn/${phase}/${grade}/${subject}` },
        { label: formatTermLabel(termNumber, termEntry?.name), href: `/learn/${phase}/${grade}/${subject}/term/${termNumber}` },
        { label: `Week ${weekNumber}` },
      ]}
      subtitle={weekEntry?.topic_title || "Weekly lesson content."}
    >
      <div className="list">
        {lesson ? (
          <>
            <PerformanceSampleBeacon routeTag="/learn/week" />
            <div style={{ marginBottom: "16px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <LivePresenceCounter moduleCode={subject} />
              <MnemonicGenerator terms={mnemonicTerms} />
              <AudioPlayer text={fullText} />
              <LessonLanguageSelector current={lessonLanguage as Locale} />
            </div>
            <LearnProgressPanel
              lessonKey={lessonKey}
              sections={[
                { key: "objectives", label: "Objectives" },
                { key: "explanation", label: "Explanation" },
                { key: "worked_examples", label: "Worked examples" },
                { key: "guided_practice", label: "Guided practice" },
                { key: "independent_practice", label: "Independent practice" },
                { key: "quiz", label: "Quiz" },
                { key: "references", label: "References" },
              ]}
              prefetchHrefs={prefetchHrefs}
            />
            <SmartNotesEditor />
            <NextBestActionCard
              heading="Golden path: Learn -> Past Papers"
              title="Practice this week with a matching past paper"
              description={`Move from lesson study to exam practice in ${subjectEntry.name}.`}
              primaryAction={{
                label: "Open matching past papers",
                href: pastPaperSuggestion.href,
              }}
              secondaryAction={{
                label: "View wallet pricing",
                href: "/wallet",
              }}
              footnote={pastPaperSuggestion.fallback ? pastPaperSuggestion.note : null}
            />
            {(lesson.video ?? weekEntry?.video) && (
              <div className="list-item">
                <strong>Video Lesson</strong>
                <VideoPlayer video={(lesson.video ?? weekEntry?.video)!} />
              </div>
            )}
            {!lesson.video && !weekEntry?.video && weekEntry?.video_url && (
              <div className="list-item">
                <strong>Video Lesson</strong>
                <VideoPlayer video={{ videoUrl: weekEntry.video_url, provider: "other" }} />
              </div>
            )}
            <div className="list-item">
              <strong>{lesson.title}</strong>
              <div className="badge">{lesson.summary}</div>
            </div>
            <div className="list-item">
              <strong>Objectives</strong>
              <ul>
                {lesson.objectives.map((objective, idx) => (
                  <li key={`${objective}-${idx}`}>{objective}</li>
                ))}
              </ul>
            </div>
            <div className="list-item">
              <strong>Explanation</strong>
              <div className="list">
                {lesson.sections.explanation.map((section, idx) => (
                  <div key={`${section.heading}-${idx}`} className="list-item">
                    <strong>{section.heading}</strong>
                    <p className="subtitle">{section.content}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="list-item">
              <strong>Worked examples</strong>
              <div className="list">
                {lesson.sections.worked_examples.map((section, idx) => (
                  <div key={`${section.heading}-${idx}`} className="list-item">
                    <strong>{section.heading}</strong>
                    <p className="subtitle">{section.content}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="list-item">
              <strong>Guided practice</strong>
              <div className="list">
                {lesson.sections.guided_practice.map((section, idx) => (
                  <div key={`${section.heading}-${idx}`} className="list-item">
                    <strong>{section.heading}</strong>
                    <p className="subtitle">{section.content}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="list-item">
              <strong>Independent practice</strong>
              <div className="list">
                {lesson.sections.independent_practice.map((section, idx) => (
                  <div key={`${section.heading}-${idx}`} className="list-item">
                    <strong>{section.heading}</strong>
                    <p className="subtitle">{section.content}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="list-item">
              <strong>Quiz</strong>
              <div className="list">
                {lesson.quiz.questions.map((question, idx) => (
                  <div key={question.id} className="list-item">
                    <div className="quiz-question-heading">
                      <strong>
                        Q{idx + 1}: {question.prompt}
                      </strong>
                    </div>
                    {question.options?.length ? (
                      <ul>
                        {question.options.map((opt, optIdx) => (
                          <li key={`${question.id}-opt-${optIdx}`}>{opt}</li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="subtitle">Answer: {question.answer}</p>
                    <p className="subtitle">{question.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
            {lesson.teacher_notes?.length ? (
              <div className="list-item">
                <strong>Teacher notes</strong>
                <ul>
                  {lesson.teacher_notes.map((note, idx) => (
                    <li key={`${note}-${idx}`}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="list-item">
              <strong>References</strong>
              <ul>
                {lesson.citations.map((citation, idx) => (
                  <li key={`${citation.source_path}-${idx}`}>
                    {citation.source_path} (pages {citation.page_start}-{citation.page_end})
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href={`/community/circles?topic=${encodeURIComponent(`${subjectEntry.name} — ${weekEntry?.topic_title || `Term ${termNumber} Week ${weekNumber}`}`)}&from=lesson`}
              className="list-item"
              style={{ textDecoration: "none" }}
              prefetch={false}
            >
              <strong>💬 Discuss this lesson</strong>
              <div className="badge">Start or join a Study Circle on this topic</div>
            </Link>
          </>
        ) : (
          <div className="list-item">
            <strong>Lesson not generated yet.</strong>
            <p className="subtitle">An admin can generate this lesson from /admin/generate.</p>
          </div>
        )}
      </div>
    </LearnLayout>
  );
}
