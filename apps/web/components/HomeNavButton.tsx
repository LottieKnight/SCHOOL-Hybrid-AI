"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";

export function HomeNavButton() {
  const router = useRouter();
  const pathname = usePathname();

  const scrollToTop = useCallback(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }, []);

  const handleClick = useCallback(() => {
    const toggle = document.getElementById("sidebar-toggle") as HTMLInputElement | null;
    if (toggle) {
      toggle.checked = false;
    }

    // Avoid router.refresh() here; if upstream API/proxy is slow it can freeze UX.
    // Always do simple client navigation to home.
    if (pathname !== "/") {
      scrollToTop();
      router.push("/", { scroll: true });
      return;
    }

    if (typeof window !== "undefined") {
      scrollToTop();
      window.location.href = "/";
    }
  }, [pathname, router, scrollToTop]);

  return (
    <button className="nav-brand nav-brand-button" type="button" onClick={handleClick}>
      SCHOOL
    </button>
  );
}
