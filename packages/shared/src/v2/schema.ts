import { z } from "zod";

export const LessonV2SectionSchema = z.object({
  heading: z.string().min(1),
  content: z.string().min(1),
});

export const LessonV2PracticeSchema = z.object({
  easy: z.array(z.string().min(1)).default([]),
  medium: z.array(z.string().min(1)).default([]),
  hard: z.array(z.string().min(1)).default([]),
});

export const LessonV2QuizQuestionSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["mcq", "true_false", "short_answer"]),
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).optional(),
  answer: z.union([z.string().min(1), z.array(z.string().min(1))]),
  explanation: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  tags: z.array(z.string().min(1)).optional(),
});

export const LessonV2QuizSchema = z.object({
  questions: z.array(LessonV2QuizQuestionSchema).min(1),
  answers: z.array(z.string().min(1)).optional(),
  memo: z.array(z.string().min(1)).optional(),
});

export const LessonV2ResourceSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
  sourceNote: z.string().optional(),
});

export const LessonV2Schema = z.object({
  id: z.string().min(1),
  phase: z.enum(["foundation", "intermediate", "senior", "fet"]),
  grade: z.number().int().min(0).max(12),
  subjectKey: z.string().min(1),
  term: z.number().int().min(1).max(4),
  week: z.number().int().min(1).max(52),
  title: z.string().min(1),
  topic: z.string().min(1),
  summary: z.string().min(1),
  outcomes: z.array(z.string().min(1)),
  sections: z.array(LessonV2SectionSchema),
  workedExamples: z.array(z.string().min(1)),
  practice: LessonV2PracticeSchema,
  quiz: LessonV2QuizSchema,
  resources: z.array(LessonV2ResourceSchema),
  version: z.number().int().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  language: z.string().min(2).max(8).default("en"),
});

export type LessonV2Content = z.infer<typeof LessonV2Schema>;
