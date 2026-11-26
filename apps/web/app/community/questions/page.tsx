import Link from "next/link";
import { headers } from "next/headers";
import CommunityQuestionsClient from "@/components/community/CommunityQuestionsClient";
import { Badge } from "@/components/ui/Badge";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { getBackendSessionFromCookieHeader } from "@/lib/server/backendSession";
import { listCommunityQuestions, listCommunityRooms } from "@/lib/server/community";
import { getInstitutionContextForUser } from "@/lib/server/institutions";
import { getUserAppPreferences, readAcademicState } from "@/lib/server/userProfileState";
import styles from "@/app/community/questions/page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CommunityQuestionsPage() {
  const headerStore = await headers();
  const session = await getBackendSessionFromCookieHeader(headerStore.get("cookie") || "");
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  const preferences = userId ? await getUserAppPreferences(userId).catch(() => ({})) : {};
  const academicState = readAcademicState(preferences);
  const institutionContext = userId ? await getInstitutionContextForUser(userId).catch(() => null) : null;

  const [posts, rooms] = await Promise.all([
    listCommunityQuestions({
      userId,
      institutionId: institutionContext?.id ?? academicState.institutionId ?? null,
      academicState,
      filter: "all",
      limit: 60,
    }),
    listCommunityRooms({
      institutionId: institutionContext?.id ?? academicState.institutionId ?? null,
      academicState,
    }),
  ]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <span className="eyebrow">Ask the Campus</span>
          <div className={styles.headerTitle}>
            <h1>Question Feed</h1>
            {institutionContext?.shortName || institutionContext?.name ? (
              <span className="institution-pill">{institutionContext?.shortName || institutionContext?.name}</span>
            ) : null}
          </div>
          <p className={styles.subtitle}>
            Track active questions across your institution, focus on unanswered threads, and jump into the right module
            room when the conversation needs depth.
          </p>
          <div className={styles.pillRow}>
            {academicState.faculty ? <Badge variant="neutral" className="skeu-badge">{academicState.faculty}</Badge> : null}
            {academicState.selectedSubjects.length > 0 ? (
              <Badge variant="gold" className="skeu-badge">{`${academicState.selectedSubjects.length} tracked modules`}</Badge>
            ) : (
              <Badge variant="neutral">Campus-wide questions</Badge>
            )}
          </div>
        </div>

        <div className={styles.actionRow}>
          <Link className={buttonClassName({ variant: "outline", size: "sm", className: "skeu-btn-ghost" })} href="/community">
            Community hub
          </Link>
          <Link className="button skeu-btn" href={rooms[0] ? `/community/rooms/${encodeURIComponent(rooms[0].moduleCode)}` : "/community"}>
            Ask in a module room
          </Link>
        </div>
      </header>

      <CommunityQuestionsClient
        posts={posts}
        currentUserId={userId || null}
        selectedModules={academicState.selectedSubjects}
        featuredRooms={rooms.slice(0, 6)}
      />
    </div>
  );
}
