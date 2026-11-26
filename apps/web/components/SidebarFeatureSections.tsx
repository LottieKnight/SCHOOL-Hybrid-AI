"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LiteModeToggle } from "@/components/LiteModeToggle";
import { DarkLightToggle } from "@/components/DarkLightToggle";
import { getSidebarFeatureGroups, resolveClassId } from "@/lib/featureCatalog";

type GradeLink = {
  key: string;
  name: string;
};

type PhaseLink = {
  key: string;
  label: string;
  grades: GradeLink[];
};

function SidebarGroupIcon({ groupKey }: { groupKey: string }) {
  if (groupKey === "learning") {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path
          d="M9 4.2c-2.4 0-4.3 2-4.3 4.4v1.2c-1.5.5-2.5 1.9-2.5 3.5 0 2 1.5 3.6 3.4 3.8.2 1.7 1.7 3 3.6 3 1.3 0 2.4-.6 3.1-1.6.6 1 1.8 1.6 3.1 1.6 1.9 0 3.4-1.3 3.6-3 1.9-.2 3.4-1.9 3.4-3.8 0-1.6-1-3-2.5-3.5V8.6C19.3 6.2 17.4 4.2 15 4.2c-1.4 0-2.7.6-3.5 1.6-.8-1-2.1-1.6-3.5-1.6Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M12 6.6v10.8M7.6 8.7c1.2.1 2.1 1.1 2.1 2.4M7.2 12.1c1.3 0 2.3 1 2.3 2.2M16.4 8.7c-1.2.1-2.1 1.1-2.1 2.4M16.8 12.1c-1.3 0-2.3 1-2.3 2.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (groupKey === "practice") {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path
          d="M6 4h8.5c1.7 0 3 1.3 3 3v12.5c0 .4-.3.7-.7.7H7.5c-1.4 0-2.5-1.1-2.5-2.5V5.5c0-.8.7-1.5 1.5-1.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M8.2 7.8h6.4M8.2 10.6h6.4M8.2 13.4h4.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (groupKey === "community") {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path
          d="M14.5 8.2c0 1.6-1.3 2.9-2.9 2.9S8.7 9.8 8.7 8.2s1.3-2.9 2.9-2.9 2.9 1.3 2.9 2.9Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M6.6 18.6c.8-2.3 3-3.9 5.6-3.9s4.8 1.6 5.6 3.9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M16.6 6.5h4.4v6.2h-4.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (groupKey === "commerce") {
    return (
      <svg viewBox="0 0 24 24" focusable="false">
        <path
          d="M4.5 7.5h14.8a1.7 1.7 0 0 1 1.7 1.7v7.1a1.7 1.7 0 0 1-1.7 1.7H4.5a1.7 1.7 0 0 1-1.7-1.7V9.2a1.7 1.7 0 0 1 1.7-1.7Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M15.7 13h5.3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <circle cx="16.4" cy="13" r="1.1" fill="currentColor" />
        <path
          d="M6 7.4V5.8a1.6 1.6 0 0 1 1.6-1.6h9.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" focusable="false">
      <path
        d="M12 4.5c4.1 0 7.4 3.3 7.4 7.4S16.1 19.3 12 19.3 4.6 16 4.6 11.9 7.9 4.5 12 4.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M12 1.9v2.7M12 19.4v2.7M1.9 12h2.7M19.4 12h2.7M4.4 4.4l1.9 1.9M17.7 17.7l1.9 1.9M19.6 4.4l-1.9 1.9M6.3 17.7l-1.9 1.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SidebarFeatureSections({ phaseGrades }: { phaseGrades: PhaseLink[] }) {
  const pathname = usePathname() || "";
  const classId = resolveClassId(pathname);
  const groups = getSidebarFeatureGroups(classId);

  return (
    <>
      {groups.map((group) => (
        <li key={group.key}>
          <details className="sidebar-store" open>
            <summary className="sidebar-item">
              <span className="side-icon" aria-hidden="true">
                <SidebarGroupIcon groupKey={group.key} />
              </span>
              {group.label}
            </summary>
            <div className="store-menu">
              <div className="sidebar-group-copy">
                <strong>{group.label}</strong>
                <span>{group.description}</span>
              </div>
              {group.features.map((feature) => (
                <Link key={feature.href} className="button store-link" href={feature.href} prefetch={false}>
                  <span className="store-link-copy">
                    <strong>{feature.label}</strong>
                    <span>
                      {feature.badge ? `${feature.badge}: ${feature.description}` : feature.description}
                    </span>
                  </span>
                </Link>
              ))}
              {group.key === "learning" ? (
                <div className="sidebar-phase-grid" aria-label="Quick phase links">
                  {phaseGrades.map((phase) => (
                    <Link
                      key={phase.key}
                      className="button store-link"
                      href={`/learn/${phase.key}`}
                      prefetch={false}
                    >
                      <span className="store-link-copy">
                        <strong>{phase.label}</strong>
                        <span>Open the {phase.label.toLowerCase()} curriculum path.</span>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : null}
              {group.key === "account" ? (
                <div className="sidebar-settings-card">
                  <DarkLightToggle />
                  <LiteModeToggle />
                </div>
              ) : null}
            </div>
          </details>
        </li>
      ))}
    </>
  );
}
