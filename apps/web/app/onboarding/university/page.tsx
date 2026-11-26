import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { UniversityOnboarding } from "@/components/onboarding/UniversityOnboarding";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { getBackendSessionFromCookieHeader } from "@/lib/server/backendSession";
import {
  getStudentUniversityProfile,
  listPlannerCampuses,
  listPlannerUniversities,
} from "@/lib/server/universityPlanner";

export const dynamic = "force-dynamic";

export default async function UniversityOnboardingPage() {
  const headerStore = await headers();
  const session = await getBackendSessionFromCookieHeader(headerStore.get("cookie") || "");
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";

  if (userId) {
    const profile = await getStudentUniversityProfile(userId).catch(() => null);
    if (profile?.onboardingCompleted) {
      redirect("/planner");
    }
  }

  const universities = await listPlannerUniversities().catch(() => []);
  const campusEntries = await Promise.all(
    universities.map(async (university) => [university.id, await listPlannerCampuses(university.id).catch(() => [])] as const)
  );

  return (
    <main style={{ display: "grid", gap: "var(--space-4)", padding: "24px 16px 56px" }}>
      <section className="ui-card" style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", flexWrap: "wrap", padding: "var(--space-4)" }}>
        <SchoolLogo size={80} />
        <div style={{ display: "grid", gap: "0.45rem", maxWidth: "720px" }}>
          <span className="eyebrow">University Setup</span>
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 4vw, 3.4rem)" }}>Pick the campus that should define your planner.</h1>
          <p style={{ margin: 0, color: "var(--text-2)" }}>
            This is where the institutional skin, dates, and assistant context start becoming specific instead of generic.
          </p>
        </div>
      </section>
      <UniversityOnboarding universities={universities} campusesByUniversity={Object.fromEntries(campusEntries)} />
    </main>
  );
}
