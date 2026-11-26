import { describe, test, expect } from "vitest";
import { getPasswordStrength } from "../utils/passwordStrength.js";

describe("getPasswordStrength", () => {
  test("returns empty result for empty password", () => {
    const result = getPasswordStrength("");
    expect(result.score).toBe(-1);
    expect(result.label).toBe("");
  });

  test("returns score 0 (Weak) for trivial password", () => {
    const result = getPasswordStrength("password");
    expect(result.score).toBe(0);
    expect(result.label).toBe("Weak");
  });

  test("returns score 3 (Strong) for long passphrase", () => {
    const result = getPasswordStrength("correct-horse-battery-staple-1842!");
    expect(result.score).toBe(3);
    expect(result.label).toBe("Strong");
  });

  test("returns a valid hex colour for every non-empty password", () => {
    const passwords = ["password", "P@ssw0rd", "P@ssw0rd!X9", "correct-horse-battery-staple-99!"];
    for (const pw of passwords) {
      const { color } = getPasswordStrength(pw);
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
