import { db } from "@/lib/pastPapers/db";

export async function ensurePastPaperQuestions(pastPaperId: string) {
  const existing = await db.findMany("PastPaperQuestion", {
    where: { pastPaperId },
    orderBy: { orderIndex: "asc" },
  });
  if (existing.length > 0) return existing;

  const placeholders = Array.from({ length: 20 }, (_, idx) => ({
    pastPaperId,
    qNumber: "Q" + String(idx + 1),
    label: "Question " + String(idx + 1),
    maxMarks: 5,
    orderIndex: idx + 1,
  }));

  await db.createMany("PastPaperQuestion", placeholders);
  return db.findMany("PastPaperQuestion", {
    where: { pastPaperId },
    orderBy: { orderIndex: "asc" },
  });
}
