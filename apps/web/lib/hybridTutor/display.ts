export type InferencePlace = "on_device" | "in_cloud";

export function formatInferenceSource(source: InferencePlace): string {
  if (source === "on_device") return "Ran on this device · Gemini Nano";
  return "Ran in the cloud · Gemini";
}

export function formatAvailability(status: string): string {
  switch (status) {
    case "available":
      return "On-device model ready";
    case "downloadable":
      return "On-device model can be downloaded";
    case "downloading":
      return "Downloading the on-device model";
    case "unavailable":
      return "On-device model unavailable in this browser";
    default:
      return "This browser has no built-in Prompt API";
  }
}
