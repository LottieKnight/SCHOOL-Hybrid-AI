import { db } from "@/lib/pastPapers/db";
import { memoryCached } from "@/lib/pastPapers/memoryCache";

export type HomepageMoment = {
  type: "community" | "academic" | "leaderboard" | "milestone";
  text: string;
  subtext?: string;
  staged: boolean;
};

const STAGED_BANK: HomepageMoment[] = [
  {
    type: "community",
    text: "Module rooms are active",
    subtext: "Questions answered by real classmates",
    staged: true,
  },
  {
    type: "leaderboard",
    text: "Top earner this week: 340 Scholar Credits",
    staged: true,
  },
  {
    type: "community",
    text: "BRAZIL text adventure is live",
    subtext: "Earn credits while you play",
    staged: true,
  },
  {
    type: "milestone",
    text: "Daily streaks are running",
    subtext: "Keep yours alive with today's quiz",
    staged: true,
  },
  {
    type: "academic",
    text: "Exam Dash is live",
    subtext: "Type faster than your classmates · earn credits",
    staged: true,
  },
];

async function fetchRealMoments(): Promise<HomepageMoment[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [attemptCount, newPaperCount, bookmarkCount] = await Promise.all([
    db.count("PastPaperAttempt", { startedAt: { gte: sevenDaysAgo } }),
    db.count("PastPaper", { createdAt: { gte: sevenDaysAgo } }),
    db.count("PastPaperBookmark", { createdAt: { gte: oneDayAgo } }),
  ]);

  const moments: HomepageMoment[] = [];

  if (attemptCount >= 5) {
    moments.push({
      type: "academic",
      text: `${attemptCount} timed attempt${attemptCount !== 1 ? "s" : ""} started this week`,
      subtext: "Past papers · track your progress",
      staged: false,
    });
  }

  if (newPaperCount >= 1) {
    moments.push({
      type: "academic",
      text: `${newPaperCount} past paper${newPaperCount !== 1 ? "s" : ""} added this week`,
      staged: false,
    });
  }

  if (bookmarkCount >= 1) {
    moments.push({
      type: "milestone",
      text: `${bookmarkCount} paper${bookmarkCount !== 1 ? "s" : ""} bookmarked today`,
      staged: false,
    });
  }

  return moments;
}

export async function assemblePresenceMoments(): Promise<HomepageMoment[]> {
  return memoryCached("homepage:presence", 5 * 60 * 1000, async () => {
    let real: HomepageMoment[] = [];
    try {
      real = await fetchRealMoments();
    } catch {
      // DB unavailable — fall through to staged bank
    }

    const fill = Math.max(0, 4 - real.length);
    return [...real, ...STAGED_BANK.slice(0, fill)];
  });
}
