export const DEFAULT_LONG_ANSWER_CHARS = 600;

export type TutorTask = "hint" | "mark" | "plan";

export type TutorSettings = {
  inference_mode: string;
  long_answer_chars: number;
  cloud_model: string;
  ai_enabled: boolean;
};

export const DEFAULT_SETTINGS: TutorSettings = {
  inference_mode: "PREFER_ON_DEVICE",
  long_answer_chars: DEFAULT_LONG_ANSWER_CHARS,
  cloud_model: "gemini-2.5-flash",
  ai_enabled: true,
};

export type InferenceModeName = "PREFER_ON_DEVICE" | "ONLY_ON_DEVICE" | "ONLY_IN_CLOUD" | "PREFER_IN_CLOUD";

const MODE_NAMES: Record<string, InferenceModeName> = {
  PREFER_ON_DEVICE: "PREFER_ON_DEVICE",
  ONLY_ON_DEVICE: "ONLY_ON_DEVICE",
  ONLY_IN_CLOUD: "ONLY_IN_CLOUD",
  PREFER_IN_CLOUD: "PREFER_IN_CLOUD",
  prefer_on_device: "PREFER_ON_DEVICE",
  only_on_device: "ONLY_ON_DEVICE",
  only_in_cloud: "ONLY_IN_CLOUD",
  prefer_in_cloud: "PREFER_IN_CLOUD",
};

export type RouteDecision = {
  mode: InferenceModeName;
  forceCloud: boolean;
  reason: "pdf" | "long_answer" | "offline_hint" | "settings" | "kill_switch";
};

export function resolveInference(input: {
  task: TutorTask;
  answerText?: string;
  hasPdf?: boolean;
  offline?: boolean;
  settings: Pick<TutorSettings, "inference_mode" | "long_answer_chars" | "ai_enabled">;
}): RouteDecision {
  if (!input.settings.ai_enabled) {
    return { mode: "ONLY_IN_CLOUD", forceCloud: true, reason: "kill_switch" };
  }
  if (input.task === "plan" && input.hasPdf) {
    return { mode: "ONLY_IN_CLOUD", forceCloud: true, reason: "pdf" };
  }
  if (input.task === "mark") {
    const length = (input.answerText ?? "").length;
    if (length > input.settings.long_answer_chars) {
      return { mode: "ONLY_IN_CLOUD", forceCloud: true, reason: "long_answer" };
    }
  }
  if (input.offline && input.task === "hint") {
    return { mode: "ONLY_ON_DEVICE", forceCloud: false, reason: "offline_hint" };
  }
  const mode = MODE_NAMES[input.settings.inference_mode] ?? "PREFER_ON_DEVICE";
  return { mode, forceCloud: mode === "ONLY_IN_CLOUD", reason: "settings" };
}
