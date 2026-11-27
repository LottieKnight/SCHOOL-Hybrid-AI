export const DEFAULT_LONG_ANSWER_CHARS = 600;

/**
 * Cloud model for Firebase AI Logic (`GoogleAIBackend` / Gemini Developer API).
 * `gemini-2.5-flash` returns 404 for projects that have not used it before:
 * it is shut down on the Agent Platform and blocked for new users on the
 * Gemini Developer API until the 1 Dec 2026 auto-route. The documented
 * replacement is `gemini-3.5-flash-lite` (stable, no shutdown date, billing
 * not required). `gemini-3.0-flash` is not a Firebase AI Logic model id.
 * `gemini-3.8-flash` is the current full Flash and stays valid as an override.
 */
export const CLOUD_MODEL = "gemini-3.5-flash-lite";

/** Ids that must not be sent. Includes the bogus id from the 2.5 Flash 404 body. */
const RETIRED_CLOUD_MODELS = new Set([
  "gemini-1.0-pro",
  "gemini-1.0-pro-001",
  "gemini-1.0-pro-002",
  "gemini-1.0-pro-vision",
  "gemini-1.0-pro-vision-001",
  "gemini-1.5-flash",
  "gemini-1.5-flash-001",
  "gemini-1.5-flash-002",
  "gemini-1.5-pro",
  "gemini-1.5-pro-001",
  "gemini-1.5-pro-002",
  "gemini-2.0-flash",
  "gemini-2.0-flash-001",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash-lite-001",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
  "gemini-3-flash",
  "gemini-3.0-flash",
]);

/**
 * Model id actually passed to `getGenerativeModel`. Empty and retired ids
 * (including a Remote Config value that is still `gemini-2.5-flash`) become
 * {@link CLOUD_MODEL}. Any other id is kept so a Console override such as
 * `gemini-3.8-flash` still applies.
 */
export function resolveCloudModel(requested: string | null | undefined): string {
  const name = (requested ?? "").trim().replace(/^models\//i, "").toLowerCase();
  if (!name || RETIRED_CLOUD_MODELS.has(name)) return CLOUD_MODEL;
  return name;
}

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
  cloud_model: CLOUD_MODEL,
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
