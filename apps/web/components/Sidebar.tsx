"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { NavIcon } from "@/components/nav/NavIcon";
import { ProfileSidebarItem } from "@/components/ProfileSidebarItem";
import { SidebarLogoutButton } from "@/components/SidebarLogoutButton";
import { useSession } from "@/components/SessionProvider";
import { moreLinks, practiceLinks, studyLinks, type SidebarLink } from "@/lib/navigation/sidebarModel";
import { useUiStore } from "../store/uiStore";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  entered?: boolean;
};

function cleanName(user: Record<string, unknown> | undefined) {
  if (!user) return "Guest";
  const first = typeof user.firstName === "string" ? user.firstName.trim() : "";
  const last = typeof user.lastName === "string" ? user.lastName.trim() : "";
  const full = `${first} ${last}`.trim();
  if (full) return full;
  const email = typeof user.email === "string" ? user.email.trim() : "";
  return email || "Guest";
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "SC";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function NavRow({
  item,
  label,
  active,
  collapsed,
  onClose,
}: {
  item: SidebarLink;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClose: () => void;
}) {
  return (
    <Link
      href={item.href}
      className={active ? "nav-link is-active" : item.id === "tutor" ? "nav-link nav-link-tutor" : "nav-link"}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      title={collapsed ? label : undefined}
      prefetch={false}
      onClick={onClose}
    >
      <NavIcon name={item.icon} />
      <span className="nav-link-label">{label}</span>
    </Link>
  );
}

export function Sidebar({ open, onClose, entered = false }: SidebarProps) {
  const pathname = usePathname() || "/";
  const t = useTranslations("nav");
  const { session } = useSession();
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleCollapsed = useUiStore((state) => state.toggleSidebarCollapsed);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const name = cleanName(session?.user as Record<string, unknown> | undefined);
  const moreOpen = moreLinks.some((item) => item.match(pathname));

  return (
    <aside
      className={`shell-sidebar nav-shell${entered ? " sidebar-entered" : ""}`}
      data-open={open ? "true" : "false"}
      data-collapsed={collapsed ? "true" : "false"}
      onTouchStart={(event) => setTouchStart(event.targetTouches[0]?.clientX ?? null)}
      onTouchEnd={(event) => {
        if (touchStart == null || !open) return;
        const end = event.changedTouches[0]?.clientX ?? touchStart;
        if (touchStart - end > 48) onClose();
      }}
    >
      <div className="nav-scroll">
        <header className="nav-brand">
          <Link href="/dashboard" className="nav-brand-link" onClick={onClose} aria-label="SCHOOL home">
            <img className="nav-mark" src="/images/school-mark.png" alt="" width={88} height={80} />
            <span className="nav-word">SCHOOL</span>
          </Link>
          <button
            type="button"
            className="nav-icon-btn nav-collapse"
            onClick={toggleCollapsed}
            aria-label={collapsed ? t("expand") : t("collapse")}
            title={collapsed ? t("expand") : t("collapse")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" className="nav-icon-btn nav-close" onClick={onClose} aria-label={t("closeMenu")}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <nav className="nav-groups" aria-label="Primary">
          <section className="nav-group">
            <p className="nav-kicker">{t("study")}</p>
            {studyLinks.map((item) => (
              <NavRow key={item.id} item={item} label={t(item.labelKey)} active={item.match(pathname)} collapsed={collapsed} onClose={onClose} />
            ))}
          </section>
          <section className="nav-group">
            <p className="nav-kicker">{t("practice")}</p>
            {practiceLinks.map((item) => (
              <NavRow key={item.id} item={item} label={t(item.labelKey)} active={item.match(pathname)} collapsed={collapsed} onClose={onClose} />
            ))}
          </section>
          <details className="nav-more" open={moreOpen || undefined}>
            <summary>{t("more")}</summary>
            <div className="nav-more-list">
              {moreLinks.map((item) => (
                <NavRow key={item.id} item={item} label={t(item.labelKey)} active={item.match(pathname)} collapsed={collapsed} onClose={onClose} />
              ))}
            </div>
          </details>
        </nav>
      </div>

      <footer className="nav-foot">
        <div className="nav-user" title={name}>
          <span className="nav-avatar" aria-hidden="true">{initials(name)}</span>
          <span className="nav-user-copy">
            <strong>{name}</strong>
            <span>SCHOOL</span>
          </span>
        </div>
        <ProfileSidebarItem />
        <div className="sidebar-logout-wrap">
          <SidebarLogoutButton />
        </div>
      </footer>
    </aside>
  );
}
