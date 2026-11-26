"use client";

import { create } from "zustand";

const SIDEBAR_STORAGE_KEY = "school_sidebar_collapsed";

type UiStore = {
  sidebarCollapsed: boolean;
  navOpen: boolean;
  hydrated: boolean;
  hydrateSidebarCollapsed: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setNavOpen: (open: boolean) => void;
};

function persistSidebarState(collapsed: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "true" : "false");
}

function readSidebarState() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
}

export const useUiStore = create<UiStore>((set, get) => ({
  sidebarCollapsed: false,
  navOpen: false,
  hydrated: false,
  hydrateSidebarCollapsed: () => {
    if (get().hydrated) return;
    set({
      sidebarCollapsed: readSidebarState(),
      hydrated: true,
    });
  },
  setSidebarCollapsed: (collapsed) => {
    persistSidebarState(collapsed);
    set({ sidebarCollapsed: collapsed, hydrated: true });
  },
  toggleSidebarCollapsed: () => {
    const next = !get().sidebarCollapsed;
    persistSidebarState(next);
    set({ sidebarCollapsed: next, hydrated: true });
  },
  setNavOpen: (open) => set({ navOpen: open }),
}));
