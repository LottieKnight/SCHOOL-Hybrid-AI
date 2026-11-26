import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { getBackendSessionFromCookieHeader } from "@/lib/server/backendSession";
import { getUserAppPreferences, readAcademicState } from "@/lib/server/userProfileState";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "University | SCHOOL",
  description: "University-level learning, modules, and past papers on SCHOOL.",
};

export default async function UniversityPage() {
  const headerStore = await headers();
  const session = await getBackendSessionFromCookieHeader(headerStore.get("cookie") || "");
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";

  if (userId) {
    const preferences = await getUserAppPreferences(userId).catch(() => ({}));
    const academicState = readAcademicState(preferences);
    if (academicState.studyType === "university") {
      redirect("/university/learning");
    }
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <RouteHeader
        eyebrow="University"
        title="University learning on SCHOOL"
        description="Access modules, study resources, and exam prep — separated from grade-school content."
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "var(--space-3)",
        }}
      >
        <div className="list-item" style={{ display: "grid", gap: "var(--space-2)" }}>
          <strong>Already enrolled?</strong>
          <p style={{ margin: 0, color: "var(--color-fg-muted)", fontSize: "var(--text-sm)" }}>
            If your university profile is set up, sign in and you will be taken directly to your module view.
          </p>
          <Link className="button" href="/auth">
            Sign in
          </Link>
        </div>

        <div className="list-item" style={{ display: "grid", gap: "var(--space-2)" }}>
          <strong>Not enrolled yet?</strong>
          <p style={{ margin: 0, color: "var(--color-fg-muted)", fontSize: "var(--text-sm)" }}>
            Set up your university profile to unlock module tracking, past papers, and AI-assisted study for your specific degree.
          </p>
          <Link className="button" href="/onboarding/university">
            Set up university profile
          </Link>
        </div>

        <div className="list-item" style={{ display: "grid", gap: "var(--space-2)" }}>
          <strong>Browse the Library</strong>
          <p style={{ margin: 0, color: "var(--color-fg-muted)", fontSize: "var(--text-sm)" }}>
            Articles, journals, publications, and video lessons filtered to university grade band — no sign-in required.
          </p>
          <Link className="button" href="/library?grade_band=university">
            Open university library
          </Link>
        </div>
      </div>
    </div>
  );
}
