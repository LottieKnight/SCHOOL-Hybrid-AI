"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export const JOURNEY_SECTIONS = [
  { id: "now", label: "Now", href: "/prototype", glyph: "☀", match: (p: string) => p === "/prototype" },
  { id: "learn", label: "Learn", href: "/prototype/learn", glyph: "◉", match: (p: string) => p.startsWith("/prototype/learn") },
  { id: "practice", label: "Practice", href: "/prototype/practice", glyph: "✦", match: (p: string) => p.startsWith("/prototype/practice") },
  { id: "explore", label: "Explore", href: "/prototype/explore", glyph: "❐", match: (p: string) => p.startsWith("/prototype/explore") },
  { id: "grow", label: "Grow", href: "/prototype/grow", glyph: "◔", match: (p: string) => p.startsWith("/prototype/grow") },
  { id: "staff", label: "Staff", href: "/prototype/staff", glyph: "⚙", match: (p: string) => p.startsWith("/prototype/staff") },
] as const;

export function ProtoShell({ firstName, studyPath, children }: { firstName: string; studyPath: string; children: ReactNode }) {
  const pathname = usePathname() || "/prototype";
  const initials = firstName.split(/\s+/).map((s) => s[0] ?? "").slice(0, 2).join("").toUpperCase() || "S";

  return (
    <div className="proto-root">
      <header className="proto-topbar">
        <Link href="/prototype" className="proto-topbar__brand" style={{ textDecoration: "none", color: "inherit" }}>
          <span style={{ display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 10, background: "var(--pf-accent)", color: "#fff", fontWeight: 800 }}>
            S
          </span>
          <span style={{ fontSize: "1.1rem" }}>SCHOOL</span>
        </Link>
        <div className="proto-topbar__spacer" />
        <span style={{ fontFamily: "var(--pf-header)", fontStyle: "italic", color: "var(--pf-ink-2)", fontSize: "0.95rem" }}>
          {firstName}&rsquo;s day
        </span>
        <span className="proto-topbar__avatar" aria-hidden="true">{initials}</span>
      </header>

      <nav className="proto-journey" aria-label="Journey">
        {JOURNEY_SECTIONS.map((section) => (
          <Link key={section.id} className="proto-navpad" href={section.href} data-active={section.match(pathname)}>
            <span aria-hidden="true">{section.glyph}</span>
            <span>{section.label}</span>
          </Link>
        ))}
      </nav>

      {children}

      <footer className="proto-footer">
        <span>Concept &mdash; "Focus &amp; Flow". Prototype only, not the live product.</span>
        <span>{studyPath}</span>
      </footer>
    </div>
  );
}