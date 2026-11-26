import Link from "next/link";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { SiteFooter } from "@/components/ui/SiteFooter";
import { HomeAuthCard } from "@/components/HomeAuthCard";
import { HomepagePresenceStrip } from "@/components/HomepagePresenceStrip";
import { LiveAnchor, LiveAnchorSkeleton } from "@/components/LiveAnchor";
import { InstallPwaButton } from "@/components/InstallPwaButton";
import styles from "./page.module.css";

export default async function HomePage() {
  const t = await getTranslations("home");

  const proof = [
    {
      stat: t("proofStat0"),
      label: t("proofLabel0"),
      detail: t("proofDetail0"),
    },
    {
      stat: t("proofStat1"),
      label: t("proofLabel1"),
      detail: t("proofDetail1"),
    },
    {
      stat: t("proofStat2"),
      label: t("proofLabel2"),
      detail: t("proofDetail2"),
    },
  ];

  const features = [
    {
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>,
      title: t("featureAskModuleTitle"),
      description: t("featureAskModuleDesc"),
      href: "/community",
      cta: t("featureAskModuleCta"),
    },
    {
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"></path><rect width="16" height="12" x="4" y="8" rx="2"></rect><path d="M2 14h2"></path><path d="M20 14h2"></path><path d="M15 13v2"></path><path d="M9 13v2"></path></svg>,
      title: t("featureAiTutorTitle"),
      description: t("featureAiTutorDesc"),
      href: "/tutor",
      cta: t("featureAiTutorCta"),
    },
    {
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>,
      title: t("featurePastPapersTitle"),
      description: t("featurePastPapersDesc"),
      href: "/past-papers",
      cta: t("featurePastPapersCta"),
    },
    {
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>,
      title: t("featureDailyQuizTitle"),
      description: t("featureDailyQuizDesc"),
      href: "/daily-quiz",
      cta: t("featureDailyQuizCta"),
    },
    {
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>,
      title: t("featurePlannerTitle"),
      description: t("featurePlannerDesc"),
      href: "/planner",
      cta: t("featurePlannerCta"),
    },
    {
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"></rect><line x1="6" y1="12" x2="10" y2="12"></line><line x1="8" y1="9" x2="8" y2="15"></line><circle cx="15.5" cy="10.5" r=".5"></circle><circle cx="18.5" cy="13.5" r=".5"></circle></svg>,
      title: t("featureGamesTitle"),
      description: t("featureGamesDesc"),
      href: "/community/games",
      cta: t("featureGamesCta"),
    },
  ];

  const steps = [
    { n: t("step01Number"), title: t("step01Title"), body: t("step01Body") },
    { n: t("step02Number"), title: t("step02Title"), body: t("step02Body") },
    { n: t("step03Number"), title: t("step03Title"), body: t("step03Body") },
  ];

  const trustItems = [
    { label: t("trustLabel0"), copy: t("trustCopy0") },
    { label: t("trustLabel1"), copy: t("trustCopy1") },
    { label: t("trustLabel2"), copy: t("trustCopy2") },
    { label: t("trustLabel3"), copy: t("trustCopy3") },
  ];

  return (
    <div className={`${styles.page} home-center-headings home-gold`}>

      {/* ── Promo banner: fresh papers rail ── */}
      <section className={`${styles.banner} om-banner`}>
        <div className={styles.bannerGlow} aria-hidden="true" />
        <div className={styles.bannerIcon} aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>
        </div>
        <div className={styles.bannerCopy}>
          <span className="eyebrow" style={{ color: "var(--gold)" }}>{t("bannerEyebrow")}</span>
          <strong className={styles.bannerTitle}>{t("bannerTitle")}</strong>
          <p className={styles.bannerBody}>{t("bannerBody")}</p>
        </div>
        <Link className="button prestigious-shine" href="/past-papers" prefetch={false}>
          {t("bannerCta")}
        </Link>
      </section>

      {/* ── Top nav ── */}
      <section className={styles.topNav}>
        <span className={styles.topNavAccent} aria-hidden="true" />
        <Link href="/" prefetch={false} className={`${styles.topLogo} home-wordmark`}>
          SCHOOL<strong> ACADEMIC PLATFORM</strong>
        </Link>
        <div className={styles.topLinks}>
          <details className={styles.mobileMenu}>
            <summary className={styles.mobileMenuButton} aria-haspopup="true">
              {t("navMenu")}
            </summary>
            <nav className={styles.mobileMenuPanel} aria-label={t("navMenuLabel")}>
              <Link className={styles.mobileMenuLink} href="/community" prefetch={false}>
                {t("navCommunity")}
              </Link>
              <Link className={styles.mobileMenuLink} href="/past-papers" prefetch={false}>
                {t("navPastPapers")}
              </Link>
              <Link className={styles.mobileMenuLink} href="/features" prefetch={false}>
                {t("navFeatures")}
              </Link>
              <Link className={styles.mobileMenuLink} href="#sign-in" prefetch={false}>
                {t("navSignIn")}
              </Link>
            </nav>
          </details>
          <Link className={`${styles.secondaryButton} ${styles.topLinksHideOnMobile}`} href="/community" prefetch={false}>
            {t("navCommunity")}
          </Link>
          <Link className={`${styles.secondaryButton} ${styles.topLinksHideOnMobile}`} href="/past-papers" prefetch={false}>
            {t("navPastPapers")}
          </Link>
          <Link className={`${styles.secondaryButton} ${styles.topLinksHideOnMobile}`} href="/features" prefetch={false}>
            {t("navFeatures")}
          </Link>
          <Link className={`${styles.secondaryButton} ${styles.topLinksHideOnMobile}`} href="#sign-in" prefetch={false}>
            {t("navSignIn")}
          </Link>
          <Link className="button prestigious-shine" href="/onboarding" prefetch={false}>
            {t("navJoin")}
          </Link>
        </div>
      </section>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={`${styles.heroCard} bezel-gem card prestigious-shine om-vignette`}>
          <span className={`${styles.heroGrid} om-grid-bg`} aria-hidden="true" />
          <span className={styles.heroOrb1} aria-hidden="true" />
          <span className={styles.heroOrb2} aria-hidden="true" />
          <div className={styles.heroCopy}>
            <div className={styles.heroEyebrow}>
              <SchoolLogo size={42} />
              <span className="eyebrow" style={{ color: "var(--gold)" }}>{t("heroEyebrow")}</span>
            </div>
            <h1 className={styles.heroTitle}>{t("heroTitle")}</h1>
            <p className={styles.heroSubtitle}>
              {t("heroSubtitle")}
            </p>
          </div>

          <div className={styles.ctaRow}>
            <Link className={`button prestigious-shine ${styles.primaryCta}`} href="/onboarding" prefetch={false}>
              {t("heroPrimaryCtaLabel")}
            </Link>
            <Link className={styles.secondaryButton} href="/tutor" prefetch={false}>
              {t("featureAiTutorCta")}
            </Link>
            <div className={styles.ctaTertiary}>
              <Link className={styles.ctaTertiaryLink} href="/community" prefetch={false}>
                {t("heroBrowseCommunity")}
              </Link>
              <span className={styles.ctaTertiarySep} aria-hidden="true" />
              <Link className={styles.ctaTertiaryLink} href="/past-papers" prefetch={false}>
                {t("heroPastPapers")}
              </Link>
            </div>
          </div>

          <div className={styles.statRow}>
            {proof.map((p) => (
              <div key={p.stat} className={styles.statCard}>
                <strong className={styles.statValue}><span className={styles.statValueInner}>{p.stat}</span></strong>
                <span className={styles.statLabel}>{p.label}</span>
                <p className={styles.statCopy}>{p.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.signupFloat}>
          <aside id="sign-in" className={`${styles.signupCard} bezel-gem card prestigious-shine`}>
            <HomeAuthCard />
          </aside>
        </div>
      </section>

      {/* ── Presence strip ── */}
      <HomepagePresenceStrip />

      {/* ── Proof section: community + tools unified ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className="eyebrow">{t("howItWorksEyebrow")}</span>
          <h2 className={styles.cardTitle}>{t("howItWorksHeading")}</h2>
          <p className="subtitle">
            {t("howItWorksSubtitle")}
          </p>
        </div>

        <div className={styles.proofLayout}>
          <div className={styles.proofExplain}>
            <span className="eyebrow" style={{ color: "var(--gold)" }}>{t("theLoopEyebrow")}</span>
            <div style={{ display: "grid", gap: "18px" }}>
              {steps.map((step) => (
                <div key={step.n} style={{ display: "grid", gap: "4px" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.08em", color: "var(--text-3)" }}>{step.n}</span>
                  <strong style={{ color: "var(--text-1)", fontSize: "0.93rem" }}>{step.title}</strong>
                  <p style={{ margin: 0, color: "var(--text-2)", fontSize: "0.85rem", lineHeight: 1.6 }}>{step.body}</p>
                </div>
              ))}
            </div>
            <div style={{ marginTop: "8px" }}>
              <Link className="button prestigious-shine" href="/community" prefetch={false}>
                {t("openCommunity")}
              </Link>
            </div>
          </div>

          <div className={styles.proofFeatureGrid}>
            {features.map((f) => (
              <Link key={f.href} href={f.href} prefetch={false} className={styles.proofFeatureCard}>
                <span aria-hidden="true" style={{ color: "var(--gold)" }}>{f.icon}</span>
                <strong className={styles.proofFeatureTitle}>{f.title}</strong>
                <p className={styles.proofFeatureDesc}>{f.description}</p>
                <span className={styles.showcaseCta}>{f.cta}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust section ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className="eyebrow">{t("whySchoolEyebrow")}</span>
          <h2 className={styles.cardTitle}>{t("whySchoolHeading")}</h2>
          <p className="subtitle">{t("whySchoolSubtitle")}</p>
        </div>

        <div className={styles.trustGrid}>
          {trustItems.map((item) => (
            <div key={item.label} className={styles.trustCard}>
              <strong style={{ color: "var(--gold)", fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase" }}>{item.label}</strong>
              <p style={{ margin: 0, color: "var(--text-2)", fontSize: "0.88rem", lineHeight: 1.65 }}>{item.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Live anchor band ── */}
      <div className={styles.liveAnchorBand}>
        <Suspense fallback={<LiveAnchorSkeleton />}>
          <LiveAnchor />
        </Suspense>
        <div className={styles.liveAnchorNote}>
          <span className="eyebrow">{t("liveAnchorFeaturesEyebrow")}</span>
          <p style={{ margin: 0, color: "var(--text-2)", fontSize: "0.88rem", lineHeight: 1.6 }}>
            {t("liveAnchorFeaturesBody")}
          </p>
          <Link className={styles.secondaryButton} href="/features" prefetch={false} style={{ justifySelf: "start" }}>
            {t("liveAnchorBrowseFeatures")}
          </Link>
        </div>
      </div>

      {/* ── Mission / Ludo Principle ── */}
      <section className={styles.section} style={{ borderTop: "1px solid var(--border)", paddingTop: "64px" }}>
        <div className={styles.sectionHeader} style={{ maxWidth: "720px", margin: "0 auto" }}>
          <span className="eyebrow" style={{ color: "var(--gold)" }}>{t("missionEyebrow")}</span>
          <h2 className={styles.cardTitle} style={{ textAlign: "left" }}>
            {t("missionHeading")}
          </h2>
          <p className="subtitle" style={{ textAlign: "left" }}>
            {t("missionPara1")}
          </p>
          <p className="subtitle" style={{ textAlign: "left", marginTop: "16px" }}>
            {t("missionPara2")}
          </p>
          <p className="subtitle" style={{ textAlign: "left", marginTop: "16px" }}>
            {t("missionPara3Pre")}<em>{t("missionLudoPrinciple")}</em>{t("missionPara3Post")}
          </p>
          <p className="subtitle" style={{ textAlign: "left", marginTop: "16px" }}>
            {t("missionPara4")}
          </p>
          <p style={{ marginTop: "20px", fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.1em", color: "var(--gold)", textTransform: "uppercase" }}>
            {t("missionTagline")}
          </p>
        </div>
      </section>

      {/* ── Social ── */}
      <section className={styles.section} style={{ borderTop: "1px solid var(--border)", paddingTop: "48px" }}>
        <div className={styles.sectionHeader}>
          <span className="eyebrow">{t("socialEyebrow")}</span>
          <h2 className={styles.cardTitle}>{t("socialHeading")}</h2>
          <p className="subtitle">{t("socialSubtitle")}</p>
          <div style={{ marginTop: "24px", display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
            <InstallPwaButton/>
            <a
              href="https://www.instagram.com/school_academic_platform?igsh=MXZwa2JzNXBteDlpcA%3D%3D&utm_source=qr"
              target="_blank"
              rel="noopener noreferrer"
              className="button prestigious-shine"
              style={{ background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)", color: "white", textTransform: "none", fontSize: "14px" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "8px" }}><rect width="20" height="20" x="2" y="2" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
              {t("socialInstagramCta")}
            </a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
