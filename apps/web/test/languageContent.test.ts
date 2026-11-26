import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { inferRelevantGeneratedModules } from "../lib/server/languageContent";

describe("language content grounding", () => {
  it("does not crash when generated module metadata is malformed", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "saedu-language-content-"));
    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempRoot);
    const tempGeneratedDir = path.join(tempRoot, "content", "modules-generated");
    const tempGeneratedFile = path.join(tempGeneratedDir, "bad-test-module.generated.json");

    fs.mkdirSync(tempGeneratedDir, { recursive: true });

    try {
      fs.writeFileSync(
        tempGeneratedFile,
        JSON.stringify({
          moduleCode: 123,
          moduleName: 456,
          keyTopics: ["trade relations", "inflation"],
          commonExamErrors: ["Confusing tariffs with quotas"],
        }),
        "utf8"
      );

      expect(() =>
        inferRelevantGeneratedModules({
          query: "Explain tariffs and quotas in trade.",
          preferredModuleCode: "BAD-TEST-MODULE",
          limit: 2,
        })
      ).not.toThrow();
    } finally {
      cwdSpy.mockRestore();
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
