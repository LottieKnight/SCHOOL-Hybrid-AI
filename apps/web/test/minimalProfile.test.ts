import { describe, expect, it } from "vitest";
import {
  applyGoogleIdentity,
  applyGoogleName,
  emptyMinimalProfile,
  learnHrefForProfile,
  mergeProfiles,
  pastPapersGradeParam,
  readMinimalProfile,
  skippedMinimalProfile,
  topbarIdentity,
  tutorDefaults,
  writeMinimalProfile,
  type MinimalProfile,
  type ProfileStorage,
} from "@/lib/minimalProfile";

class MemoryStorage implements ProfileStorage {
  private values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function profile(overrides: Partial<MinimalProfile> = {}): MinimalProfile {
  return { ...emptyMinimalProfile("2026-11-27T00:00:00.000Z"), ...overrides };
}

describe("minimal profile storage", () => {
  it("round-trips a small profile and drops unknown fields", () => {
    const storage = new MemoryStorage();
    const saved = writeMinimalProfile(storage, profile({
      displayName: "  Lerato  ",
      role: "learner",
      grade: "10",
      subjects: ["Mathematics", "Mathematics", "History"],
    }));
    expect(saved.displayName).toBe("Lerato");
    expect(saved.subjects).toEqual(["Mathematics", "History"]);
    expect(readMinimalProfile(storage)).toEqual(saved);
  });

  it("keeps a skipped profile empty so nothing is required", () => {
    const storage = new MemoryStorage();
    writeMinimalProfile(storage, skippedMinimalProfile("2026-11-27T00:00:00.000Z"));
    const stored = readMinimalProfile(storage);
    expect(stored?.skipped).toBe(true);
    expect(stored?.grade).toBe("");
    expect(pastPapersGradeParam(stored)).toBeNull();
    expect(learnHrefForProfile(stored)).toBe("/learn");
  });

  it("pre-filters learn, past papers, and the tutor from the saved grade", () => {
    const learner = profile({ role: "learner", grade: "11", subjects: ["Accounting"] });
    expect(learnHrefForProfile(learner)).toBe("/learn/fet/grade-11");
    expect(pastPapersGradeParam(learner)).toBe("11");
    expect(tutorDefaults(learner)).toEqual({ grade: "11", subject: "Accounting" });
    expect(learnHrefForProfile(profile({ grade: "R" }))).toBe("/learn/foundation/grade-00");
    expect(pastPapersGradeParam(profile({ grade: "7" }))).toBeNull();
  });

  it("sends university profiles to the university path", () => {
    const uni = profile({ role: "university", grade: "university", displayName: "Amahle" });
    expect(learnHrefForProfile(uni)).toBe("/university");
    expect(topbarIdentity({ profile: uni }).showAcademicPeriod).toBe(true);
    expect(topbarIdentity({ profile: uni }).greetingName).toBe("Amahle");
  });

  it("shows a name and grade instead of semester jargon for school users", () => {
    const identity = topbarIdentity({
      profile: profile({ displayName: "Lerato", role: "learner", grade: "10" }),
      sessionFirstName: "Scholar",
    });
    expect(identity.showAcademicPeriod).toBe(false);
    expect(identity.greetingName).toBe("Lerato");
    expect(identity.badge).toBe("Lerato · Grade 10");
    expect(identity.badge).not.toMatch(/Sem|Week|Scholar/);
  });

  it("uses a neutral label when the profile is still empty", () => {
    const identity = topbarIdentity({ profile: null, sessionFirstName: null });
    expect(identity.greetingName).toBeNull();
    expect(identity.badge).toBe("Learner");
    expect(identity.showAcademicPeriod).toBe(false);
  });

  it("lets the newer profile win and only fills an empty name from Google", () => {
    const local = profile({ displayName: "Lerato", updatedAt: "2026-11-27T02:00:00.000Z", grade: "10" });
    const remote = profile({ displayName: "Remote", updatedAt: "2026-11-27T01:00:00.000Z", grade: "12" });
    expect(mergeProfiles(local, remote)?.grade).toBe("10");
    expect(mergeProfiles(remote, local)?.displayName).toBe("Lerato");
    expect(applyGoogleName(local, "Google Name").displayName).toBe("Lerato");
    expect(applyGoogleName(profile({ displayName: "" }), "Google Name").displayName).toBe("Google Name");
  });

  it("stores the Google name, email, and photo without dropping a saved grade", () => {
    const saved = applyGoogleIdentity(
      profile({ displayName: "Lerato", grade: "10" }),
      {
        displayName: "Google Name",
        email: "lerato@school.test",
        photoURL: "https://lh3.googleusercontent.com/a/learner",
      },
      "2026-11-27T03:00:00.000Z",
    );
    expect(saved.displayName).toBe("Lerato");
    expect(saved.email).toBe("lerato@school.test");
    expect(saved.photoURL).toBe("https://lh3.googleusercontent.com/a/learner");
    expect(saved.grade).toBe("10");
    expect(applyGoogleIdentity(profile({ displayName: "" }), { photoURL: "javascript:alert(1)" }).photoURL).toBe("");
  });

  it("ignores corrupt storage", () => {
    const storage = new MemoryStorage();
    storage.setItem("school.minimalProfile.v1", "{");
    expect(readMinimalProfile(storage)).toBeNull();
  });
});
