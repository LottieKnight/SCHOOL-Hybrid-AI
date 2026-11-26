export type ChangelogEntry = {
  version: string;
  date: string;
  headline: string;
  items: string[];
};

export const changelog: ChangelogEntry[] = [
  {
    version: "v0.9",
    date: "2025-05-15",
    headline: "Games Center + Exam Dash",
    items: [
      "Exam Dash launched — timed MCQ sessions that award Scholar Credits on completion",
      "BRAZIL text adventure is live in the Games Center",
      "Scholar Credits wallet now tracks all game-earned credits alongside community rewards",
    ],
  },
  {
    version: "v0.8",
    date: "2025-04-20",
    headline: "Daily Quiz with Streaks & Leaderboard",
    items: [
      "Daily quiz adapts to your weakest areas based on past answers",
      "Streak tracking and campus leaderboard added to the quiz module",
      "In-app notifications for quiz reminders and streak alerts",
    ],
  },
  {
    version: "v0.7",
    date: "2025-03-10",
    headline: "AI Tutor + Community Module Rooms",
    items: [
      "AI Tutor is context-aware — it knows your institution, module, and academic period",
      "Module rooms for peer Q&A launched; anonymous posting is supported",
      "Accepted answers now award 20 Scholar Credits to the person who answered",
    ],
  },
  {
    version: "v0.6",
    date: "2025-02-01",
    headline: "Past Papers Library & Study Planner",
    items: [
      "Full SA past paper library — searchable by province, grade, subject, and year",
      "CAPS-aligned study planner for school learners",
      "Upload-based timetable support for university students",
    ],
  },
  {
    version: "v0.5",
    date: "2025-01-10",
    headline: "Platform Launch",
    items: [
      "SCHOOL opens to South African students — free to join, no credit card required",
      "Core features: Lessons, AI Tutor, Past Papers, Community, Planner, Marketplace",
      "Scholar Credits economy introduced as the in-platform reward currency",
    ],
  },
];
