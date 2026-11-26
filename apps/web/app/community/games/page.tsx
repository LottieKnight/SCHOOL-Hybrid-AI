"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { isResearchStudyEnabled } from "@/lib/features";
import styles from "./page.module.css";

type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
  metadata: { wpm?: number; accuracy?: number };
};

type LeaderboardPeriod = "daily" | "weekly" | "all";

type GameCategory = "All" | "Life Skills" | "Academic" | "Career" | "Relaxation";

const GAMES: {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  tag: string;
  tagVariant: "live" | "gold" | "default";
  emoji: string;
  genre: string;
  category: GameCategory;
  credits: number;
}[] = [
  {
    slug: "observational-silence",
    title: "Observational Silence",
    subtitle: "AURA Research Study",
    description:
      "Can focused attention make you miss something in plain sight? A 2-minute study from AURA Laboratory. Consent required; data used de-identified.",
    tag: "Research",
    tagVariant: "gold" as const,
    emoji: "◇",
    genre: "Research · Attention",
    category: "Academic",
    credits: 50,
  },
  {
    slug: "exam-dash",
    title: "Exam Dash",
    subtitle: "Speed Typing",
    description:
      "Type academic passages at light speed. Improve your WPM and climb the leaderboard with subject-aligned terms.",
    tag: "Competitive",
    tagVariant: "live" as const,
    emoji: "⌨",
    genre: "Skill · Competitive",
    category: "Academic",
    credits: 50,
  },
  {
    slug: "quiz-rush",
    title: "Quiz Rush",
    subtitle: "Lightning MCQs",
    description:
      "Rapid-fire curriculum questions. 15 seconds to answer, earn Scholar Credits, and prove your module mastery.",
    tag: "Earn Credits",
    tagVariant: "gold" as const,
    emoji: "⚡",
    genre: "Quiz · Fast-paced",
    category: "Academic",
    credits: 50,
  },
  {
    slug: "source-sorter",
    title: "Source Sorter",
    subtitle: "Information Literacy",
    description:
      "Rank 4 sources from most to least reliable for a given research question. 10 rounds of critical evaluation.",
    tag: "Academic",
    tagVariant: "gold" as const,
    emoji: "📚",
    genre: "Knowledge · Critical Thinking",
    category: "Academic",
    credits: 40,
  },
  {
    slug: "citation-sprint",
    title: "Citation Sprint",
    subtitle: "APA / Harvard",
    description:
      "Arrange scrambled citation fields in the correct reference format. 5 source types, timed for pressure.",
    tag: "Academic",
    tagVariant: "default" as const,
    emoji: "📝",
    genre: "Academic · Skill",
    category: "Academic",
    credits: 40,
  },
  {
    slug: "sars-tax-dash",
    title: "SARS Tax Dash",
    subtitle: "SA Tax Return",
    description:
      "Simulate filling in a South African eFiling return. Apply the 2025/26 tax brackets to calculate your refund.",
    tag: "Life Skills",
    tagVariant: "gold" as const,
    emoji: "🧾",
    genre: "Financial Literacy",
    category: "Life Skills",
    credits: 40,
  },
  {
    slug: "email-etiquette",
    title: "Email Etiquette",
    subtitle: "Professional Writing",
    description:
      "Spot every error in badly written professional emails — wrong tone, missing subject lines, inappropriate greetings.",
    tag: "Career",
    tagVariant: "default" as const,
    emoji: "✉",
    genre: "Career · Communication",
    category: "Career",
    credits: 40,
  },
  {
    slug: "interview-survival",
    title: "Interview Survival",
    subtitle: "Job Interview",
    description:
      "Navigate real SA job interview questions with 3 employers. Pick the best response and understand why it works.",
    tag: "Career",
    tagVariant: "gold" as const,
    emoji: "🤝",
    genre: "Career · Strategy",
    category: "Career",
    credits: 40,
  },
  {
    slug: "memory",
    title: "Memory Match",
    subtitle: "Focus Trainer",
    description:
      "Match academic icons in as few moves as possible. Perfect for a 2-minute brain-clearing study break.",
    tag: "Relaxing",
    tagVariant: "live" as const,
    emoji: "🧠",
    genre: "Casual · Skill",
    category: "Relaxation",
    credits: 20,
  },
  {
    slug: "pool",
    title: "Pool",
    subtitle: "Study Break",
    description:
      "The classic 8-ball study break. Clear your head, pot the reds, and return to your modules refreshed.",
    tag: "Coming Soon",
    tagVariant: "default" as const,
    emoji: "🎱",
    genre: "Simulation · Physics",
    category: "Relaxation",
    credits: 20,
  },
  {
    slug: "lease-trap",
    title: "Lease Trap",
    subtitle: "Tenant Rights",
    description: "Spot the illegal clauses hidden in real South African rental agreements before time runs out.",
    tag: "Life Skills",
    tagVariant: "gold" as const,
    emoji: "🏠",
    genre: "Legal Literacy · Document",
    category: "Life Skills",
    credits: 40,
  },
  {
    slug: "graph-lie-detector",
    title: "Graph Lie Detector",
    subtitle: "Data Literacy",
    description: "Identify the statistical manipulation in real-looking charts. Truncated axes, cherry-picked data, and more.",
    tag: "Academic",
    tagVariant: "gold" as const,
    emoji: "📊",
    genre: "Data Literacy · Critical Thinking",
    category: "Academic",
    credits: 35,
  },
  {
    slug: "cv-optimizer",
    title: "CV Optimizer",
    subtitle: "Career Prep",
    description: "Select the best CV blocks for each employer and watch your ATS keyword match score in real time.",
    tag: "Career",
    tagVariant: "gold" as const,
    emoji: "📄",
    genre: "Career · ATS",
    category: "Career",
    credits: 50,
  },
  {
    slug: "budget-block",
    title: "Budget Block",
    subtitle: "Financial Literacy",
    description: "Survive a student month on a NSFAS budget. Pay or skip expenses as random events throw your finances off.",
    tag: "Life Skills",
    tagVariant: "gold" as const,
    emoji: "💰",
    genre: "Financial Literacy · Strategy",
    category: "Life Skills",
    credits: 40,
  },
  {
    slug: "debate-clock",
    title: "Debate Clock",
    subtitle: "Critical Thinking",
    description: "Counter 5 provocative statements in 45 seconds each. AI scores your relevance, evidence, and clarity.",
    tag: "AI Scored",
    tagVariant: "live" as const,
    emoji: "🎤",
    genre: "Critical Thinking · AI",
    category: "Academic",
    credits: 50,
  },
  {
    slug: "plain-language",
    title: "Plain Language",
    subtitle: "Clear Writing",
    description: "Rewrite dense legal and government documents in plain English. AI scores clarity, accuracy, and conciseness.",
    tag: "AI Scored",
    tagVariant: "live" as const,
    emoji: "✍️",
    genre: "Writing · AI",
    category: "Academic",
    credits: 50,
  },
  {
    slug: "brazil",
    title: "BRAZIL",
    subtitle: "Survival Story",
    description:
      "A student survival story. Navigate campus life, make choices, and survive the academic grind.",
    tag: "Classic",
    tagVariant: "default" as const,
    emoji: "🇧🇷",
    genre: "Adventure · Story",
    category: "Relaxation",
    credits: 20,
  },
];

const CATEGORIES: GameCategory[] = ["All", "Life Skills", "Academic", "Career", "Relaxation"];

function getDailyChallenge() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return GAMES[dayOfYear % GAMES.length];
}

export default function GameCenterPage() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("daily");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLb, setLoadingLb] = useState(false);
  const [activeCategory, setActiveCategory] = useState<GameCategory>("All");

  useEffect(() => {
    setLoadingLb(true);
    fetch(`/api/games/leaderboard?game=exam_dash&period=${period}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d: { leaderboard?: LeaderboardEntry[] }) => setLeaderboard(d.leaderboard ?? []))
      .catch(() => setLeaderboard([]))
      .finally(() => setLoadingLb(false));
  }, [period]);

  const dailyChallenge = getDailyChallenge();
  const researchOn = isResearchStudyEnabled();
  const visibleGames = researchOn
    ? GAMES
    : GAMES.filter((g) => g.slug !== "observational-silence");
  const filteredGames =
    activeCategory === "All"
      ? visibleGames
      : visibleGames.filter((g) => g.category === activeCategory);

  return (
    <div className={styles.container}>
      <RouteHeader
        title="Games Center"
        description="Compete, relax, and earn credits during study breaks."
      />

      {/* Daily Challenge Banner */}
      <div className={styles.dailyChallenge}>
        <div>
          <span className={styles.dailyTag}>Today&apos;s Challenge</span>
          <h2 className={styles.dailyTitle}>{dailyChallenge.emoji} {dailyChallenge.title}</h2>
          <p className={styles.dailyDesc}>{dailyChallenge.description}</p>
        </div>
        <Link href={`/community/games/${dailyChallenge.slug}`} className={`button ${styles.dailyBtn}`}>
          Play Now →
        </Link>
      </div>

      {/* Category filter */}
      <div className={styles.categoryStrip}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={styles.catBtn}
            data-active={activeCategory === cat}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className={styles.grid}>
        {filteredGames.map((game) => (
          <Card key={game.slug} className={styles.gameCard}>
            <CardHeader>
              <div className={styles.gameHeader}>
                <span className={styles.gameEmoji}>{game.emoji}</span>
                <div className={styles.gameBadge} data-variant={game.tagVariant}>
                  {game.tag}
                </div>
              </div>
            </CardHeader>
            <CardBody>
              <CardTitle className={styles.gameTitle}>{game.title}</CardTitle>
              <p className={styles.gameSubtitle}>{game.subtitle}</p>
              <p className={styles.gameDescription}>{game.description}</p>
              <div className={styles.gameFooter}>
                <span className={styles.gameGenre}>{game.genre}</span>
                <span className={styles.creditsPreview}>Earn up to {game.credits} credits</span>
              </div>
              <Link href={`/community/games/${game.slug}`} className={styles.playButton}>
                Play Now →
              </Link>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className={styles.leaderboardSection}>
        <div className={styles.lbHeader}>
          <div>
            <h2 className={styles.lbTitle}>Exam Dash Leaderboard</h2>
            <p className={styles.lbSubtitle}>The fastest typists in the community</p>
          </div>
          <div className={styles.lbTabs}>
            {(["daily", "weekly", "all"] as const).map((p) => (
              <button
                key={p}
                className={styles.lbTab}
                data-active={period === p}
                onClick={() => setPeriod(p)}
              >
                {p === "all" ? "All Time" : p}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.lbList}>
          {loadingLb ? (
            <p className={styles.emptyMsg}>Loading community stats...</p>
          ) : leaderboard.length === 0 ? (
            <p className={styles.emptyMsg}>No runs recorded yet. Be the first!</p>
          ) : (
            leaderboard.map((entry) => (
              <div key={entry.userId} className={styles.lbEntry} data-rank={entry.rank}>
                <span className={styles.rank}>
                  {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`}
                </span>
                <span className={styles.name}>{entry.displayName}</span>
                <div className={styles.stats}>
                  <span className={styles.wpm}>{entry.score} WPM</span>
                  {entry.metadata?.accuracy != null && (
                    <span className={styles.accuracy}>{Math.round(entry.metadata.accuracy)}% acc</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
