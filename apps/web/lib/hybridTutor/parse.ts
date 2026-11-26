import type { HintPayload, MarkPayload, PlanPayload, PlanTopic } from "./schemas";

export function parseModelJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("The tutor reply was not JSON.");
    }
    return JSON.parse(match[0]);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The tutor reply was not a JSON object.");
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asInt(value: unknown, fallback = 0): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.round(number);
}

export function normalizeHint(value: unknown): HintPayload {
  const record = asRecord(value);
  const hints = Array.isArray(record.hints) ? record.hints.map((item) => asString(item)).filter(Boolean) : [];
  while (hints.length < 3) hints.push("Look at the information the question already gives you.");
  return {
    topic: asString(record.topic, "This question"),
    hints: [hints[0], hints[1], hints[2]],
    solution: asString(record.solution),
    final_answer: asString(record.final_answer),
  };
}

export function normalizeMark(value: unknown): MarkPayload {
  const record = asRecord(value);
  const outOf = Math.max(1, asInt(record.out_of, 1));
  const score = Math.max(0, Math.min(outOf, asInt(record.score, 0)));
  const missed = Array.isArray(record.missed_steps)
    ? record.missed_steps.map((item) => asString(item)).filter(Boolean)
    : [];
  return {
    score,
    out_of: outOf,
    missed_steps: missed,
    feedback: asString(record.feedback),
    next_action: asString(record.next_action, "Try a similar question tomorrow."),
  };
}

function priority(value: unknown): PlanTopic["priority"] {
  const text = asString(value).toLowerCase();
  if (text === "high" || text === "low") return text;
  return "medium";
}

export function normalizePlan(value: unknown, days: number): PlanPayload {
  const record = asRecord(value);
  const topics = Array.isArray(record.topics)
    ? record.topics.map((item) => {
        const topic = asRecord(item);
        return {
          name: asString(topic.name, "Revision"),
          marks: Math.max(0, asInt(topic.marks, 0)),
          priority: priority(topic.priority),
        };
      })
    : [];
  const plan = Array.isArray(record.plan)
    ? record.plan.map((item, index) => {
        const day = asRecord(item);
        const tasks = Array.isArray(day.tasks) ? day.tasks.map((task) => asString(task)).filter(Boolean) : [];
        return {
          day: Math.max(1, asInt(day.day, index + 1)),
          focus: asString(day.focus, "Revise"),
          tasks: tasks.length ? tasks : ["Work one example slowly and write each step."],
        };
      })
    : [];
  if (plan.length > 0) {
    const last = plan[plan.length - 1];
    if (!/timed practice/i.test(last.focus)) {
      last.focus = "Timed practice";
      last.tasks = ["Write a timed practice under exam conditions.", ...last.tasks];
    }
  } else {
    plan.push({
      day: Math.max(1, days),
      focus: "Timed practice",
      tasks: ["Write a timed practice under exam conditions."],
    });
  }
  return {
    subject: asString(record.subject, "CAPS"),
    topics,
    plan,
  };
}
