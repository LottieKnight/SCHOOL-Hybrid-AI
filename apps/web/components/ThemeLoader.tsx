"use client";

import { useEffect } from "react";
import { loadSavedTheme } from "@/lib/theme";

export function ThemeLoader() {
  useEffect(() => {
    loadSavedTheme();
  }, []);

  return null;
}