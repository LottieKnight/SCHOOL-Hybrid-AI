import { describe, expect, it } from "vitest";
import { FIREBASE_AI_CSP_HOSTS, FIREBASE_GOOGLE_CSP_HOSTS, buildContentSecurityPolicy } from "@/lib/contentSecurityPolicy";

describe("content security policy", () => {
  it("allows Firebase Google sign-in hosts in production", () => {
    const policy = buildContentSecurityPolicy("abc123", false);
    for (const host of FIREBASE_GOOGLE_CSP_HOSTS) {
      expect(policy).toContain(host);
    }
    expect(policy).toContain("form-action 'self' https://accounts.google.com");
    expect(policy).toContain("frame-src 'self'");
    expect(policy).toContain("'strict-dynamic'");
    expect(policy).not.toContain("'unsafe-eval'");
  });

  it("allows Firebase AI Logic and Installations for the secondary tutor project", () => {
    const policy = buildContentSecurityPolicy("abc123", false);
    const connect = policy.split("; ").find((directive) => directive.startsWith("connect-src "));
    expect(connect).toBeDefined();
    for (const host of FIREBASE_AI_CSP_HOSTS) {
      expect(connect).toContain(host);
    }
    expect(connect).toContain("https:");
    expect(connect).toContain("wss:");
  });
});
