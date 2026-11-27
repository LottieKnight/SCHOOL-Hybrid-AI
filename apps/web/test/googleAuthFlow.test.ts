import { describe, expect, it } from "vitest";
import { googleAuthMessage, runGoogleSignIn, shouldUseRedirect } from "@/lib/googleAuthFlow";

function error(code: string, credential?: unknown) {
  return Object.assign(new Error(code), { code, credential });
}

function flow(overrides: Partial<Parameters<typeof runGoogleSignIn>[0]> = {}) {
  const calls: string[] = [];
  const input = {
    isAnonymous: true,
    linkWithPopup: async () => {
      calls.push("link");
    },
    signInWithPopup: async () => {
      calls.push("popup");
    },
    signInWithRedirect: async () => {
      calls.push("redirect");
    },
    signInWithCredential: async () => {
      calls.push("credential");
    },
    ...overrides,
  };
  return { calls, input };
}

describe("Google auth linking", () => {
  it("links an anonymous user with a popup so the same Firebase uid keeps tutor history", async () => {
    const { calls, input } = flow();
    const result = await runGoogleSignIn(input);
    expect(result).toEqual({ ok: true, mode: "link-popup" });
    expect(calls).toEqual(["link"]);
  });

  it("tries a popup first on a phone and never forces redirect", async () => {
    expect(shouldUseRedirect({ mobileUserAgent: true, narrowViewport: true, coarsePointer: true })).toBe(false);
    expect(shouldUseRedirect({ mobileUserAgent: false, narrowViewport: true, coarsePointer: true })).toBe(false);
    expect(shouldUseRedirect({ mobileUserAgent: true, narrowViewport: false, coarsePointer: false })).toBe(false);

    const { calls, input } = flow();
    const result = await runGoogleSignIn(input);
    expect(result).toEqual({ ok: true, mode: "link-popup" });
    expect(calls).toEqual(["link"]);
    expect(calls).not.toContain("redirect");
  });

  it("signs into the existing Google account when linking reports credential-already-in-use", async () => {
    const { calls, input } = flow({
      linkWithPopup: async () => {
        calls.push("link");
        throw error("auth/credential-already-in-use", { providerId: "google.com" });
      },
    });
    const result = await runGoogleSignIn(input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.mode).toBe("sign-in-credential");
    expect(calls).toEqual(["link", "credential"]);
  });

  it("falls back to signInWithPopup when provider-already-linked has no credential", async () => {
    const { calls, input } = flow({
      linkWithPopup: async () => {
        calls.push("link");
        throw error("auth/provider-already-linked");
      },
    });
    const result = await runGoogleSignIn(input);
    expect(result).toEqual({ ok: true, mode: "sign-in-popup" });
    expect(calls).toEqual(["link", "popup"]);
  });

  it("uses the credential immediately when provider-already-linked includes one", async () => {
    const { calls, input } = flow({
      linkWithPopup: async () => {
        calls.push("link");
        throw error("auth/provider-already-linked", { providerId: "google.com" });
      },
    });
    const result = await runGoogleSignIn(input);
    expect(result).toEqual({ ok: true, mode: "sign-in-credential" });
    expect(calls).toEqual(["link", "credential"]);
  });

  it("falls back to a popup and then a redirect when the Google account exists but the popup is blocked", async () => {
    const { calls, input } = flow({
      linkWithPopup: async () => {
        calls.push("link");
        throw error("auth/credential-already-in-use");
      },
      signInWithPopup: async () => {
        calls.push("popup");
        throw error("auth/popup-blocked");
      },
    });
    const result = await runGoogleSignIn(input);
    expect(result).toEqual({ ok: true, mode: "sign-in-redirect" });
    expect(calls).toEqual(["link", "popup", "redirect"]);
  });

  it("redirects only when the browser refuses the popup", async () => {
    const calls: string[] = [];
    const result = await runGoogleSignIn({
      isAnonymous: false,
      linkWithPopup: async () => {
        calls.push("link");
      },
      signInWithPopup: async () => {
        calls.push("popup");
        throw error("auth/operation-not-supported-in-this-environment");
      },
      signInWithRedirect: async () => {
        calls.push("redirect");
      },
      signInWithCredential: async () => {
        calls.push("credential");
      },
    });
    expect(result).toEqual({ ok: true, mode: "sign-in-redirect" });
    expect(calls).toEqual(["popup", "redirect"]);
  });

  it("does not retry after redirect itself fails", async () => {
    const calls: string[] = [];
    const result = await runGoogleSignIn({
      isAnonymous: false,
      linkWithPopup: async () => {
        calls.push("link");
      },
      signInWithPopup: async () => {
        calls.push("popup");
        throw error("auth/popup-blocked");
      },
      signInWithRedirect: async () => {
        calls.push("redirect");
        throw error("auth/network-request-failed");
      },
      signInWithCredential: async () => {
        calls.push("credential");
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("auth/network-request-failed");
      expect(result.message).toBe(googleAuthMessage("auth/network-request-failed"));
    }
    expect(calls).toEqual(["popup", "redirect"]);
  });

  it("explains auth/operation-not-allowed without a retry loop", async () => {
    const result = await runGoogleSignIn({
      isAnonymous: false,
      linkWithPopup: async () => {
        throw error("auth/operation-not-allowed");
      },
      signInWithPopup: async () => {
        throw error("auth/operation-not-allowed");
      },
      signInWithRedirect: async () => {
        throw error("auth/operation-not-allowed");
      },
      signInWithCredential: async () => {
        throw error("auth/operation-not-allowed");
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("auth/operation-not-allowed");
      expect(result.message).toBe(googleAuthMessage("auth/operation-not-allowed"));
      expect(result.message).toMatch(/Firebase Console/);
      expect(result.message).toMatch(/school\.ditshego-ventures\.co\.za/);
    }
  });
});
