"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { learnHrefForProfile, pastPapersGradeParam, roleLabel, formatGradeLabel } from "@/lib/minimalProfile";
import { useMinimalProfile } from "./useMinimalProfile";
import styles from "./minimalProfile.module.css";

export function ProfilePathHint({ surface }: { surface: "learn" | "past-papers" }) {
  const pathname = usePathname() || "/";
  const params = useSearchParams();
  const router = useRouter();
  const { profile, ready } = useMinimalProfile();
  const applied = useRef(false);

  useEffect(() => {
    if (!ready || surface !== "past-papers" || applied.current) return;
    if (params.get("grade")) return;
    const grade = pastPapersGradeParam(profile);
    if (!grade) return;
    applied.current = true;
    const next = new URLSearchParams(params.toString());
    next.set("grade", grade);
    router.replace(`/past-papers?${next.toString()}`);
  }, [params, profile, ready, router, surface]);

  if (!ready || !profile || profile.skipped && !profile.grade) return null;

  if (surface === "learn" && pathname === "/learn") {
    const href = learnHrefForProfile(profile);
    if (href === "/learn") return null;
    const label = profile.role === "university" || profile.grade === "university"
      ? "Open the university path"
      : `Continue in ${formatGradeLabel(profile.grade) || roleLabel(profile.role)}`;
    return (
      <div className={styles.banner} data-testid="learn-profile-hint">
        <p className={styles.hint}>{profile.displayName ? `${profile.displayName}, your path is ready.` : "Your path is ready."}</p>
        <Link className="button" href={href}>
          {label}
        </Link>
      </div>
    );
  }

  return null;
}
