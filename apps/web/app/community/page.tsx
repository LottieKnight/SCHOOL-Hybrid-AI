import Link from "next/link";
import { headers } from "next/headers";
import { Badge } from "@/components/ui/Badge";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { CampusFeed } from "@/components/community/CampusFeed";
import { getBackendSessionFromCookieHeader } from "@/lib/server/backendSession";
import { listCommunityRooms, getTrendingPosts, getFeaturedQuestion } from "@/lib/server/community";
import { getInstitutionContextForUser } from "@/lib/server/institutions";
import { getUserAppPreferences, readAcademicState } from "@/lib/server/userProfileState";
import styles from "@/app/community/page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CommunityHubPage() {
  const headerStore = await headers();
  const session = await getBackendSessionFromCookieHeader(headerStore.get("cookie") || "");
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  const preferences = userId ? await getUserAppPreferences(userId).catch(() => ({})) : {};
  const academicState = readAcademicState(preferences);
  const institutionContext = userId ? await getInstitutionContextForUser(userId).catch(() => null) : null;

  const institutionId = institutionContext?.id ?? academicState.institutionId ?? null;

  const [rooms, trending, featured] = await Promise.all([
    listCommunityRooms({ institutionId, academicState }),
    getTrendingPosts(institutionId),
    getFeaturedQuestion(institutionId),
  ]);

  const featuredRooms = rooms.slice(0, 6);

  return (
    <div className={styles.page}>
      <RouteHeader
        eyebrow="Community"
        title="Ask the Campus"
        description="Module rooms keep academic discussion scoped to your institution, faculty, and current coursework. Campus life pages sit alongside them so students can post about freshers, varsity cup, societies, and the broader university experience without leaving the community flow."
      >
        <div className={styles.pillRow}>
          {institutionContext?.shortName || institutionContext?.name ? (
            <span className="institution-pill">{institutionContext?.shortName || institutionContext?.name}</span>
          ) : null}
          {academicState.faculty ? <Badge variant="neutral">{academicState.faculty}</Badge> : null}
          {academicState.selectedSubjects.length > 0 ? (
            <Badge variant="gold">{`${academicState.selectedSubjects.length} tracked modules`}</Badge>
          ) : (
            <Badge variant="neutral">Starter community rooms ready</Badge>
          )}
          <Link className={buttonClassName({ variant: "outline", size: "sm", className: "skeu-btn-ghost" })} href="/community/questions">
            Ask the Campus
          </Link>
          <Link className="button skeu-btn" href="/tutor">
            Launch AI Assistant
          </Link>
          <Link className={buttonClassName({ variant: "outline", size: "sm", className: "skeu-btn-ghost" })} href="/profile/learning">
            Your learning
          </Link>
        </div>
      </RouteHeader>

      <div className={styles.layout}>
        <section className={styles.mainColumn}>
          <CampusFeed />
          <Card>
            <CardHeader>
              <CardTitle as="h2">Module Rooms</CardTitle>
            </CardHeader>
            <CardBody>
              {featuredRooms.length === 0 ? (
                <div className={styles.emptyState}>
                  Community rooms are not available yet. Finish onboarding with your institution and modules to unlock
                  campus-specific discussion spaces.
                </div>
              ) : (
                <div className={styles.moduleGrid}>
                  {featuredRooms.map((room) => (
                    <Link
                      key={room.moduleCode}
                      href={`/community/rooms/${encodeURIComponent(room.moduleCode)}`}
                      className={`${styles.moduleCard} skeu-card`}
                    >
                      <div className={styles.moduleTop}>
                        <div className={styles.moduleMeta}>
                          <span className={styles.moduleCode}>{room.moduleCode}</span>
                          <strong className={styles.moduleName}>{room.moduleName}</strong>
                        </div>
                        <Badge variant={room.hasLiveData ? "green" : "neutral"} className="skeu-badge">
                          {room.hasLiveData ? "Live room" : "Starter room"}
                        </Badge>
                        {room.isCampusLife ? <Badge variant="gold" className="skeu-badge">Campus life</Badge> : null}
                      </div>
                      <p className={styles.moduleHint}>
                        {room.isCampusLife
                          ? room.hasLiveData
                            ? "Join live campus conversation, student event updates, reactions, comments, and reshares."
                            : "This page is ready for the first freshers update, varsity cup post, or student society event."
                          : room.hasLiveData
                            ? "Join active questions, reactions, and accepted-answer threads."
                            : "This room is ready for the first question, resource share, or exam tip."}
                      </p>
                      <div className={styles.moduleFooter}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          {room.activeNow ? (
                            <span style={{ width: "7px", height: "7px", borderRadius: "999px", background: "#10b981", display: "inline-block", flexShrink: 0 }} title="Active in the last 30 minutes" />
                          ) : null}
                          {typeof room.postCount === "number" ? `${room.postCount} posts` : "No posts yet"}
                        </span>
                        <span>Open room →</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </section>

        <aside className={styles.sideColumn}>
          {trending.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">🔥 Trending Now</CardTitle>
              </CardHeader>
              <CardBody>
                <div className={styles.infoList}>
                  {trending.map((post) => (
                    <div key={post.id} className={styles.infoItem}>
                      <span className={styles.moduleCode}>{post.moduleCode}</span>
                      <span style={{ display: "block", fontSize: "13px", color: "var(--text-2)", margin: "2px 0 4px" }}>
                        {post.contentPreview}{post.contentPreview.length >= 100 ? "…" : ""}
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-3)" }}>
                        {post.recentReactions} reactions in the last 2 hours
                      </span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          ) : null}

          {featured ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">⭐ Question of the Day</CardTitle>
              </CardHeader>
              <CardBody>
                <div className={styles.infoList}>
                  <div className={styles.infoItem} style={{ borderLeft: "3px solid var(--gold, #d4a017)", paddingLeft: "10px" }}>
                    <span className={styles.moduleCode}>{featured.moduleCode}</span>
                    <span style={{ display: "block", fontSize: "13px", color: "var(--text-2)", margin: "4px 0" }}>
                      {featured.content.slice(0, 140)}{featured.content.length > 140 ? "…" : ""}
                    </span>
                    <Badge variant="gold" className="skeu-badge">+5 bonus credits to answer</Badge>
                  </div>
                </div>
                <Link
                  href={`/community/rooms/${encodeURIComponent(featured.moduleCode)}`}
                  className={buttonClassName({ variant: "outline", size: "sm", className: "skeu-btn-ghost" })}
                  style={{ marginTop: 12, display: "inline-block" }}
                >
                  Answer this question →
                </Link>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle as="h2">🏆 Leaderboard</CardTitle>
            </CardHeader>
            <CardBody>
              <div className={styles.infoList}>
                <div className={styles.infoItem}>
                  See the top contributors this week by Scholar Credits earned from posts, replies, and accepted answers.
                </div>
              </div>
              <Link
                href="/community/leaderboard"
                className={buttonClassName({ variant: "outline", size: "sm", className: "skeu-btn-ghost" })}
                style={{ marginTop: 12, display: "inline-block" }}
              >
                Open Leaderboard →
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">🎮 Games Center</CardTitle>
            </CardHeader>
            <CardBody>
              <div className={styles.infoList}>
                <div className={styles.infoItem}>
                  Take a break between study sessions with student-built games. BRAZIL is live now — a text adventure
                  about student survival. Exam Dash and Question Pool are coming soon.
                </div>
              </div>
              <Link
                href="/community/games"
                className={buttonClassName({ variant: "outline", size: "sm", className: "skeu-btn-ghost" })}
                style={{ marginTop: 12, display: "inline-block" }}
              >
                Open Games Center →
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">How It Works</CardTitle>
            </CardHeader>
            <CardBody>
              <div className={styles.infoList}>
                <div className={styles.infoItem}>
                  Question posts stay visible to the whole module. No mastery gating is used anywhere in Ask the
                  Campus.
                </div>
                <div className={styles.infoItem}>
                  Accepted answers can earn Scholar Credits if the wallet tables are live in the database.
                </div>
                <div className={styles.infoItem}>
                  Institution accent colors are additive only. Scholar remains the global shell, while the room picks
                  up your campus identity.
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">Founder Notes</CardTitle>
            </CardHeader>
            <CardBody>
              <div className={styles.infoList}>
                <div className={styles.infoItem}>
                  Starter rooms currently focus on the founder-facing NWU modules and the student modules captured in
                  onboarding preferences.
                </div>
                <div className={styles.infoItem}>
                  If the community tables are not migrated yet, this page still renders from safe fallback data.
                </div>
              </div>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
