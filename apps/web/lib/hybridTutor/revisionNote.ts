export type RevisionNoteDraft = {
  title: string;
  body: string;
  sourceType: "past_paper_question";
  sourceId: string;
  followUp: {
    id: string;
    topic: string;
    prompt: string;
    href: string;
  };
  errorPatterns: string[];
};

export function buildRevisionNote(input: {
  questionId: string;
  questionLabel: string;
  topic: string;
  subject?: string;
  missedSteps: string[];
  score: number;
  outOf: number;
}): RevisionNoteDraft {
  const topic = input.topic.trim() || input.questionLabel.trim() || "this question";
  const subject = input.subject?.trim() || "CAPS";
  const patterns = input.missedSteps.map((step) => step.trim()).filter(Boolean).slice(0, 4);
  const patternText = patterns.length
    ? patterns.join("; ")
    : input.score >= input.outOf
      ? "the working held together"
      : "a step was skipped before the final line";
  const followUpId = `follow-${input.questionId}`;
  const prompt = `Without looking at the memo, answer one fresh ${subject} question on ${topic}. Write every step, then check only the method.`;
  const href = `/tutor?mode=hints&subject=${encodeURIComponent(subject)}&q=${encodeURIComponent(prompt)}`;
  const title = `Revision note · ${topic}`;
  const body = [
    `${input.questionLabel}: ${input.score}/${input.outOf}.`,
    patterns.length
      ? `The marks slipped here: ${patternText}.`
      : `Nothing in the working stood out as a missed step. Keep the method and change the numbers.`,
    "Method marks still count when the working is right, even if the last line is wrong.",
    `Follow-up practice: ${prompt}`,
  ].join(" ");
  return {
    title,
    body,
    sourceType: "past_paper_question",
    sourceId: input.questionId,
    followUp: { id: followUpId, topic, prompt, href },
    errorPatterns: patterns,
  };
}
