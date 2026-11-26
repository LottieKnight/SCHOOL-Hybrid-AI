import { loadCapsScaffold } from "@saedu/shared";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { buildPlannerCatalog } from "@/lib/plannerCatalog";
import { getBackendSessionFromCookieHeader } from "@/lib/server/backendSession";
import { getPublicInstitutionList } from "@/lib/server/institutions";
import { getUserAppPreferences } from "@/lib/server/userProfileState";
import { safeReturnUrl } from "@/lib/safeReturnUrl";

export const dynamic = "force-dynamic";

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("onboarding");
  const cookieStore = await cookies();
  const params = searchParams ? await searchParams : {};
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
  const session = await getBackendSessionFromCookieHeader(cookieHeader);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  const rawReturnUrl = typeof params?.returnUrl === "string" ? params.returnUrl : null;
  const returnUrl = safeReturnUrl(rawReturnUrl);
  // Only hand the wizard an *explicit* return target; when absent, leave it null
  // so the wizard falls back to its study-type destination (e.g. /learn) rather
  // than forcing everyone to the dashboard default.
  const wizardReturnUrl = rawReturnUrl ? returnUrl : null;
  const completionCookie = cookieStore.get("school_onboarding_complete")?.value;
  const completionQuery = params?.onboarding_complete;
  const preferences = userId ? await getUserAppPreferences(userId).catch(() => ({})) : {};
  const onboarding = asRecord(asRecord(preferences).onboarding);
  const profileSettings = asRecord(asRecord(preferences).profileSettings);
  const hasCompletionSignal =
    onboarding.complete === true ||
    profileSettings.preferenceOnboardingStatus === "completed" ||
    completionCookie === "1" ||
    (Boolean(userId) && completionCookie === userId) ||
    completionQuery === "1";

  if (hasCompletionSignal) {
    redirect(returnUrl);
  }

  const catalog = (() => {
    try {
      const scaffold = loadCapsScaffold();
      return buildPlannerCatalog(scaffold);
    } catch {
      return { grades: [] };
    }
  })();
  const institutions = await getPublicInstitutionList().catch(() => []);

  return (
    <main style={{ display: "grid", gap: "var(--space-4)", padding: "24px 16px 56px" }}>
      <section className="ui-card" style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", flexWrap: "wrap", padding: "var(--space-4)" }}>
        <SchoolLogo size={84} />
        <div style={{ display: "grid", gap: "0.45rem", maxWidth: "720px" }}>
          <span className="eyebrow">{t("eyebrow")}</span>
          <h1 style={{ margin: 0, fontSize: "clamp(2.2rem, 4vw, 3.6rem)" }}>{t("heading")}</h1>
          <p style={{ margin: 0, color: "var(--text-2)" }}>
            {t("description")}
          </p>
          <p style={{ margin: 0 }}>
            <a href="/auth" style={{ color: "var(--gold)", fontSize: "0.88rem" }}>
              {t("signInLink")}
            </a>
          </p>
        </div>
      </section>
      <OnboardingWizard catalog={catalog} institutions={institutions} returnUrl={wizardReturnUrl} />
    </main>
  );
}
