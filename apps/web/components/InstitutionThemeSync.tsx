"use client";

import { useEffect } from "react";
import { useSession } from "@/components/SessionProvider";
import { applyInstitutionTheme, resetInstitutionTheme } from "@/lib/institutionTheme";

type InstitutionThemeResponse = {
  institution?: {
    id?: string;
    name?: string | null;
    shortName?: string | null;
    domain?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
  } | null;
  theme?: {
    slug?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
  } | null;
};

export function InstitutionThemeSync() {
  const { session } = useSession();

  useEffect(() => {
    let active = true;

    if (!session) {
      resetInstitutionTheme();
      return () => {
        active = false;
      };
    }

    const run = async () => {
      try {
        const response = await fetch("/api/institutions/current", {
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          if (active) resetInstitutionTheme();
          return;
        }

        const data = (await response.json().catch(() => null)) as InstitutionThemeResponse | null;
        const institution = data?.institution;
        const theme = data?.theme;

        if (!active) return;

        if (!institution && !theme?.slug) {
          resetInstitutionTheme();
          return;
        }

        applyInstitutionTheme({
          slug: theme?.slug ?? institution?.shortName ?? institution?.name ?? "default",
          shortName: institution?.shortName ?? null,
          name: institution?.name ?? null,
          domain: institution?.domain ?? null,
          email: session.user?.email ?? null,
          primaryColor: theme?.primaryColor ?? institution?.primaryColor ?? null,
          secondaryColor: theme?.secondaryColor ?? institution?.secondaryColor ?? null,
        });
      } catch {
        if (active) resetInstitutionTheme();
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [session]);

  return null;
}
