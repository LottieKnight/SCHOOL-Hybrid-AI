import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LanguageSearchPanel } from "@/components/intelligence/LanguageSearchPanel";
import { Badge } from "@/components/ui/Badge";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { getBackendSessionFromCookieHeader } from "@/lib/server/backendSession";
import { getInstitutionContextForUser } from "@/lib/server/institutions";
import { getUserAppPreferences, readAcademicState } from "@/lib/server/userProfileState";

export const dynamic = "force-dynamic";

function formatModuleDuration(module: {
  durationLabel: string | null;
  durationType: "semester" | "year" | null;
  semester: number | null;
}) {
  if (module.durationLabel) return module.durationLabel;
  if (module.durationType === "year") return "Year module";
  if (module.semester === 1 || module.semester === 2) return `Semester ${module.semester}`;
  return "Flexible duration";
}

export default async function UniversityLearningPage() {
  const headerStore = await headers();
  const session = await getBackendSessionFromCookieHeader(headerStore.get("cookie") || "");
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";

  if (!userId) {
    redirect("/auth?next=/university/learning");
  }

  const preferences = await getUserAppPreferences(userId).catch(() => ({}));
  const academicState = readAcademicState(preferences);
  const institutionContext = await getInstitutionContextForUser(userId).catch(() => null);

  if (academicState.studyType !== "university") {
    redirect("/profile/learning");
  }

  const modules = academicState.modulePlan;
  const institutionName = institutionContext?.shortName || institutionContext?.name || academicState.institution || "Your university";
  const faculty = institutionContext?.faculty || academicState.faculty;

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <header className="glass card" style={{ display: "grid", gap: "16px", padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-4)", flexWrap: "wrap" }}>
          <SchoolLogo size={84} />
          <div style={{ display: "grid", gap: "10px" }}>
          <span className="eyebrow">University Learning Path</span>
          <h1 style={{ margin: 0 }}>All your enrolled modules, in one place.</h1>
          <p className="assistant-helper" style={{ margin: 0 }}>
            SCHOOL should not dump university students into one room. This view tracks your full module load and gives you a clean path into community, lectures, and study support for each module.
          </p>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
          <span className="institution-pill">{institutionName}</span>
          {faculty ? <Badge variant="neutral" className="skeu-badge">{faculty}</Badge> : null}
          {academicState.course ? <Badge variant="gold" className="skeu-badge">{academicState.course}</Badge> : null}
          {academicState.yearOfStudy ? <Badge variant="neutral" className="skeu-badge">Year {academicState.yearOfStudy}</Badge> : null}
          <Badge variant="gold" className="skeu-badge">{modules.length} enrolled modules</Badge>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
          <Link className="button skeu-btn" href="/dashboard">Dashboard</Link>
          <Link className={buttonClassName({ variant: "outline", size: "sm", className: "skeu-btn-ghost" })} href="/community">Community hub</Link>
          <Link className={buttonClassName({ variant: "outline", size: "sm", className: "skeu-btn-ghost" })} href="/planner">Planner</Link>
        </div>
      </header>

      <LanguageSearchPanel
        moduleCode={modules.find((module) => module.code.toUpperCase() === "ECON211")?.code ?? modules[0]?.code}
        title="Language-aware module and admin search"
        description="Search real module concepts, NSFAS/admin issues, or mixed wording. SCHOOL normalizes the query before retrieval and now checks generated module content first."
      />

      {modules.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">S</div>
          <div className="empty-state-title">No enrolled modules found yet</div>
          <div className="empty-state-desc">Finish university onboarding again or update your university profile so SCHOOL can build your module learning path.</div>
        </div>
      ) : (
        <section style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {modules.map((module) => (
            <article key={`${module.code}-${module.yearOfStudy}-${module.semester ?? "x"}`} className="glass card skeu-card" style={{ display: "grid", gap: "14px", padding: "20px" }}>
              <div style={{ display: "grid", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                  <strong style={{ fontFamily: "var(--font-mono)", color: "var(--inst-primary)" }}>{module.code}</strong>
                  <Badge variant={module.isCore === false ? "neutral" : "gold"} className="skeu-badge">{module.isCore === false ? "Elective" : "Core / tracked"}</Badge>
                </div>
                <h3 style={{ margin: 0 }}>{module.name}</h3>
                <p className="text-dim" style={{ margin: 0 }}>
                  {formatModuleDuration(module)} · Year {module.yearOfStudy}
                  {typeof module.credits === "number" ? ` · ${module.credits} credits` : ""}
                </p>
              </div>

              <div style={{ display: "grid", gap: "8px" }}>
                {module.code.toUpperCase() === "WVES312" ? (
                  <Link className="button skeu-btn" href="/university/modules/wves312">
                    Open WVES312 mock lesson
                  </Link>
                ) : module.code.toUpperCase() === "EKRP211" ? (
                  <>
                    <Link className="button skeu-btn" href="/learn/ekrp211">
                      Open EKRP211 study surface
                    </Link>
                    <Link className="button skeu-btn-ghost" href="/learn/ekrp211#mcq">
                      Open EKRP211 MCQ practice
                    </Link>
                  </>
                ) : module.code.toUpperCase() === "ECON211" ? (
                  <>
                    <Link className="button skeu-btn" href="/university/modules/econ211/notes">
                      Open ECON211 notes
                    </Link>
                    <Link className="button skeu-btn-ghost" href="/university/modules/econ211/past-papers">
                      Open ECON211 past papers
                    </Link>
                  </>
                ) : module.code.toUpperCase() === "EKIP212" ? (
                  <>
                    <Link className="button skeu-btn" href="/university/modules/ekip212">
                      Open EKIP212 trade guide
                    </Link>
                    <Link className="button skeu-btn-ghost" href="/tutor?q=Explain%20EKIP212%20trade%20relations">
                      Ask AI about EKIP212
                    </Link>
                  </>
                ) : (
                  <Link className="button skeu-btn" href={`/university/modules/${encodeURIComponent(module.code.toLowerCase())}`}>
                    Open {module.code} study surface
                  </Link>
                )}
                <Link className={buttonClassName({ variant: "outline", size: "sm", className: "skeu-btn-ghost" })} href="/tutor">
                  Ask AI about {module.code}
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
