"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MinimalProfileForm } from "@/components/profile/MinimalProfileForm";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { learnHrefForProfile, type MinimalProfile } from "@/lib/minimalProfile";
import { safeReturnUrl } from "@/lib/safeReturnUrl";

export function MinimalOnboarding({ returnUrl }: { returnUrl: string | null }) {
  const router = useRouter();

  const finish = (profile: MinimalProfile) => {
    const destination = returnUrl || learnHrefForProfile(profile);
    router.push(safeReturnUrl(destination, "/learn"));
  };

  const skipHref = safeReturnUrl(returnUrl, "/learn");

  return (
    <main style={{ display: "grid", gap: "var(--space-4)", padding: "24px 16px 56px", maxWidth: "760px", margin: "0 auto" }} data-testid="minimal-onboarding">
      <section className="ui-card" style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", flexWrap: "wrap", padding: "var(--space-4)" }}>
        <SchoolLogo size={84} />
        <div style={{ display: "grid", gap: "0.45rem" }}>
          <span className="eyebrow">Profile</span>
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 4vw, 3.2rem)" }}>A name and a grade are enough.</h1>
          <p style={{ margin: 0, color: "var(--text-2)" }}>
            Skip anything. SCHOOL opens straight away, and this profile stays on the device until you sign in.
          </p>
        </div>
      </section>
      <section className="ui-card" style={{ padding: "var(--space-4)" }}>
        <MinimalProfileForm onDone={finish} />
        <p style={{ margin: "12px 0 0" }}>
          <Link href={skipHref}>Continue without an account</Link>
        </p>
      </section>
    </main>
  );
}
