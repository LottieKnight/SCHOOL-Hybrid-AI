import Link from "next/link";
import type { Metadata } from "next";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { SiteFooter } from "@/components/ui/SiteFooter";
import { getFeatureGroups } from "@/lib/featureCatalog";
import { changelog } from "@/lib/changelog";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Features & Updates",
  description:
    "Everything the SCHOOL platform offers — learning tools, community, exam prep, and the marketplace — plus a full changelog of what's new.",
};

export default function FeaturesPage() {
  const featureGroups = getFeatureGroups();

  return (
    <div className={`${styles.page} home-center-headings`}>
      {/* ── Top nav ── */}
      <section className={styles.topNav}>
        <Link href="/" prefetch={false} className={styles.topLogo}>
          SCHOOL
        </Link>
        <div className={styles.topLinks}>
          <Link className={`${styles.secondaryButton} ${styles.topLinksHideOnMobile}`} href="/community" prefetch={false}>
            Community
          </Link>
          <Link className={`${styles.secondaryButton} ${styles.topLinksHideOnMobile}`} href="/classes/demo-class/past-papers" prefetch={false}>
            Past Papers
          </Link>
          <Link className={`${styles.secondaryButton} ${styles.topLinksHideOnMobile}`} href="#sign-in" prefetch={false}>
            Sign in
          </Link>
          <Link className="button prestigious-shine" href="/onboarding" prefetch={false}>
            Join free
          </Link>
        </div>
      </section>

      {/* ── Page header ── */}
      <header className={styles.pageHeader}>
        <span className="eyebrow" style={{ color: "var(--gold)" }}>
          <span style={{ display: "inline-block", verticalAlign: "middle", marginRight: "6px", lineHeight: 0 }}>
            <SchoolLogo size={18} />
          </span>
          Platform Features & Updates
        </span>
        <h1 className={styles.pageTitle}>Everything SCHOOL can do.</h1>
        <p className={styles.pageSubtitle}>
          A full index of every tool on the platform, grouped by what you're trying to do — plus a
          running changelog of what's been shipped, so you always know what's new.
        </p>
      </header>

      {/* ── Changelog ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className="eyebrow">Updates</span>
          <h2 className={styles.sectionTitle}>What's been shipped</h2>
        </div>

        <div className={styles.changelog}>
          {changelog.map((entry) => (
            <div key={entry.version} className={styles.changelogEntry}>
              <div className={styles.changelogMeta}>
                <span className={styles.versionChip}>{entry.version}</span>
                <span className={styles.changelogDate}>
                  {new Date(entry.date).toLocaleDateString("en-ZA", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
              <p className={styles.changelogHeadline}>{entry.headline}</p>
              <ul className={styles.changelogItems}>
                {entry.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── Feature groups ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className="eyebrow">Explore</span>
          <h2 className={styles.sectionTitle}>Every part of SCHOOL</h2>
        </div>

        <div className={styles.featureGroups}>
          {featureGroups.map((group) => (
            <section key={group.key} className={styles.featureGroup}>
              <div className={styles.featureGroupHeader}>
                <h3>{group.label}</h3>
                <p>{group.description}</p>
              </div>
              <div className={styles.featureGrid}>
                {group.features.map((feature) => (
                  <Link
                    key={feature.href}
                    href={feature.href}
                    prefetch={false}
                    className={`${styles.featureCard} bezel-gem prestigious-shine`}
                  >
                    <div className={styles.featureTop}>
                      <strong>{feature.label}</strong>
                      {feature.badge ? (
                        <span className={styles.featureBadge}>{feature.badge}</span>
                      ) : null}
                    </div>
                    <p>{feature.description}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <div className={styles.footerCta}>
        <h2 className={styles.footerCtaTitle}>Ready to join your campus?</h2>
        <p className={styles.footerCtaSubtitle}>
          Free to sign up. No credit card. No trial period. Your campus room is already here —
          classmates are posting and answering questions right now.
        </p>
        <Link className="button prestigious-shine" href="/onboarding" prefetch={false}>
          Join free →
        </Link>
      </div>

      <SiteFooter />
    </div>
  );
}
