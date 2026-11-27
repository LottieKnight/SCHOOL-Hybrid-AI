import Link from "next/link";
import { LearnLayout } from "@/components/LearnLayout";
import { LessonStudio } from "@/components/learn/LessonStudio";
import { LessonLanguageSelector } from "@/components/LessonLanguageSelector";
import { VideoPlayer } from "@/components/VideoPlayer";
import { findLearnSubject, formatTermLabel, getTermInfo, parseGradeParam } from "@/lib/learnV2";
import { resolveStructuredLesson } from "@/lib/lessons/resolveLesson";
import { cookies } from "next/headers";
import { isLocale as isLessonLocale, type Locale } from "@/lib/locale";
import type { VideoLessonMeta } from "@saedu/shared";

export const runtime = "nodejs";
export const revalidate = 900;

function textField(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function textList(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return items.length ? items : undefined;
}

function videoField(value: unknown): VideoLessonMeta | undefined {
  if (!value || typeof value !== "object") return undefined;
  const videoUrl = textField((value as { videoUrl?: unknown }).videoUrl);
  if (!videoUrl) return undefined;
  const provider = (value as { provider?: unknown }).provider;
  const allowed = ["heygen", "elevenlabs", "youtube", "vimeo", "other"] as const;
  return {
    ...(value as VideoLessonMeta),
    videoUrl,
    provider: allowed.includes(provider as (typeof allowed)[number]) ? (provider as (typeof allowed)[number]) : "other",
  };
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
  const cookieStore = await cookies();
  const lessonLangCookie = cookieStore.get("LESSON_LANGUAGE")?.value;
  const lessonLanguage = lessonLangCookie && isLessonLocale(lessonLangCookie) ? lessonLangCookie : "en";

  if (!subjectEntry || !Number.isFinite(termNumber) || !Number.isFinite(weekNumber) || gradeNumber === null) {
    return (
      <LearnLayout
        title="Week"
        backHref={`/learn/${phase}/${grade}/${subject}/term/${term}`}
        breadcrumbs={[
          { label: "Learn", href: "/learn" },
          { label: phase, href: `/learn/${phase}` },
          { label: `Grade ${grade}`, href: `/learn/${phase}/${grade}` },
          { label: subject, href: `/learn/${phase}/${grade}/${subject}` },
          { label: `Term ${term}`, href: `/learn/${phase}/${grade}/${subject}/term/${term}` },
          { label: `Week ${week}` },
        ]}
        subtitle="Week not found."
      >
        <p className="badge">Check the week value, or go back and choose another topic.</p>
        <Link className="button" href="/learn">
          Back to Learn
        </Link>
      </LearnLayout>
    );
  }

  const { term: termEntry } = getTermInfo(subjectEntry.terms || {}, termNumber);
  const weeks = termEntry?.weeks?.length
    ? termEntry.weeks
    : Array.from({ length: 10 }, (_, index) => ({ name: `Week ${index + 1}`, topic_title: `Week ${index + 1} overview` }));
  const weekEntry = weeks[weekNumber - 1] as { topic_title?: string } | undefined;
  const weekRecord = (weeks[weekNumber - 1] ?? {}) as Record<string, unknown>;
  const topic = textField(weekEntry?.topic_title) || `Week ${weekNumber}`;
  const resolved = resolveStructuredLesson({
    phase,
    grade: gradeNumber,
    subject: subjectEntry.name,
    subjectKey: subjectEntry.key,
    term: termNumber,
    week: weekNumber,
    topic,
    summary: textField(weekRecord.summary_md),
    outcomes: textList(weekRecord.outcomes),
    language: lessonLanguage,
  });
  const lesson = resolved.lesson;
  const href = `/learn/${phase}/${grade}/${subject}/term/${termNumber}/week/${weekNumber}`;
  const prev =
    weekNumber > 1
      ? {
          href: `/learn/${phase}/${grade}/${subject}/term/${termNumber}/week/${weekNumber - 1}`,
          title: textField(weeks[weekNumber - 2]?.topic_title) || `Week ${weekNumber - 1}`,
        }
      : null;
  const next =
    weekNumber < weeks.length
      ? {
          href: `/learn/${phase}/${grade}/${subject}/term/${termNumber}/week/${weekNumber + 1}`,
          title: textField(weeks[weekNumber]?.topic_title) || `Week ${weekNumber + 1}`,
        }
      : null;
  const video = videoField(lesson.video) ?? videoField(weekRecord.video);
  const videoUrl = textField(weekRecord.video_url);

  return (
    <LearnLayout
      title={subjectEntry.name}
      backHref={`/learn/${phase}/${grade}/${subject}/term/${termNumber}`}
      breadcrumbs={[
        { label: "Learn", href: "/learn" },
        { label: phase, href: `/learn/${phase}` },
        { label: `Grade ${gradeNumber || "R"}`, href: `/learn/${phase}/${grade}` },
        { label: subjectEntry.name, href: `/learn/${phase}/${grade}/${subject}` },
        { label: formatTermLabel(termNumber, termEntry?.name), href: `/learn/${phase}/${grade}/${subject}/term/${termNumber}` },
        { label: `Week ${weekNumber}` },
      ]}
      subtitle={`Week ${weekNumber} · ${topic}`}
    >
      <div style={{ marginBottom: 16 }}>
        <LessonLanguageSelector current={lessonLanguage as Locale} />
      </div>
      {video ? <VideoPlayer video={video} /> : null}
      {!video && videoUrl ? <VideoPlayer video={{ videoUrl, provider: "other" }} /> : null}
      <LessonStudio key={lesson.id} lesson={lesson} href={href} prev={prev} next={next} />
    </LearnLayout>
  );
}
