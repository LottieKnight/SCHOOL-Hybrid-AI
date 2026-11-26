import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { LearnLayout } from "@/components/LearnLayout";
import { GroundedExplainPanel } from "@/components/intelligence/GroundedExplainPanel";
import { LanguageSearchPanel } from "@/components/intelligence/LanguageSearchPanel";
import { Badge } from "@/components/ui/Badge";
import { getBackendSessionFromCookieHeader } from "@/lib/server/backendSession";
import { getUserAppPreferences, readAcademicState } from "@/lib/server/userProfileState";
import { getInstitutionContextForUser } from "@/lib/server/institutions";
import { buildUniversityModuleLessonStoragePath } from "@/lib/lessonRouting";
import type { LessonV1 } from "@saedu/shared";

type Props = {
  params: Promise<{ moduleCode: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { moduleCode } = await params;
  return {
    title: `${moduleCode.toUpperCase()} | University | SCHOOL`,
    description: `Study surface for module ${moduleCode.toUpperCase()} on SCHOOL.`,
  };
}

export const dynamic = "force-dynamic";

async function fetchUniversityLesson(params: {
  institution: string;
  faculty: string;
  course: string;
  yearOfStudy: number;
  moduleCode: string;
  cookieHeader: string;
}): Promise<LessonV1 | null> {
  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.API_BASE_URL ||
    "http://localhost:4000";

  const query = new URLSearchParams({
    institution: params.institution,
    faculty: params.faculty,
    course: params.course,
    yearOfStudy: String(params.yearOfStudy),
    moduleCode: params.moduleCode,
  });

  try {
    const res = await fetch(`${apiBase}/university/lessons?${query}`, {
      headers: { cookie: params.cookieHeader },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.lesson ?? null;
  } catch {
    return null;
  }
}

export default async function UniversityModulePage({ params }: Props) {
  const { moduleCode } = await params;
  const code = moduleCode.toUpperCase();

  const headerStore = await headers();
  const cookieHeader = headerStore.get("cookie") || "";
  const session = await getBackendSessionFromCookieHeader(cookieHeader);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";

  if (!userId) {
    redirect(`/auth?next=/university/modules/${moduleCode}`);
  }

  const preferences = await getUserAppPreferences(userId).catch(() => ({}));
  const academicState = readAcademicState(preferences);

  if (academicState.studyType !== "university") {
    redirect("/university");
  }

  const institutionContext = await getInstitutionContextForUser(userId).catch(() => null);
  const institutionName =
    institutionContext?.shortName ||
    institutionContext?.name ||
    academicState.institution ||
    "Your university";

  const selectedModule = academicState.modulePlan.find(
    (m) => m.code.toUpperCase() === code
  );

  const storagePath = academicState.institution && academicState.faculty && academicState.course && academicState.yearOfStudy
    ? buildUniversityModuleLessonStoragePath(
        {
          institution: academicState.institution,
          faculty: academicState.faculty,
          course: academicState.course,
          yearOfStudy: academicState.yearOfStudy,
        },
        code
      )
    : null;

  const lesson =
    academicState.institution && academicState.faculty && academicState.course && academicState.yearOfStudy
      ? await fetchUniversityLesson({
          institution: academicState.institution,
          faculty: academicState.faculty,
          course: academicState.course,
          yearOfStudy: typeof academicState.yearOfStudy === "number" ? academicState.yearOfStudy : Number(academicState.yearOfStudy),
          moduleCode: code,
          cookieHeader,
        })
      : null;

  return (
    <LearnLayout
      title={selectedModule ? `${code} — ${selectedModule.name}` : code}
      subtitle={
        selectedModule
          ? `${institutionName} · Year ${selectedModule.yearOfStudy}${selectedModule.semester ? ` · Semester ${selectedModule.semester}` : ""}`
          : institutionName
      }
      backHref="/university/learning"
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "University", href: "/university/learning" },
        { label: code },
      ]}
    >
      <div className="list">
        {selectedModule && (
          <div className="list-item">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <strong style={{ fontFamily: "var(--font-mono)" }}>{code}</strong>
              <Badge variant={selectedModule.isCore === false ? "neutral" : "gold"}>
                {selectedModule.isCore === false ? "Elective" : "Core"}
              </Badge>
              {typeof selectedModule.credits === "number" && (
                <Badge variant="neutral">{selectedModule.credits} credits</Badge>
              )}
              <Badge variant="neutral">Year {selectedModule.yearOfStudy}</Badge>
            </div>
            <p style={{ margin: 0, color: "var(--color-fg-muted)" }}>{selectedModule.name}</p>
          </div>
        )}

        <div className="list-item" style={{ display: "grid", gap: "var(--space-3)" }}>
          <strong>Study tools</strong>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
            <Link className="button" href={`/community/rooms/${encodeURIComponent(code)}?onboarding_complete=1`}>
              Module community room
            </Link>
            <Link className="button" href={`/tutor?context=${encodeURIComponent(code)}`}>
              Ask AI about {code}
            </Link>
            <Link className="button" href="/planner">
              Planner
            </Link>
            <Link className="button" href={`/library?grade_band=university&search=${encodeURIComponent(code)}`}>
              Library resources
            </Link>
          </div>
        </div>

        <LanguageSearchPanel
          moduleCode={code}
          title={`Search ${code} concepts`}
          description={`Search terminology, formulas, and concepts for ${code}. Queries are normalised before retrieval.`}
        />

        <GroundedExplainPanel
          moduleCode={code}
          title={`AI explanation — ${code}`}
          description="Ask a question about this module and get a grounded explanation backed by your study material."
        />

        {lesson ? (
          <>
            <div className="list-item">
              <strong>{lesson.title}</strong>
              <div className="badge">{lesson.summary}</div>
            </div>
            <div className="list-item">
              <strong>Learning objectives</strong>
              <ul>{lesson.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul>
            </div>
            <div className="list-item">
              <strong>Theory</strong>
              <div className="list">
                {lesson.sections.explanation.map((s, i) => (
                  <div key={i} className="list-item">
                    <strong>{s.heading}</strong>
                    <p className="subtitle">{s.content}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="list-item">
              <strong>Worked examples</strong>
              <div className="list">
                {lesson.sections.worked_examples.map((s, i) => (
                  <div key={i} className="list-item">
                    <strong>{s.heading}</strong>
                    <p className="subtitle">{s.content}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="list-item">
              <strong>Guided practice</strong>
              <div className="list">
                {lesson.sections.guided_practice.map((s, i) => (
                  <div key={i} className="list-item">
                    <strong>{s.heading}</strong>
                    <p className="subtitle">{s.content}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="list-item">
              <strong>Independent practice</strong>
              <div className="list">
                {lesson.sections.independent_practice.map((s, i) => (
                  <div key={i} className="list-item">
                    <strong>{s.heading}</strong>
                    <p className="subtitle">{s.content}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="list-item">
              <strong>Quiz</strong>
              <div className="list">
                {lesson.quiz.questions.map((q, i) => (
                  <div key={q.id} className="list-item">
                    <strong>Q{i + 1}: {q.prompt}</strong>
                    {q.options?.length ? (
                      <ul>{q.options.map((opt, j) => <li key={j}>{opt}</li>)}</ul>
                    ) : null}
                    <p className="subtitle">Answer: {q.answer}</p>
                    <p className="subtitle">{q.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : storagePath ? (
          <div className="list-item">
            <strong>Lesson not generated yet</strong>
            <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--color-fg-muted)" }}>
              An admin can generate content for this module from{" "}
              <a href="/admin/university">Admin → University</a>.
            </p>
            <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--color-fg-muted)", fontFamily: "var(--font-mono)" }}>
              {storagePath}
            </p>
          </div>
        ) : null}
      </div>
    </LearnLayout>
  );
}
