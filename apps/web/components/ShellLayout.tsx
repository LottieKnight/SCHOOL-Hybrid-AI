"use client";

import { Suspense, useEffect } from "react";
import { usePathname } from "next/navigation";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { SiteFooter } from "@/components/ui/SiteFooter";
import { CelebrationOverlay } from "@/components/CelebrationOverlay";
import { NpsSurveyModal } from "@/components/NpsSurveyModal";
import { WellnessTimers } from "@/components/WellnessTimers";
import { PostOnboardingReferralBanner } from "@/components/PostOnboardingReferralBanner";
import { OfflineUnlockQueueFlusher } from "@/components/OfflineUnlockQueueFlusher";
import { IdleWarningBanner } from "@/components/IdleWarningBanner";
import { CommandPalette } from "@/components/CommandPalette";
import { useRouteScrollMemory } from "@/lib/navigation/useRouteScrollMemory";
import { OpenedLessonMemory } from "@/components/tutor/OpenedLessonMemory";
import { useKeyboardInset } from "@/components/tutor/useKeyboardInset";
import { useUiStore } from "../store/uiStore";
import { useSplashStore } from "../store/splashStore";

export function ShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const sidebarOpen = useUiStore((state) => state.navOpen);
  const setSidebarOpen = useUiStore((state) => state.setNavOpen);
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const hydrateSidebarCollapsed = useUiStore((state) => state.hydrateSidebarCollapsed);
  const splashDismissed = useSplashStore((state) => state.dismissed);
  const shouldUseShell =
    pathname !== "/" &&
    !pathname.startsWith("/onboarding") &&
    !pathname.startsWith("/features") &&
    !pathname.startsWith("/prototype");

  useRouteScrollMemory(pathname, shouldUseShell);
  useKeyboardInset();

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  useEffect(() => {
    hydrateSidebarCollapsed();
  }, [hydrateSidebarCollapsed]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    document.documentElement.classList.toggle("has-shell", shouldUseShell);
    document.documentElement.classList.toggle("sidebar-collapsed", sidebarCollapsed && shouldUseShell);
    document.body.classList.toggle("has-shell", shouldUseShell);
    document.body.classList.toggle("menu-open", sidebarOpen);
    document.body.classList.toggle("sidebar-collapsed", sidebarCollapsed && shouldUseShell);
    
    return () => {
      document.documentElement.classList.remove("has-shell");
      document.documentElement.classList.remove("sidebar-collapsed");
      document.body.classList.remove("has-shell");
      document.body.classList.remove("menu-open");
      document.body.classList.remove("sidebar-collapsed");
    };
  }, [sidebarCollapsed, sidebarOpen, shouldUseShell]);

  if (!shouldUseShell) {
    return <main className="public-main">{children}</main>;
  }

  return (
    <div className="shell-root" data-entered={splashDismissed ? "true" : "false"}>
      <div className="shell-ambient" aria-hidden="true">
        <span className="shell-ambient__orb shell-ambient__orb--1" />
        <span className="shell-ambient__orb shell-ambient__orb--2" />
        <span className="shell-ambient__orb shell-ambient__orb--3" />
      </div>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} entered={splashDismissed} />
      {sidebarOpen ? (
        <button
          className="shell-backdrop"
          type="button"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <div className="shell-content">
        <Topbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <Suspense>
          <PostOnboardingReferralBanner />
        </Suspense>
        <main className="shell-main">{children}</main>
        <SiteFooter />
      </div>
      <OpenedLessonMemory />
      <MobileBottomNav />
      <CelebrationOverlay />
      <NpsSurveyModal />
      <WellnessTimers />
      <OfflineUnlockQueueFlusher />
      <IdleWarningBanner />
      <CommandPalette />
    </div>
  );
}
