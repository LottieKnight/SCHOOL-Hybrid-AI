"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import styles from "./page.module.css";

type SetupStatus = "not_started" | "in_progress" | "done";

type CopyBlock = {
  label: string;
  value: string;
};

type SetupSection = {
  id: string;
  storageKey: string;
  platform: string;
  accent: string;
  secondary: string;
  url: string;
  note?: string;
  copyBlocks: CopyBlock[];
  steps: string[];
};

const DEFAULT_STATUS: SetupStatus = "not_started";

const STATUS_OPTIONS: Array<{ value: SetupStatus; label: string }> = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

const SECTIONS: SetupSection[] = [
  {
    id: "domain",
    storageKey: "setup_domain",
    platform: "Domain (GoDaddy)",
    accent: "#00A4E4",
    secondary: "#7FDBFF",
    url: "https://www.godaddy.com/domainsearch/find?domainToCheck=schoolacademic.co.za",
    note: "Also register schoolacademic.com.",
    copyBlocks: [
      { label: "Primary domain", value: "schoolacademic.co.za" },
      { label: "Secondary domain", value: "schoolacademic.com" },
    ],
    steps: [
      "Open the GoDaddy domain search and confirm schoolacademic.co.za is available.",
      "Add both schoolacademic.co.za and schoolacademic.com to the cart.",
      "Complete checkout.",
      "If Google Workspace will manage mail, point nameservers or DNS records accordingly after purchase.",
    ],
  },
  {
    id: "email",
    storageKey: "setup_email",
    platform: "Email (Google Workspace)",
    accent: "#4285F4",
    secondary: "#34A853",
    url: "https://workspace.google.com/intl/en/",
    copyBlocks: [
      { label: "Domain", value: "schoolacademic.co.za" },
      { label: "Inbox 1", value: "hello@schoolacademic.co.za" },
      { label: "Inbox 2", value: "founder@schoolacademic.co.za" },
    ],
    steps: [
      "Sign up for Google Workspace Business Starter.",
      "Verify domain ownership through GoDaddy DNS.",
      "Create hello@schoolacademic.co.za and founder@schoolacademic.co.za.",
    ],
  },
  {
    id: "tiktok",
    storageKey: "setup_tiktok",
    platform: "TikTok",
    accent: "#25F4EE",
    secondary: "#FE2C55",
    url: "https://www.tiktok.com/signup",
    copyBlocks: [
      { label: "Handle", value: "@schoolacademic" },
      { label: "Display name", value: "SCHOOL - Study Smarter" },
      {
        label: "Bio",
        value: "AI study platform built for SA students 🇿🇦 NWU -> all campuses • Launching now",
      },
      { label: "Category", value: "Education" },
    ],
    steps: [
      "Sign up using the founder email.",
      "Verify the phone number.",
      "Switch the profile to a Business account.",
      "Fill the handle, display name, bio, and category from the copy blocks.",
      "Add schoolacademic.co.za as the profile link.",
    ],
  },
  {
    id: "instagram",
    storageKey: "setup_instagram",
    platform: "Instagram",
    accent: "#E4405F",
    secondary: "#FCAF45",
    url: "https://www.instagram.com/accounts/emailsignup/",
    copyBlocks: [
      { label: "Handle", value: "@schoolacademic" },
      { label: "Display name", value: "SCHOOL - Academic OS" },
      {
        label: "Bio",
        value:
          "AI study assistant built for South African students 🇿🇦\nYour curriculum. Your campus. Your platform.\n👇 Join the waitlist",
      },
    ],
    steps: [
      "Create the account.",
      "Switch it to a Professional or Creator account.",
      "Fill the profile using the prepared copy.",
      "Add the website link.",
      "Create four Story Highlights: What is SCHOOL / NWU Launch / The AI Tutor / Marketplace.",
    ],
  },
  {
    id: "twitter",
    storageKey: "setup_twitter",
    platform: "X (Twitter)",
    accent: "#FFFFFF",
    secondary: "#8B93B8",
    url: "https://twitter.com/i/flow/signup",
    copyBlocks: [
      { label: "Handle", value: "@schoolacademic" },
      { label: "Display name", value: "SCHOOL" },
      {
        label: "Bio",
        value:
          "Building the academic OS for South African students. AI study assistant + campus marketplace + knowledge system. Launching at NWU. 🇿🇦",
      },
      { label: "Location", value: "Vanderbijlpark, South Africa" },
    ],
    steps: [
      "Create the account.",
      "Fill the profile using the prepared copy.",
      "Upload the header image.",
      "After Monday launch content goes live, pin the launch thread.",
    ],
  },
  {
    id: "facebook",
    storageKey: "setup_facebook",
    platform: "Facebook",
    accent: "#1877F2",
    secondary: "#8B93B8",
    url: "https://www.facebook.com/pages/create",
    copyBlocks: [
      { label: "Page name", value: "SCHOOL - Academic OS" },
      { label: "Category", value: "Education / Software" },
      {
        label: "Description",
        value: "AI-powered study platform built for South African university students.",
      },
    ],
    steps: [
      "Create a Facebook Page, not a personal profile.",
      "Fill all page fields using the prepared copy.",
      "Add the profile image and cover image.",
      "Add schoolacademic.co.za as the website URL.",
    ],
  },
  {
    id: "linkedin",
    storageKey: "setup_linkedin",
    platform: "LinkedIn",
    accent: "#0A66C2",
    secondary: "#8B93B8",
    url: "https://www.linkedin.com/company/setup/new/",
    copyBlocks: [
      { label: "Company name", value: "SCHOOL" },
      { label: "Tagline", value: "The Academic Operating System for South African students" },
      { label: "Industry", value: "E-Learning" },
      { label: "Company size", value: "1-10 employees" },
    ],
    steps: [
      "Create the company page.",
      "Fill the company fields using the prepared copy.",
      "Upload the logo and cover image.",
      "Publish the page.",
    ],
  },
  {
    id: "cipc",
    storageKey: "setup_cipc",
    platform: "CIPC (Company Registration)",
    accent: "#00A651",
    secondary: "#F59E0B",
    url: "https://eservices.cipc.co.za",
    copyBlocks: [
      { label: "Company type", value: "Private Company (Pty) Ltd" },
      { label: "Proposed name", value: "SCHOOL Academic OS (Pty) Ltd" },
      { label: "Cost", value: "R175" },
    ],
    steps: [
      "Create a CIPC eServices account.",
      "Search whether the company name is available.",
      "Reserve the company name.",
      "Submit the incorporation documents.",
      "Pay the R175 fee.",
      "Wait for the COR14.3 certificate, usually 5 to 10 business days.",
    ],
  },
];

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "").trim();
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : normalized;
  const parsed = Number.parseInt(value, 16);
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

function buildAccentVariables(primary: string, secondary: string) {
  const rgb = hexToRgb(primary);
  return {
    "--inst-primary": primary,
    "--inst-secondary": secondary,
    "--inst-surface": `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`,
    "--inst-border": `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`,
    "--inst-text-on-p": rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114 > 150 ? "#07101F" : "#FFFFFF",
  } as CSSProperties;
}

function readStoredStatus(storageKey: string): SetupStatus {
  if (typeof window === "undefined") return DEFAULT_STATUS;
  const value = window.localStorage.getItem(storageKey);
  if (value === "not_started" || value === "in_progress" || value === "done") {
    return value;
  }
  return DEFAULT_STATUS;
}

export default function AdminSetupPage() {
  const [statuses, setStatuses] = useState<Record<string, SetupStatus>>({});
  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    const nextStatuses: Record<string, SetupStatus> = {};
    for (const section of SECTIONS) {
      nextStatuses[section.id] = readStoredStatus(section.storageKey);
    }

    const firstIncomplete = SECTIONS.find((section) => nextStatuses[section.id] !== "done")?.id ?? SECTIONS[0].id;
    const nextOpenPanels: Record<string, boolean> = {};
    for (const section of SECTIONS) {
      nextOpenPanels[section.id] = section.id === firstIncomplete;
    }

    setStatuses(nextStatuses);
    setOpenPanels(nextOpenPanels);
  }, []);

  const doneCount = useMemo(
    () => SECTIONS.filter((section) => statuses[section.id] === "done").length,
    [statuses]
  );
  const progressPercent = Math.round((doneCount / SECTIONS.length) * 100);

  const updateStatus = (section: SetupSection, status: SetupStatus) => {
    setStatuses((current) => {
      const next = { ...current, [section.id]: status };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(section.storageKey, status);
      }
      return next;
    });
    if (status === "done") {
      setOpenPanels((current) => ({ ...current, [section.id]: false }));
    }
  };

  const togglePanel = (sectionId: string) => {
    setOpenPanels((current) => ({ ...current, [sectionId]: !current[sectionId] }));
  };

  const copyText = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1800);
    } catch {
      setCopiedKey(null);
    }
  };

  return (
    <div className={styles.page}>
      <section className={`${styles.header} animate-fade-up`}>
        <div className={styles.headerTop}>
          <div className={styles.headerTitle}>
            <span className="eyebrow">Founder Launch Tool</span>
            <h1>SCHOOL Launch Setup</h1>
            <p className="assistant-helper">
              Move through each account once, mark progress as you go, and use the prepared copy blocks so setup stays fast.
            </p>
          </div>
          <div className={styles.summary}>
            <span className={styles.summaryValue}>
              {doneCount}/{SECTIONS.length} complete
            </span>
            <span className="text-dim">{progressPercent}% of launch setup done</span>
          </div>
        </div>

        <div className={styles.progressTrack} aria-hidden="true">
          <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
        </div>
      </section>

      <div className={styles.localOnlyNote}>
        Localhost founder utility only. This page stores status in your browser via localStorage and does not create any accounts for you.
      </div>

      <div className={styles.sectionList}>
        {SECTIONS.map((section) => {
          const status = statuses[section.id] ?? DEFAULT_STATUS;
          const isOpen = openPanels[section.id] ?? false;
          const accentVars = buildAccentVariables(section.accent, section.secondary);

          return (
            <section key={section.id} className={styles.section} style={accentVars}>
              <button className={styles.sectionHeader} type="button" onClick={() => togglePanel(section.id)}>
                <div className={styles.sectionHeaderMain}>
                  <span className={styles.accent} aria-hidden="true" />
                  <div className={styles.platformMeta}>
                    <div className={styles.platformNameRow}>
                      <strong className={styles.platformName}>{section.platform}</strong>
                      <span className={`ui-badge ${status === "done" ? "ui-badge--green" : status === "in_progress" ? "ui-badge--amber" : "ui-badge--neutral"}`}>
                        {STATUS_OPTIONS.find((option) => option.value === status)?.label}
                      </span>
                    </div>
                    <span className={styles.platformHint}>{section.note ?? "Prepared copy and launch steps ready."}</span>
                  </div>
                </div>

                <div className={styles.sectionHeaderSide}>
                  <div className={styles.statusToggle} onClick={(event) => event.stopPropagation()}>
                    {STATUS_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`${styles.statusButton} ${status === option.value ? styles.statusButtonActive : ""}`}
                        onClick={() => updateStatus(section, option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <span className={`${styles.collapseHint} ${isOpen ? styles.collapseHintOpen : ""}`}>v</span>
                </div>
              </button>

              {isOpen ? (
                <div className={styles.sectionBody}>
                  <div className={styles.linkRow}>
                    <a className={styles.openLink} href={section.url} target="_blank" rel="noreferrer">
                      Open setup link
                    </a>
                    <span className={styles.secondaryNote}>{section.url}</span>
                  </div>

                  <div className={styles.copyGrid}>
                    {section.copyBlocks.map((block) => {
                      const copyKey = `${section.id}:${block.label}`;
                      return (
                        <div key={copyKey} className={styles.copyCard}>
                          <div className={styles.copyCardHeader}>
                            <span className={styles.copyLabel}>{block.label}</span>
                            <button className={styles.copyButton} type="button" onClick={() => copyText(copyKey, block.value)}>
                              {copiedKey === copyKey ? "Copied" : "Copy"}
                            </button>
                          </div>
                          <div className={styles.copyText}>{block.value}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div className={styles.stepsBlock}>
                    <span className={styles.stepsTitle}>Step-by-step</span>
                    <ol className={styles.stepList}>
                      {section.steps.map((step) => (
                        <li key={step} className={styles.stepItem}>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
