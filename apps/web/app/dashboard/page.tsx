import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import DashboardHomeClient from "@/components/DashboardHomeClient";
import { loginRedirectForMissingBackendCookie } from "@/lib/sessionGate";
import { getBackendSessionFromCookieHeader } from "@/lib/server/backendSession";
import { getInstitutionContextForUser } from "@/lib/server/institutions";
import { getUserAppPreferences, readAcademicState } from "@/lib/server/userProfileState";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const headerStore = await headers();
  const session = await getBackendSessionFromCookieHeader(headerStore.get("cookie") || "");
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  const legacyBounce = loginRedirectForMissingBackendCookie({
    pathname: "/dashboard",
    hasBackendSessionCookie: Boolean(userId),
    firebaseUserSignedIn: false,
    enforceLegacyCookie: true,
  });
  if (legacyBounce) redirect(legacyBounce);
  const institutionContext = userId ? await getInstitutionContextForUser(userId).catch(() => null) : null;
  const preferences = userId ? await getUserAppPreferences(userId).catch(() => ({})) : {};
  const academicState = readAcademicState(preferences);

  return (
    <DashboardHomeClient
      academicState={academicState}
      institutionContext={
        institutionContext
          ? {
              id: institutionContext.id,
              name: institutionContext.name,
              shortName: institutionContext.shortName,
              academicPeriodType: institutionContext.academicPeriodType,
              faculty: institutionContext.faculty,
              primaryColor: institutionContext.primaryColor,
              secondaryColor: institutionContext.secondaryColor,
            }
          : academicState.institution
            ? {
                id: academicState.institutionId ?? academicState.institution,
                name: academicState.institution,
                shortName: null,
                academicPeriodType: academicState.calendarFormat,
                faculty: academicState.faculty,
                primaryColor: null,
                secondaryColor: null,
              }
            : null
      }
    />
  );
}
