/** JSON schemas for Firebase AI Logic hybrid inference (on-device responseConstraint and cloud responseJsonSchema). */

export const HINT_SCHEMA: { [key: string]: unknown } = {
  type: "object",
  properties: {
    topic: { type: "string" },
    hints: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } },
    solution: { type: "string" },
    final_answer: { type: "string" },
  },
  required: ["topic", "hints", "solution", "final_answer"],
  additionalProperties: false,
};

export const MARK_SCHEMA: { [key: string]: unknown } = {
  type: "object",
  properties: {
    score: { type: "integer" },
    out_of: { type: "integer" },
    missed_steps: { type: "array", items: { type: "string" } },
    feedback: { type: "string" },
    next_action: { type: "string" },
  },
  required: ["score", "out_of", "missed_steps", "feedback", "next_action"],
  additionalProperties: false,
};

export const PLAN_SCHEMA: { [key: string]: unknown } = {
  type: "object",
  properties: {
    subject: { type: "string" },
    topics: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          marks: { type: "integer" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["name", "marks", "priority"],
      },
    },
    plan: {
      type: "array",
      items: {
        type: "object",
        properties: {
          day: { type: "integer" },
          focus: { type: "string" },
          tasks: { type: "array", items: { type: "string" } },
        },
        required: ["day", "focus", "tasks"],
      },
    },
  },
  required: ["subject", "topics", "plan"],
  additionalProperties: false,
};

export type HintPayload = {
  topic: string;
  hints: [string, string, string];
  solution: string;
  final_answer: string;
};

export type MarkPayload = {
  score: number;
  out_of: number;
  missed_steps: string[];
  feedback: string;
  next_action: string;
};

export type PlanTopic = { name: string; marks: number; priority: "high" | "medium" | "low" };
export type PlanDay = { day: number; focus: string; tasks: string[] };
export type PlanPayload = { subject: string; topics: PlanTopic[]; plan: PlanDay[] };
