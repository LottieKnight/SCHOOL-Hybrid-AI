import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { Badge } from "@/components/ui/Badge";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { SectionCard } from "@/components/ui/SectionCard";
import styles from "./PhaseCards.module.css";
import universityStyles from "./UniversityLearn.module.css";
import { LearningStyleOnboarding } from "@/components/LearningStyleOnboarding";
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
  icon: string;
  gradeRange: string;
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
    foundation: { icon: "🌱", gradeRange: "Grades R–3", description: "Literacy, numeracy, and life skills for early learners." },
    intermediate: { icon: "🚀", gradeRange: "Grades 4–6", description: "Expanding knowledge across all CAPS learning areas." },
    senior: { icon: "🔭", gradeRange: "Grades 7–9", description: "Deeper study across core and elective subjects." },
    fet: { icon: "🎓", gradeRange: "Grades 10–12", description: "Matric-focused study with subject specialisation." },
  };

  const heroActions = (
    <>
        <Link className="button skeu-btn" href={`/learn/${phases[0]?.key ?? "foundation"}`} prefetch={false}>
        Start learning
      </Link>
      <Link className={outlineGhostButtonClassName()} href="/dashboard">
        Dashboard
      </Link>
      <Link className={outlineGhostButtonClassName()} href="/university/learning">
        University path
      </Link>
    </>
  );

  const heroPanel = (
    <>
      <div style={{ display: "grid", gap: 8 }}>
        <span className="assistant-context-chip">Choose a phase</span>
        <h2 className={universityStyles.heroPanelTitle}>Four learning bands, one clear entry point</h2>
        <p className={universityStyles.heroPanelCopy}>
          SCHOOL keeps the phase chooser visible and expands each phase into a focused study surface when you open it.
        </p>
      </div>

      <div className={universityStyles.stats}>
        <div className={universityStyles.statRow}>
          <span className="text-dim">Phases</span>
          <strong>{phases.length}</strong>
        </div>
        <div className={universityStyles.statRow}>
          <span className="text-dim">Best on mobile</span>
          <strong>Yes</strong>
        </div>
        <div className={universityStyles.statRow}>
          <span className="text-dim">Route</span>
          <strong>/learn</strong>
        </div>
      </div>
    </>
  );

  const content = (
    <>
      <LearningStyleOnboarding />

      <div className={styles.grid}>
        {phases.map((phase) => {
          const visual = phaseVisuals[phase.key] ?? { icon: "📚", gradeRange: "", description: "" };
          return (
            <Link key={phase.key} href={`/learn/${phase.key}`} className={styles.card} prefetch={false}>
              <div className={styles.banner} data-phase={phase.key}>
                <span className={styles.icon}>{visual.icon}</span>
                {visual.gradeRange ? <span className={styles.gradeRange}>{visual.gradeRange}</span> : null}
              </div>
              <div className={styles.body}>
                <p className={styles.name}>{phase.name}</p>
                <p className={styles.desc}>{visual.description}</p>
                <div className={styles.footer}>
                  <span className={styles.cta}>Explore grades →</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <SectionCard title="What each phase does" description="The route stays simple up front, then expands when you pick a band.">
          <div style={{ display: "grid", gap: 10 }}>
            {phases.map((phase) => {
              const visual = phaseVisuals[phase.key] ?? { icon: "📚", gradeRange: "", description: "" };
              return (
                <div key={`phase-summary-${phase.key}`} className="glass" style={{ borderRadius: 14, padding: 12, display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <strong>{phase.name}</strong>
                    {visual.gradeRange ? <Badge variant="neutral" className="skeu-badge">{visual.gradeRange}</Badge> : null}
                  </div>
                  <span style={{ lineHeight: 1.5 }}>{visual.description}</span>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="If you want the richer route" description="The university module pages carry the formatted study content and image-backed cover treatment.">
          <div style={{ display: "grid", gap: 10 }}>
            <Link className="button skeu-btn" href="/university/modules/ekip212">
              Open EKIP212 preview
            </Link>
            <Link className="button skeu-btn-ghost" href="/university/learning">
              Open university learning path
            </Link>
            <Link className="button skeu-btn-ghost" href="/university/modules/econ211">
              Open ECON211 study surface
            </Link>
          </div>
        </SectionCard>
      </div>
    </>
  );

  return renderCuratedShell({
    title: "Learn",
    subtitle: "Choose a phase to begin your CAPS-aligned learning journey.",
    heroTitle: "Find the right entry point, then move into the right study surface.",
    heroCopy:
      "SCHOOL now gives `/learn` a more intentional front door: a clearer phase chooser, a stronger visual frame, and direct access into the richer module pages when you need them.",
    heroActions,
    heroPanel,
    content,
  });
}
