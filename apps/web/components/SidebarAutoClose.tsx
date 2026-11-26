"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function closeSidebar() {
  const toggle = document.getElementById("sidebar-toggle") as HTMLInputElement | null;
  if (toggle) {
    toggle.checked = false;
  }
}

export function SidebarAutoClose() {
  const pathname = usePathname();

  useEffect(() => {
    // Route changes should always leave the nav drawer closed.
    closeSidebar();
  }, [pathname]);

  useEffect(() => {
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar) return;

    const handleClick: EventListener = (event) => {
      if (!(event instanceof MouseEvent)) return;
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element)) return;

      const link = event.target.closest("a[href]");
      if (link && sidebar.contains(link)) {
        const anchor = link as HTMLAnchorElement;
        if (anchor.target && anchor.target !== "_self") return;
        if (anchor.hasAttribute("download")) return;
        closeSidebar();
        return;
      }

      const button = event.target.closest("button.sidebar-item");
      if (button && sidebar.contains(button)) {
        closeSidebar();
      }
    };

    sidebar.addEventListener("click", handleClick);
    return () => {
      sidebar.removeEventListener("click", handleClick);
    };
  }, []);

  return null;
}
