"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { NavIcon } from "@/components/nav/NavIcon";
import { phoneBarLinks, studyLinks } from "@/lib/navigation/sidebarModel";
import { useUiStore } from "@/store/uiStore";

export function MobileBottomNav() {
  const pathname = usePathname() ?? "/";
  const t = useTranslations("nav");
  const setNavOpen = useUiStore((state) => state.setNavOpen);
  const tutor = studyLinks.find((item) => item.id === "tutor");
  const tutorActive = tutor?.match(pathname) ?? false;

  return (
    <nav className="mobile-bottom-nav" aria-label="Primary">
      {phoneBarLinks.slice(0, 2).map((item) => {
        const active = item.match(pathname);
        return (
          <Link key={item.id} href={item.href} className="mobile-bottom-nav__item" aria-current={active ? "page" : undefined} aria-label={t(item.labelKey)}>
            <span className="mobile-bottom-nav__icon" aria-hidden="true"><NavIcon name={item.icon} /></span>
            <span className="mobile-bottom-nav__label">{t(item.labelKey)}</span>
          </Link>
        );
      })}
      {tutor ? (
        <Link href={tutor.href} className="mobile-bottom-nav__center" data-active={tutorActive ? "true" : undefined} aria-current={tutorActive ? "page" : undefined} aria-label={t(tutor.labelKey)}>
          <span className="mobile-bottom-nav__center-icon" aria-hidden="true"><NavIcon name="spark" /></span>
          <span className="mobile-bottom-nav__label">{t("tutorShort")}</span>
        </Link>
      ) : null}
      {phoneBarLinks.slice(2).map((item) => {
        const active = item.match(pathname);
        return (
          <Link key={item.id} href={item.href} className="mobile-bottom-nav__item" aria-current={active ? "page" : undefined} aria-label={t(item.labelKey)}>
            <span className="mobile-bottom-nav__icon" aria-hidden="true"><NavIcon name={item.icon} /></span>
            <span className="mobile-bottom-nav__label">{t(item.labelKey)}</span>
          </Link>
        );
      })}
      <button
        type="button"
        className="mobile-bottom-nav__item"
        aria-label={t("more")}
        onClick={() => setNavOpen(true)}
      >
        <span className="mobile-bottom-nav__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 7h14M5 12h14M5 17h14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </span>
        <span className="mobile-bottom-nav__label">{t("more")}</span>
      </button>
    </nav>
  );
}
