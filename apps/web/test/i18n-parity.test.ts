import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LOCALES } from "@/lib/locale";

const DIR = join(__dirname, "..", "messages");

function leafKeys(obj: Record<string, Record<string, string>>): Set<string> {
  const keys = new Set<string>();
  for (const [ns, entries] of Object.entries(obj)) {
    for (const key of Object.keys(entries)) keys.add(`${ns}.${key}`);
  }
  return keys;
}

const english = leafKeys(JSON.parse(readFileSync(join(DIR, "en.json"), "utf8")));

describe("i18n message parity", () => {
  for (const locale of LOCALES) {
    it(`${locale}.json contains no keys absent from en.json`, () => {
      const target = leafKeys(JSON.parse(readFileSync(join(DIR, `${locale}.json`), "utf8")));
      const stray = [...target].filter((k) => !english.has(k));
      expect(stray).toEqual([]);
    });
  }
});
