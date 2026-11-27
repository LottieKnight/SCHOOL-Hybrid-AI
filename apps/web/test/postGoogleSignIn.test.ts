import { describe, expect, it } from "vitest";
import { destinationAfterGoogleSignIn, safeNextPath, shareInFlight, shouldAutoLeaveLogin } from "@/lib/postGoogleSignIn";
import { loginRedirectForMissingBackendCookie } from "@/lib/sessionGate";

describe("post Google sign-in redirect", () => {
  it("sends a learner with a grade to safeNext, defaulting to the dashboard", () => {
    expect(destinationAfterGoogleSignIn({
      requestedNext: "/learn",
      profile: { grade: "10", skipped: false },
    })).toBe("/learn");
    expect(destinationAfterGoogleSignIn({
      requestedNext: null,
      profile: { grade: "11", skipped: false },
    })).toBe("/dashboard");
  });

  it("sends a signed-in learner with no grade to onboarding", () => {
    expect(destinationAfterGoogleSignIn({
      requestedNext: "/dashboard",
      profile: { grade: "", skipped: false },
    })).toBe("/onboarding?returnUrl=%2Fdashboard");
    expect(destinationAfterGoogleSignIn({
      requestedNext: null,
      profile: null,
    })).toBe("/onboarding?returnUrl=%2Fdashboard");
  });

  it("does not loop back to the entry screens", () => {
    for (const requestedNext of ["/login", "/signup", "/register", "/auth", "/login?next=/login"]) {
      const destination = destinationAfterGoogleSignIn({
        requestedNext,
        profile: { grade: "10", skipped: false },
      });
      expect(destination).toBe("/dashboard");
      expect(safeNextPath(requestedNext)).toBe("/dashboard");
    }

    expect(destinationAfterGoogleSignIn({
      requestedNext: "/login",
      profile: { grade: "", skipped: false },
    })).toBe("/onboarding?returnUrl=%2Fdashboard");
  });

  it("keeps a skipped profile on safeNext instead of forcing onboarding", () => {
    expect(destinationAfterGoogleSignIn({
      requestedNext: "/past-papers",
      profile: { grade: "", skipped: true },
    })).toBe("/past-papers");
  });

  it("shares one redirect read across a Strict Mode replay", async () => {
    let reads = 0;
    let slot: Promise<string> | null = null;
    const start = () => {
      reads += 1;
      return Promise.resolve("google-user");
    };
    slot = shareInFlight(slot, start);
    const replay = shareInFlight(slot, start);
    expect(reads).toBe(1);
    expect(await slot).toBe("google-user");
    expect(await replay).toBe("google-user");
  });

  it("keeps an already persisted Firebase session on the entry screen", () => {
    expect(shouldAutoLeaveLogin({ source: "auth-state", initialSnapshot: true, hasAccount: true })).toBe(false);
    expect(shouldAutoLeaveLogin({ source: "auth-state", initialSnapshot: false, hasAccount: true })).toBe(true);
    expect(shouldAutoLeaveLogin({ source: "redirect-result", initialSnapshot: true, hasAccount: true })).toBe(true);
    expect(shouldAutoLeaveLogin({ source: "redirect-result", initialSnapshot: false, hasAccount: false })).toBe(false);
  });

  it("does not bounce a Firebase user for a missing legacy backend cookie", () => {
    expect(loginRedirectForMissingBackendCookie({
      pathname: "/dashboard",
      hasBackendSessionCookie: false,
      firebaseUserSignedIn: true,
      enforceLegacyCookie: true,
    })).toBeNull();
    expect(loginRedirectForMissingBackendCookie({
      pathname: "/onboarding",
      hasBackendSessionCookie: false,
      firebaseUserSignedIn: false,
      enforceLegacyCookie: true,
    })).toBeNull();
    expect(loginRedirectForMissingBackendCookie({
      pathname: "/planner",
      hasBackendSessionCookie: false,
      firebaseUserSignedIn: true,
      enforceLegacyCookie: true,
    })).toBeNull();
    expect(loginRedirectForMissingBackendCookie({
      pathname: "/dashboard",
      hasBackendSessionCookie: false,
      enforceLegacyCookie: false,
    })).toBeNull();
  });
});
