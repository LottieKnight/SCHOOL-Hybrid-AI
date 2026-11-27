import {
  getGenerativeModel,
  InferenceMode,
  InferenceSource,
  type AI,
  type HybridParams,
  type Part,
} from "firebase/ai";
import { resolveCloudModel, type TutorSettings } from "./routing";

const MODE = {
  PREFER_ON_DEVICE: InferenceMode.PREFER_ON_DEVICE,
  ONLY_ON_DEVICE: InferenceMode.ONLY_ON_DEVICE,
  ONLY_IN_CLOUD: InferenceMode.ONLY_IN_CLOUD,
  PREFER_IN_CLOUD: InferenceMode.PREFER_IN_CLOUD,
} as const;

/**
 * Hybrid model for Firebase AI Logic, verified against firebase 13.4.0
 * (`@firebase/ai` 3.1.0). `getGenerativeModel` accepts `HybridParams`
 * (`mode`, `onDeviceParams`, `inCloudParams`). On-device JSON uses
 * `promptOptions.responseConstraint`. Cloud JSON uses
 * `generationConfig.responseJsonSchema` with `responseMimeType`.
 * Inline parts include `type: "inlineData"` because that is the `Part` union.
 */
export function hybridModel(input: {
  ai: AI;
  settings: Pick<TutorSettings, "inference_mode" | "cloud_model">;
  schema: { [key: string]: unknown };
  systemInstruction: string;
  forceCloud?: boolean;
  modeName?: keyof typeof MODE;
}) {
  const modeName = input.forceCloud ? "ONLY_IN_CLOUD" : (input.modeName ?? "PREFER_ON_DEVICE");
  const mode = MODE[modeName] ?? InferenceMode.PREFER_ON_DEVICE;
  const params: HybridParams = {
    mode,
    onDeviceParams: {
      createOptions: {
        initialPrompts: [
          {
            role: "system",
            content: [{ type: "text", value: input.systemInstruction }],
          },
        ],
        expectedInputs: [
          { type: "text", languages: ["en"] },
          { type: "image" },
        ],
        expectedOutputs: [{ type: "text", languages: ["en"] }],
      },
      promptOptions: { responseConstraint: input.schema },
    },
    inCloudParams: {
      model: resolveCloudModel(input.settings.cloud_model),
      systemInstruction: input.systemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: input.schema,
        temperature: 0.3,
      },
    },
  };
  return getGenerativeModel(input.ai, params);
}

export type GenerativeParts = Array<string | Part>;

export async function runHybrid(input: {
  ai: AI;
  settings: Pick<TutorSettings, "inference_mode" | "cloud_model">;
  schema: { [key: string]: unknown };
  systemInstruction: string;
  parts: GenerativeParts;
  forceCloud?: boolean;
  modeName?: keyof typeof MODE;
}) {
  const model = hybridModel(input);
  const result = await model.generateContent(input.parts);
  const text = result.response.text();
  const source = result.response.inferenceSource === InferenceSource.ON_DEVICE ? "on_device" : "in_cloud";
  return { text, source: source as "on_device" | "in_cloud", model };
}

/** Call from a click or tap handler, before any await, so Chrome keeps the user gesture. */
export function enableOnDeviceFromGesture(
  model: { initializeDeviceModel: (onProgress?: (progress: number) => void) => Promise<void> },
  onProgress?: (progress: number) => void,
) {
  return model.initializeDeviceModel(onProgress);
}
