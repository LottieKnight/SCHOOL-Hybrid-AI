import { NextRequest, NextResponse } from "next/server";
import { deriveInstitutionThemeId, resolveInstitutionTheme } from "@/lib/institutionTheme";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { getInstitutionContextForUser } from "@/lib/server/institutions";
import { getUserAppPreferences, readAcademicState } from "@/lib/server/userProfileState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const institution = await getInstitutionContextForUser(userId).catch(() => null);
  const preferences = await getUserAppPreferences(userId).catch(() => ({}));
  const academicState = readAcademicState(preferences);

  if (!institution && !academicState.institution) {
    return NextResponse.json({
      institution: null,
      theme: {
        slug: "default",
      },
    });
  }

  const fallbackTheme = resolveInstitutionTheme({
    name: academicState.institution,
    shortName: academicState.institution,
  });

  const resolvedInstitution = institution
    ? {
        id: institution.id,
        name: institution.name,
        shortName: institution.shortName,
        faculty: institution.faculty,
        academicPeriodType: institution.academicPeriodType,
        primaryColor: institution.primaryColor,
        secondaryColor: institution.secondaryColor,
      }
    : {
        id: academicState.institutionId ?? academicState.institution ?? "onboarding-institution",
        name: academicState.institution,
        shortName: null,
        faculty: academicState.faculty,
        academicPeriodType: academicState.calendarFormat,
        primaryColor: fallbackTheme.primary,
        secondaryColor: fallbackTheme.secondary,
      };

  return NextResponse.json({
    institution: resolvedInstitution,
    theme: {
      slug: deriveInstitutionThemeId({
        shortName: institution?.shortName ?? academicState.institution,
        name: institution?.name ?? academicState.institution,
        domain: institution?.domain,
        primaryColor: institution?.primaryColor ?? fallbackTheme.primary,
        secondaryColor: institution?.secondaryColor ?? fallbackTheme.secondary,
      }),
      primaryColor: institution?.primaryColor ?? fallbackTheme.primary,
      secondaryColor: institution?.secondaryColor ?? fallbackTheme.secondary,
    },
  });
}
