import { describe, expect, it } from "vitest";
import { decideAdminPageAccess } from "@/lib/adminPageAccess";

const admin = { user: { id: "a", email: "owner@school.test", role: "admin" } };
const student = { user: { id: "s", email: "learner@school.test", role: "student" } };

describe("admin page access", () => {
  it("allows an admin session on production", () => {
    expect(
      decideAdminPageAccess({
        session: admin,
        pathname: "/admin/growth",
        host: "school.example",
        nodeEnv: "production",
      }).allow,
    ).toBe(true);
  });

  it("hides growth metrics from a signed-out visitor", () => {
    const decision = decideAdminPageAccess({
      session: null,
      pathname: "/admin/growth",
      host: "school.example",
      nodeEnv: "production",
    });
    expect(decision.allow).toBe(false);
    if (!decision.allow) expect(decision.reason).toBe("unauthenticated");
  });

  it("hides admin pages from a signed-in student", () => {
    const decision = decideAdminPageAccess({
      session: student,
      pathname: "/admin/users",
      host: "school.example",
      nodeEnv: "production",
    });
    expect(decision.allow).toBe(false);
    if (!decision.allow) expect(decision.reason).toBe("not-admin");
  });

  it("keeps the local setup checklist available in development", () => {
    expect(
      decideAdminPageAccess({
        session: null,
        pathname: "/admin/setup",
        host: "localhost:3000",
        nodeEnv: "development",
      }).allow,
    ).toBe(true);
  });

  it("does not expose the setup checklist on a public host", () => {
    expect(
      decideAdminPageAccess({
        session: null,
        pathname: "/admin/setup",
        host: "school.example",
        nodeEnv: "development",
      }).allow,
    ).toBe(false);
  });
});
