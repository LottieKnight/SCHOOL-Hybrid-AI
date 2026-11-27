import { describe, expect, it } from "vitest";
import { decideAdminPageAccess } from "@/lib/adminPageAccess";
import { isOpenFirstPath, routeRequiresSignIn } from "@/lib/openFirstAccess";
import { safeReturnUrl } from "@/lib/safeReturnUrl";

const OPEN_ROUTES = ["/learn", "/learn/fet/grade-10", "/past-papers", "/past-papers?grade=11", "/tutor", "/dashboard", "/settings"];

describe("open-first route access", () => {
  it("lets study routes open with no sign-in", () => {
    for (const path of OPEN_ROUTES) {
      expect(isOpenFirstPath(path)).toBe(true);
      expect(routeRequiresSignIn(path)).toBe(false);
    }
  });

  it("keeps /admin strictly gated for a signed-out visitor and a student", () => {
    expect(routeRequiresSignIn("/admin")).toBe(true);
    expect(routeRequiresSignIn("/admin/users")).toBe(true);
    expect(isOpenFirstPath("/admin")).toBe(false);

    const guest = decideAdminPageAccess({
      session: null,
      pathname: "/admin/users",
      host: "school.ditshego-ventures.co.za",
      nodeEnv: "production",
    });
    expect(guest.allow).toBe(false);
    if (!guest.allow) expect(guest.reason).toBe("unauthenticated");

    const student = decideAdminPageAccess({
      session: { user: { id: "s", email: "learner@school.test", role: "student" } },
      pathname: "/admin",
      host: "school.ditshego-ventures.co.za",
      nodeEnv: "production",
    });
    expect(student.allow).toBe(false);
    if (!student.allow) expect(student.reason).toBe("not-admin");
  });

  it("does not loosen the open-redirect check on next", () => {
    expect(safeReturnUrl("//evil.example")).not.toBe("//evil.example");
    expect(safeReturnUrl("https://evil.example/login")).not.toContain("evil.example");
    expect(safeReturnUrl("/dashboard")).toBe("/dashboard");
  });
});
