import path from "node:path";
import { describe, expect, it } from "vitest";
import { confineStoragePath } from "@/lib/storage/confineStoragePath";
import { resolveXpAward } from "@/lib/xpAward";
import { safeReturnUrl } from "@/lib/safeReturnUrl";

describe("login next path", () => {
  it("keeps an in-app path and drops a protocol-relative one", () => {
    expect(safeReturnUrl("/past-papers?grade=12", "/dashboard")).toBe("/past-papers?grade=12");
    expect(safeReturnUrl("//evil.example", "/dashboard")).toBe("/dashboard");
  });
});

describe("xp awards", () => {
  it("caps a pomodoro and rejects a made-up action", () => {
    expect(resolveXpAward("POMODORO_COMPLETE", 25)).toEqual({
      ok: true,
      actionType: "POMODORO_COMPLETE",
      amount: 25,
    });
    expect(resolveXpAward("POMODORO_COMPLETE", 9000).ok && resolveXpAward("POMODORO_COMPLETE", 9000)).toMatchObject({
      amount: 25,
    });
    expect(resolveXpAward("ADMIN_GRANT", 1000).ok).toBe(false);
  });
});

describe("local file keys", () => {
  const root = path.join("/data", "past-papers");

  it("keeps a normal paper key and rejects a parent walk", () => {
    expect(confineStoragePath(root, "grade-12/maths.pdf")).toBe(path.join(root, "grade-12", "maths.pdf"));
    expect(confineStoragePath(root, "../secrets.env")).toBeNull();
    expect(confineStoragePath(root, "grade-12/../../etc/passwd")).toBeNull();
  });
});
