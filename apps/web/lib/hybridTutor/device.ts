export type PromptAvailability = "available" | "downloadable" | "downloading" | "unavailable" | "unsupported";

type LanguageModelLike = {
  availability?: (options?: unknown) => Promise<string> | string;
};

export async function readLanguageModelAvailability(): Promise<PromptAvailability> {
  const host = globalThis as { LanguageModel?: LanguageModelLike };
  const availability = host.LanguageModel?.availability;
  if (typeof availability !== "function") return "unsupported";
  try {
    const status = await availability({
      expectedInputs: [
        { type: "text", languages: ["en"] },
        { type: "image" },
      ],
      expectedOutputs: [{ type: "text", languages: ["en"] }],
    });
    if (status === "available" || status === "downloadable" || status === "downloading" || status === "unavailable") {
      return status;
    }
    return "unavailable";
  } catch {
    return "unavailable";
  }
}
