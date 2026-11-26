"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "@/components/SessionProvider";

// Economic tiers (see apps/api/src/services/pricing.ts):
//  free    — R0 core access (lessons + past papers, no AI/personalisation)
//  scholar — R29/mo full access + AI tutor
//  family  — R59/mo up to 4 learners
//  school  — R199/mo class management + teacher dashboard
//  bursary — R0 sponsored full access
type Tier = "free" | "scholar" | "family" | "school" | "bursary";

type FeatureGateProps = {
  tier: Tier;
  title: string;
  description: string;
  children: ReactNode;
  fallback?: ReactNode;
};

const PAID_TIERS: Tier[] = ["scholar", "family", "school", "bursary"];

export function FeatureGate({ tier, title, description, children, fallback }: FeatureGateProps) {
  const { authState } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnPath = useMemo(() => {
    const query = searchParams?.toString();
    if (!pathname) return "/study";
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  const userTier = (authState.planTier || "free") as Tier;

  // Free content is never gated.
  if (tier === "free") return <>{children}</>;

  const hasAccess = PAID_TIERS.includes(userTier);
  if (hasAccess) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  return (
    <div className="glass card" style={{ display: "grid", gap: "12px", padding: "18px" }}>
      <div>
        <strong>{title}</strong>
        <p style={{ margin: "6px 0 0", color: "var(--text-3)", lineHeight: 1.5 }}>{description}</p>
      </div>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <Link
          className="button"
          href={authState.isGuest ? `/auth?next=${encodeURIComponent(returnPath)}` : "/settings?plan=scholar"}
        >
          {authState.isGuest ? "Create your account" : "Upgrade — from R29/mo"}
        </Link>
      </div>
    </div>
  );
}
