import type { Metadata } from "next";
import { QuizRushClient } from "./QuizRushClient";

export const metadata: Metadata = {
  title: "Exam Dash — Race the Clock",
  description: "Timed MCQ quiz against the clock. Pick your subject, answer fast, earn Scholar Credits.",
};

export default function ExamDashPage() {
  return <QuizRushClient />;
}
