export type SkillNode = {
  topic: string;
  subject: string;
  mastery: number;
  hintsUsed: number;
  retries: number;
  quizzes: number;
  lastScore: number | null;
};

export type SkillMap = Record<string, SkillNode>;

export type MasteryEvent =
  | { type: "hint"; topic: string; subject?: string; depth: 1 | 2 | 3 }
  | { type: "retry"; topic: string; subject?: string }
  | { type: "quiz"; topic: string; subject?: string; score: number; outOf: number };

const HINT_COST: Record<1 | 2 | 3, number> = { 1: 2, 2: 4, 3: 6 };

export function skillKey(subject: string, topic: string) {
  return `${subject.trim().toLowerCase()}::${topic.trim().toLowerCase()}`;
}

export function masteryLabel(mastery: number): "Starting" | "Building" | "Steady" | "Secure" {
  if (mastery >= 80) return "Secure";
  if (mastery >= 60) return "Steady";
  if (mastery >= 40) return "Building";
  return "Starting";
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function ensure(map: SkillMap, topic: string, subject?: string): SkillNode {
  const subjectName = subject?.trim() || "CAPS";
  const key = skillKey(subjectName, topic);
  return (
    map[key] ?? {
      topic: topic.trim() || "This question",
      subject: subjectName,
      mastery: 40,
      hintsUsed: 0,
      retries: 0,
      quizzes: 0,
      lastScore: null,
    }
  );
}

export function applyMasteryEvent(map: SkillMap, event: MasteryEvent): SkillMap {
  const topic = event.topic.trim() || "This question";
  const node = ensure(map, topic, event.subject);
  const key = skillKey(node.subject, node.topic);
  let next = { ...node };
  if (event.type === "hint") {
    next = {
      ...next,
      hintsUsed: next.hintsUsed + 1,
      mastery: clamp(next.mastery - HINT_COST[event.depth]),
    };
  } else if (event.type === "retry") {
    const bump = next.lastScore !== null && next.lastScore < 50 ? 3 : 1;
    next = { ...next, retries: next.retries + 1, mastery: clamp(next.mastery + bump) };
  } else {
    const percent = event.outOf > 0 ? (event.score / event.outOf) * 100 : 0;
    next = {
      ...next,
      quizzes: next.quizzes + 1,
      lastScore: clamp(percent),
      mastery: clamp(next.mastery * 0.55 + percent * 0.45),
    };
  }
  return { ...map, [key]: next };
}

export function listSkills(map: SkillMap): SkillNode[] {
  return Object.values(map).sort((a, b) => a.mastery - b.mastery || a.topic.localeCompare(b.topic));
}
