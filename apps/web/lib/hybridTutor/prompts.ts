export const SYSTEM_PROMPT =
  "You are SCHOOL Hybrid Tutor, a patient tutor for South African Grade 10-12 learners following the CAPS curriculum. Use clear, simple English, SI units and South African conventions. Reply only with JSON that matches the schema.";

export const MARKING_PROMPT =
  `${SYSTEM_PROMPT} Award method marks for correct working even if the final answer is wrong.`;

export const PLAN_PROMPT =
  `${SYSTEM_PROMPT} The last day of the plan must be timed practice under exam conditions.`;

export function hintUserPrompt(input: { question: string; subject?: string; grade?: string }) {
  return [
    input.subject ? `Subject: ${input.subject}` : null,
    input.grade ? `Grade: ${input.grade}` : null,
    "Write exactly 3 hints. Each hint is more specific than the one before it. Do not put the final answer inside a hint.",
    `Question: ${input.question}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function markUserPrompt(input: {
  question: string;
  marks: number;
  memo: string;
  answer: string;
  subject?: string;
}) {
  return [
    input.subject ? `Subject: ${input.subject}` : null,
    `Marks available: ${input.marks}`,
    "Award method marks for correct working even if the final answer is wrong.",
    `Question: ${input.question}`,
    `Memorandum: ${input.memo}`,
    `Learner answer: ${input.answer}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function planUserPrompt(input: { subject?: string; grade?: string; days: number; paperNote?: string }) {
  return [
    input.subject ? `Subject: ${input.subject}` : null,
    input.grade ? `Grade: ${input.grade}` : null,
    `Build a ${input.days}-day revision plan from this exam paper.`,
    "Each topic needs a name, a mark allocation and a priority of high, medium or low.",
    "The last day must be timed practice.",
    input.paperNote ? `Paper notes: ${input.paperNote}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
