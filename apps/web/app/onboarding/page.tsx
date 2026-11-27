import { redirect } from "next/navigation";
import { MinimalOnboarding } from "@/components/profile/MinimalOnboarding";
import { safeReturnUrl } from "@/lib/safeReturnUrl";
import { loginRedirectForMissingBackendCookie } from "@/lib/sessionGate";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const legacyBounce = loginRedirectForMissingBackendCookie({
    pathname: "/onboarding",
    hasBackendSessionCookie: false,
    firebaseUserSignedIn: false,
    enforceLegacyCookie: true,
  });
  if (legacyBounce) redirect(legacyBounce);
  const rawReturnUrl = typeof params.returnUrl === "string" ? params.returnUrl : null;
  const returnUrl = rawReturnUrl ? safeReturnUrl(rawReturnUrl, "/learn") : null;
  return <MinimalOnboarding returnUrl={returnUrl} />;
}
