import type { Part } from "firebase/ai";

export async function fileToInlinePart(file: Blob, mimeType?: string): Promise<Part> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
  const data = dataUrl.includes(",") ? dataUrl.split(",")[1] ?? "" : dataUrl;
  return {
    type: "inlineData",
    inlineData: {
      mimeType: mimeType || file.type || "application/octet-stream",
      data,
    },
  };
}

export function textPart(text: string): Part {
  return { type: "text", text };
}
