import { headers } from "next/headers";
import CommunityRoomClient from "@/components/community/CommunityRoomClient";
import { getBackendSessionFromCookieHeader } from "@/lib/server/backendSession";
import { getInstitutionContextForUser } from "@/lib/server/institutions";
import { getCommunityRoomView } from "@/lib/server/community";
import { getUserAppPreferences, readAcademicState } from "@/lib/server/userProfileState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    moduleCode: string;
  }>;
};

export default async function CommunityRoomPage({ params }: PageProps) {
  const { moduleCode } = await params;
  const headerStore = await headers();
  const session = await getBackendSessionFromCookieHeader(headerStore.get("cookie") || "");
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  const preferences = userId ? await getUserAppPreferences(userId).catch(() => ({})) : {};
  const academicState = readAcademicState(preferences);
  const institutionContext = userId ? await getInstitutionContextForUser(userId).catch(() => null) : null;

  const room = await getCommunityRoomView({
    moduleCode,
    userId,
    institutionId: institutionContext?.id ?? academicState.institutionId ?? null,
    institutionName: institutionContext?.name ?? academicState.institution ?? null,
    institutionShortName: institutionContext?.shortName ?? null,
    faculty: institutionContext?.faculty ?? academicState.faculty ?? null,
    academicState,
  });

  return <CommunityRoomClient room={room} currentUserId={userId || null} />;
}
