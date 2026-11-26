import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { readFamilyWeek } from "@/lib/tutor/persist";

export const metadata: Metadata = {
  title: "Family progress",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function FamilyProgressPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const week = await readFamilyWeek(token);
  if (!week) notFound();
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <RouteHeader
        eyebrow="Read only"
        title="This week's study"
        description="A guardian view of quizzes, the revision plan, weak topics and tutor notes. Nothing here can be edited, and there is no wallet."
      />
      <SectionCard title="Quizzes" description="Marked sittings and answer checks from the last seven days.">
        {week.quizzes.length === 0 ? <p>No marked work this week yet.</p> : null}
        <ul>
          {week.quizzes.map((quiz) => (
            <li key={quiz.id}>
              {quiz.subject}: {quiz.title}
              {quiz.score !== null ? ` · ${quiz.score}/${quiz.outOf ?? "?"}` : ""}
            </li>
          ))}
        </ul>
      </SectionCard>
      <SectionCard title="Planner" description="Papers that have a saved revision plan.">
        {week.plans.length === 0 ? <p>No plan was saved this week.</p> : null}
        <ul>
          {week.plans.map((plan) => (
            <li key={plan.id}>{plan.subject}: {plan.title}</li>
          ))}
        </ul>
      </SectionCard>
      <SectionCard title="Weak topics" description="Lowest average scores on SCHOOL papers.">
        {week.weakTopics.length === 0 ? <p>No scored answers yet.</p> : null}
        <ul>
          {week.weakTopics.map((topic) => (
            <li key={topic.subject}>
              {topic.subject}: {topic.avgScore === null ? "no score" : `${topic.avgScore}%`} across {topic.attempts} answers
            </li>
          ))}
        </ul>
      </SectionCard>
      <SectionCard title="Tutor sessions" description="Revision notes written from error patterns.">
        {week.tutorSessions.length === 0 ? <p>No tutor notes yet.</p> : null}
        <ul>
          {week.tutorSessions.map((session) => (
            <li key={session.id}>
              <strong>{session.title}</strong>
              <p>{session.body}</p>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
