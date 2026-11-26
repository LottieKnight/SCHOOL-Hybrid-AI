import { MARK_SCHEMA, HINT_SCHEMA, PLAN_SCHEMA, type HintPayload, type MarkPayload, type PlanPayload } from "./schemas";
import { MARKING_PROMPT, PLAN_PROMPT, SYSTEM_PROMPT } from "./prompts";
import { normalizeHint, normalizeMark, normalizePlan, parseModelJson } from "./parse";
import { formatInferenceSource } from "./display";
import { resolveInference, type TutorSettings, type TutorTask } from "./routing";
import { runHybrid, type GenerativeParts } from "./hybridModel";
import type { AI } from "firebase/ai";

export type TutorRunResult =
  | {
      task: "hint";
      source: "on_device" | "in_cloud";
      display: string;
      mode: string;
      reason: string;
      data: HintPayload;
    }
  | {
      task: "mark";
      source: "on_device" | "in_cloud";
      display: string;
      mode: string;
      reason: string;
      data: MarkPayload;
    }
  | {
      task: "plan";
      source: "on_device" | "in_cloud";
      display: string;
      mode: string;
      reason: string;
      data: PlanPayload;
    };

export async function runTutorTask(input: {
  ai: AI;
  settings: TutorSettings;
  task: TutorTask;
  parts: GenerativeParts;
  answerText?: string;
  hasPdf?: boolean;
  offline?: boolean;
  planDays?: number;
}): Promise<TutorRunResult> {
  if (!input.settings.ai_enabled) {
    throw new Error("The tutor is switched off (Remote Config ai_enabled).");
  }
  const decision = resolveInference({
    task: input.task,
    answerText: input.answerText,
    hasPdf: input.hasPdf,
    offline: input.offline,
    settings: input.settings,
  });
  if (input.offline && decision.forceCloud) {
    throw new Error("This step needs the cloud. Open a saved topic or an already loaded lesson while the signal is down.");
  }
  const schema = input.task === "hint" ? HINT_SCHEMA : input.task === "mark" ? MARK_SCHEMA : PLAN_SCHEMA;
  const systemInstruction = input.task === "mark" ? MARKING_PROMPT : input.task === "plan" ? PLAN_PROMPT : SYSTEM_PROMPT;
  const { text, source } = await runHybrid({
    ai: input.ai,
    settings: input.settings,
    schema,
    systemInstruction,
    parts: input.parts,
    forceCloud: decision.forceCloud,
    modeName: decision.mode,
  });
  const parsed = parseModelJson(text);
  const display = formatInferenceSource(source);
  if (input.task === "hint") {
    return { task: "hint", source, display, mode: decision.mode, reason: decision.reason, data: normalizeHint(parsed) };
  }
  if (input.task === "mark") {
    return { task: "mark", source, display, mode: decision.mode, reason: decision.reason, data: normalizeMark(parsed) };
  }
  return {
    task: "plan",
    source,
    display,
    mode: decision.mode,
    reason: decision.reason,
    data: normalizePlan(parsed, input.planDays ?? 7),
  };
}
