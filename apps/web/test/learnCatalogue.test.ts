import { describe, expect, it } from "vitest";
import { buildLearnCatalogue, filterCatalogue, nextCatalogueEntry, parseGradeSlug, termPlansFromTerms } from "../lib/lessons/catalogue";
import { buildCapsCatalogue, lookupCatalogueLesson } from "../lib/lessons/catalogueServer";

const catalogue = buildLearnCatalogue({
  phases: [
    {
      key: "foundation",
      grades: [
        {
          grade: 1,
          slug: "grade-01",
          subjects: [
            {
              key: "english-home-language",
              name: "English Home Language",
              terms: [
                {
                  term: 1,
                  weeks: [
                    { week: 1, topic: "Listening and speaking (T1 W1)" },
                    { week: 2, topic: "Phonics and word building (T1 W2)" },
                  ],
                },
                {
                  term: 2,
                  weeks: [{ week: 1, topic: "Shared reading and prediction (T2 W1)" }],
                },
              ],
            },
            {
              key: "mathematics",
              name: "Mathematics",
              terms: [{ term: 1, weeks: [{ week: 1, topic: "Counting" }] }],
            },
          ],
        },
      ],
    },
    {
      key: "fet",
      grades: [
        {
          grade: 12,
          slug: "grade-12",
          subjects: [
            {
              key: "accounting",
              name: "Accounting",
              terms: [{ term: 3, weeks: [{ week: 1, topic: "Cash budgets" }] }],
            },
          ],
        },
      ],
    },
  ],
});

describe("learn catalogue", () => {
  it("filters by phase, grade, subject, term, and topic", () => {
    expect(filterCatalogue(catalogue, { phase: "foundation", grade: 1 })).toHaveLength(4);
    expect(filterCatalogue(catalogue, { subject: "english", term: 1 }).map((entry) => entry.topic)).toEqual([
      "Listening and speaking (T1 W1)",
      "Phonics and word building (T1 W2)",
    ]);
    expect(filterCatalogue(catalogue, { topic: "phonics" })).toHaveLength(1);
    expect(filterCatalogue(catalogue, { curriculum: "IEB" })).toHaveLength(0);
    expect(filterCatalogue(catalogue, { curriculum: "CAPS", grade: 12 })[0]?.subjectName).toBe("Accounting");
  });

  it("returns the next lesson in catalogue order and parses grade slugs", () => {
    const first = catalogue[0]!;
    expect(nextCatalogueEntry(catalogue, first.id)?.topic).toBe("Phonics and word building (T1 W2)");
    expect(nextCatalogueEntry(catalogue, "missing")).toBeNull();
    expect(parseGradeSlug("grade-01")).toBe(1);
    expect(parseGradeSlug("grade-00")).toBe(0);
    expect(parseGradeSlug("R")).toBe(0);
    expect(parseGradeSlug("grade-12")).toBe(12);
  });

  it("derives term plans from scaffold term maps", () => {
    expect(
      termPlansFromTerms({
        term1: { weeks: [{}, {}] },
        term3: { weeks: [{}] },
      })
    ).toEqual([
      { term: 1, weeks: 2 },
      { term: 3, weeks: 1 },
    ]);
    expect(termPlansFromTerms(undefined)).toEqual([
      { term: 1, weeks: 10 },
      { term: 2, weeks: 10 },
      { term: 3, weeks: 10 },
      { term: 4, weeks: 10 },
    ]);
  });

  it("finds a real foundation lesson in the CAPS outline", () => {
    const match = lookupCatalogueLesson({
      phase: "foundation",
      grade: "grade-01",
      subject: "english-home-language",
      term: 1,
      week: 1,
    });
    expect(match?.topic).toBe("Listening and speaking (T1 W1)");
    expect(match?.href).toBe("/learn/foundation/grade-01/english-home-language/term/1/week/1");
    const all = buildCapsCatalogue();
    expect(all.some((entry) => entry.id === match?.id)).toBe(true);
    expect(filterCatalogue(all, { phase: "fet", grade: 10, subject: "english" }).length).toBeGreaterThan(0);
  });
});
