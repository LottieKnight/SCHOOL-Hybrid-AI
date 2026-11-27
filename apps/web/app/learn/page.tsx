import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { Badge } from "@/components/ui/Badge";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { SectionCard } from "@/components/ui/SectionCard";
import styles from "./PhaseCards.module.css";
import universityStyles from "./UniversityLearn.module.css";
import { LearningStyleOnboarding } from "@/components/LearningStyleOnboarding";
import { ProfilePathHint } from "@/components/profile/ProfilePathHint";
import { LearnHomeGuidance } from "@/components/learn/LearnHomeGuidance";
import { getLearnPhases } from "@/lib/learnV2";
import { getBackendSessionFromCookieHeader } from "@/lib/server/backendSession";
import { getInstitutionContextForUser } from "@/lib/server/institutions";
import { getUserAppPreferences, readAcademicState } from "@/lib/server/userProfileState";

export const metadata: Metadata = {
  title: "Learn",
  description: "Explore SCHOOL learning content for your actual study path.",
  openGraph: {
    title: "Learn | SCHOOL",
    description: "Explore SCHOOL learning content for your actual study path.",
    url: "/learn",
    images: ["/images/icons/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Learn | SCHOOL",
    description: "Explore SCHOOL learning content for your actual study path.",
    images: ["/images/icons/og-image.png"],
  },
};

type LearnModule = {
  code: string;
  name: string;
  yearOfStudy: number;
  semester: number | null;
  durationLabel: string | null;
  durationType: "semester" | "year" | null;
  credits?: number | null;
  isCore?: boolean | null;
};

type PhaseVisual = {
  mark: string;
  title: string;
  description: string;
};

function formatModuleDuration(module: Pick<LearnModule, "durationLabel" | "durationType" | "semester">) {
  if (module.durationLabel) return module.durationLabel;
  if (module.durationType === "year") return "Year module";
  if (module.semester === 1 || module.semester === 2) return `Semester ${module.semester}`;
  return "Flexible duration";
}

function buildModuleMeta(module: LearnModule) {
  const parts = [formatModuleDuration(module), `Year ${module.yearOfStudy}`];
  if (typeof module.credits === "number") parts.push(`${module.credits} credits`);
  return parts.join(" · ");
}

function getPrimaryLink(code: string) {
  switch (code.toUpperCase()) {
    case "EKIP212":
      return { href: "/university/modules/ekip212", label: "Open trade guide" };
    case "ECON211":
      return { href: "/university/modules/econ211", label: "Open study surface" };
    case "WVES312":
      return { href: "/learn/wves312", label: "Open ethics study" };
    default:
      return { href: `/community/rooms/${encodeURIComponent(code)}?onboarding_complete=1`, label: "Open module room" };
  }
}

function outlineGhostButtonClassName(className = "") {
  return ["ui-button", "ui-button--outline", "ui-button--sm", "skeu-btn-ghost", className]
    .filter(Boolean)
    .join(" ");
}

function renderCuratedShell({
  title,
  subtitle,
  heroTitle,
  heroCopy,
  heroActions,
  heroPanel,
  content,
}: {
  title: string;
  subtitle: string;
  heroTitle: string;
  heroCopy: string;
  heroActions: ReactNode;
  heroPanel: ReactNode;
  content: ReactNode;
}) {
  return (
    <div className={universityStyles.shell}>
      <section className={universityStyles.hero}>
        <div className={universityStyles.heroBackdrop} aria-hidden="true" />

        <div className={universityStyles.heroContent}>
          <div className={universityStyles.heroLead}>
            <div className={universityStyles.heroIdentity}>
              <SchoolLogo size={76} />
              <div style={{ display: "grid", gap: 6 }}>
                <Badge variant="gold">{title}</Badge>
                <div className={universityStyles.heroKicker}>
                  <span className="assistant-context-chip">{subtitle}</span>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10, maxWidth: 920 }}>
              <h1 className={universityStyles.heroTitle}>{heroTitle}</h1>
              <p className={universityStyles.heroCopy}>{heroCopy}</p>
            </div>

            <div className={universityStyles.heroActions}>{heroActions}</div>
          </div>

          <aside className={universityStyles.heroPanel}>{heroPanel}</aside>
        </div>
      </section>

      {content}
    </div>
  );
}

export default async function LearnIndexPage() {
  const headerStore = await headers();
  const session = await getBackendSessionFromCookieHeader(headerStore.get("cookie") || "");
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  const preferences = userId ? await getUserAppPreferences(userId).catch(() => ({})) : {};
  const academicState = readAcademicState(preferences);
  const institutionContext = userId ? await getInstitutionContextForUser(userId).catch(() => null) : null;

  if (academicState.studyType === "university") {
    const modules = (academicState.modulePlan as LearnModule[]) ?? [];
    const institutionName = institutionContext?.shortName || institutionContext?.name || academicState.institution || "Your university";
    const faculty = institutionContext?.faculty || academicState.faculty;
    const featuredCodes = new Set(["EKIP212", "ECON211", "WVES312"]);
    const featuredModules = modules.filter((module) => featuredCodes.has(module.code.toUpperCase()));
    const orderedModules = [...featuredModules, ...modules.filter((module) => !featuredCodes.has(module.code.toUpperCase()))];
    const primaryModule = orderedModules[0];
    const nextModuleLabel = primaryModule ? `${primaryModule.code} · ${primaryModule.name}` : "No module selected";

    const heroActions = (
      <>
        <Link className="button skeu-btn" href={primaryModule ? getPrimaryLink(primaryModule.code).href : "/dashboard"}>
          {primaryModule ? `Open ${primaryModule.code}` : "Open dashboard"}
        </Link>
        <Link className={outlineGhostButtonClassName()} href="/university/modules/econ211">
          Explore ECON211
        </Link>
        <Link className={outlineGhostButtonClassName()} href="/university/modules/ekip212">
          Explore EKIP212
        </Link>
      </>
    );

    const heroPanel = (
      <>
        <div style={{ display: "grid", gap: 8 }}>
          <span className="assistant-context-chip">Study surface at a glance</span>
          <h2 className={universityStyles.heroPanelTitle}>{nextModuleLabel}</h2>
          <p className={universityStyles.heroPanelCopy}>
            Use the modules below for theory, worked examples, and revision checkpoints. The most important course is brought forward first.
          </p>
        </div>

        <div className={universityStyles.stats}>
          <div className={universityStyles.statRow}>
            <span className="text-dim">Enrolled modules</span>
            <strong>{modules.length}</strong>
          </div>
          <div className={universityStyles.statRow}>
            <span className="text-dim">Featured modules</span>
            <strong>{featuredModules.length}</strong>
          </div>
          <div className={universityStyles.statRow}>
            <span className="text-dim">Next study surface</span>
            <strong>{primaryModule ? primaryModule.code : "—"}</strong>
          </div>
        </div>
      </>
    );

    const content = (
      <>
        {modules.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">S</div>
            <div className="empty-state-title">No enrolled modules found yet</div>
            <div className="empty-state-desc">Complete university onboarding or update your university profile so SCHOOL can build your learning path.</div>
          </div>
        ) : (
          <>
            <div className={universityStyles.featureGrid}>
              <SectionCard title="Focus" description="The page opens with the courses that need the most attention first.">
                <div className={universityStyles.featurePillList}>
                  {featuredModules.length > 0 ? (
                    featuredModules.map((module) => (
                      <div key={`focus-${module.code}`} className={universityStyles.featurePill}>
                        <span>{module.code}</span>
                        <strong>{formatModuleDuration(module)}</strong>
                      </div>
                    ))
                  ) : (
                    <div className={universityStyles.featurePill}>
                      <span>No featured modules</span>
                      <strong>Using enrolled list</strong>
                    </div>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Study approach" description="Keep the semester order visible and jump straight into content.">
                <div className={universityStyles.featurePillList}>
                  <div className={universityStyles.featurePill}>
                    <span>Theory first</span>
                    <strong>then notes</strong>
                  </div>
                  <div className={universityStyles.featurePill}>
                    <span>Worked examples</span>
                    <strong>then practice</strong>
                  </div>
                  <div className={universityStyles.featurePill}>
                    <span>Revision loop</span>
                    <strong>then AI help</strong>
                  </div>
                </div>
              </SectionCard>
            </div>

            <div className={universityStyles.moduleGrid}>
              {orderedModules.map((module) => {
                const primary = getPrimaryLink(module.code);
                const isFeatured = featuredCodes.has(module.code.toUpperCase());
                const isEconomics = module.code.toUpperCase() === "ECON211";
                const isTrade = module.code.toUpperCase() === "EKIP212";
                const isEthics = module.code.toUpperCase() === "WVES312";
                return (
                  <article
                    key={`${module.code}-${module.yearOfStudy}-${module.semester ?? "x"}`}
                    className={[universityStyles.moduleCard, isFeatured ? universityStyles.moduleCardPrimary : null].filter(Boolean).join(" ")}
                  >
                    <div className={universityStyles.moduleTop}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <span className={universityStyles.moduleCode}>{module.code}</span>
                        <h3 className={universityStyles.moduleName}>{module.name}</h3>
                        <p className={universityStyles.moduleMeta}>{buildModuleMeta(module)}</p>
                      </div>
                      <Badge variant={module.isCore === false ? "neutral" : "gold"} className="skeu-badge">
                        {module.isCore === false ? "Elective" : "Core / tracked"}
                      </Badge>
                    </div>

                    <div className={universityStyles.moduleBadgeRow}>
                      <span className="assistant-context-chip">{institutionName}</span>
                      <span className="assistant-context-chip">Year {module.yearOfStudy}</span>
                      <span className="assistant-context-chip">{formatModuleDuration(module)}</span>
                    </div>

                    <div className={universityStyles.moduleFooter}>
                      <Link className="button skeu-btn" href={primary.href} prefetch={false}>
                        {primary.label}
                      </Link>
                      {isEconomics ? (
                        <>
                          <Link className="button skeu-btn-ghost" href="/university/modules/econ211/notes" prefetch={false}>
                            Open notes
                          </Link>
                          <Link className="button skeu-btn-ghost" href="/university/modules/econ211/past-papers" prefetch={false}>
                            Past papers
                          </Link>
                        </>
                      ) : isTrade ? (
                        <Link className="button skeu-btn-ghost" href="/tutor?q=Explain%20EKIP212%20trade%20relations" prefetch={false}>
                          Ask AI about EKIP212
                        </Link>
                      ) : isEthics ? (
                        <Link className="button skeu-btn-ghost" href="/tutor?q=Explain%20WVES312%20business%20ethics%20concepts" prefetch={false}>
                          Ask AI about WVES312
                        </Link>
                      ) : (
                        <Link className="button skeu-btn-ghost" href={`/tutor?q=${encodeURIComponent(`Explain ${module.code} ${module.name}`)}`} prefetch={false}>
                          Ask AI
                        </Link>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </>
    );

    return renderCuratedShell({
      title: "University learning path",
      subtitle: [institutionName, faculty, academicState.course].filter(Boolean).join(" · "),
      heroTitle: "Your enrolled modules should feel curated, not dumped in a pile.",
      heroCopy:
        "SCHOOL now highlights the right module first, keeps your study path visible, and links straight into the richer content surfaces for each course instead of leaving you in a flat list.",
      heroActions,
      heroPanel,
      content,
    });
  }

  const phases = getLearnPhases();
  const phaseVisuals: Record<string, PhaseVisual> = {
    foundation: { mark: "R–3", title: "Foundation", description: "Grades R–3 · literacy, numeracy, and life skills" },
    intermediate: { mark: "4–6", title: "Intermediate", description: "Grades 4–6 · CAPS learning areas" },
    senior: { mark: "7–9", title: "Senior", description: "Grades 7–9 · core and elective subjects" },
    fet: { mark: "10–12", title: "FET", description: "Grades 10–12 · matric study" },
  };

  return (
    <div className={styles.page}>
      <Suspense>
        <ProfilePathHint surface="learn" />
      </Suspense>
      <LearnHomeGuidance />
      <LearningStyleOnboarding />
      <div className={styles.grid}>
        {phases.map((phase) => {
          const visual = phaseVisuals[phase.key] ?? { mark: "•", title: phase.name, description: "" };
          return (
            <Link key={phase.key} href={`/learn/${phase.key}`} className={styles.card} prefetch={false}>
              <span className={styles.mark}>{visual.mark}</span>
              <span className={styles.body}>
                <span className={styles.name}>{visual.title}</span>
                {visual.description ? <span className={styles.desc}>{visual.description}</span> : null}
              </span>
              <svg className={styles.chevron} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          );
        })}
      </div>
      <Link href="/university/learning" className={styles.university} prefetch={false}>
        <span className={styles.universityName}>University path</span>
        <svg className={styles.chevron} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </div>
  );
}
