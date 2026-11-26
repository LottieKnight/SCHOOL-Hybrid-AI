// apps/api/src/lib/imageGen.ts
// Generates lesson illustration images via OpenAI DALL·E 3 (reuses OPENAI_API_KEY /
// OPENAI_API_BASE already configured for the LLM). Persists bytes to
// uploads/lesson-images/ and returns a local serving URL. Provider-agnostic wrapper:
// swap `generateWithProvider` for FAL/Stable-Diffusion later without touching callers.
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";

const IMAGE_ROOT = fileURLToPath(new URL("../../uploads/lesson-images", import.meta.url));

export type LessonImageStyle =
  | "clean-diagram"
  | "warm-illustration"
  | "scientific-precise"
  | "photo-realistic";

const STYLE_PROMPTS: Record<LessonImageStyle, string> = {
  "clean-diagram": "flat clean educational diagram, minimalist, high contrast, labelled, white background",
  "warm-illustration": "warm friendly children's book illustration style, soft colours, engaging for young learners",
  "scientific-precise": "precise scientific illustration, accurate labels, textbook quality, neutral background",
  "photo-realistic": "photographic, realistic, high detail",
};

function buildImagePrompt(alt: string, style: LessonImageStyle, context?: string): string {
  const styleText = STYLE_PROMPTS[style] ?? STYLE_PROMPTS["clean-diagram"];
  const ctx = context ? ` Subject context: ${context}.` : "";
  return `Educational illustration for a South African CAPS curriculum lesson. ${alt}.${ctx} Style: ${styleText}. No text in the image unless it is a clear labelled diagram. Safe for children.`;
}

async function generateWithOpenAI(prompt: string): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  const apiBase = process.env.OPENAI_API_BASE || "https://api.openai.com/v1";
  if (!apiKey) throw new Error("OPENAI_API_KEY not set — cannot generate images.");

  const res = await fetch(`${apiBase.replace(/\/+$/, "")}/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Image generation failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image generation returned no image data.");
  return Buffer.from(b64, "base64");
}

/**
 * Generate a lesson illustration and persist it. Returns the local serving URL
 * (served by GET /files/lesson-image/:file). Falls back gracefully: callers decide
 * whether to throw or skip on failure.
 */
export async function generateLessonImage(input: {
  alt: string;
  style?: LessonImageStyle;
  context?: string;
}): Promise<{ url: string; file: string }> {
  const prompt = buildImagePrompt(input.alt, input.style ?? "clean-diagram", input.context);
  const bytes = await generateWithOpenAI(prompt);
  await fs.mkdir(IMAGE_ROOT, { recursive: true });
  const file = `${randomUUID()}.png`;
  await fs.writeFile(path.join(IMAGE_ROOT, file), bytes);
  return { url: `/api/files/lesson-image/${file}`, file };
}

export function isLessonImageServingUrl(url: string): boolean {
  return url.startsWith("/api/files/lesson-image/");
}

/**
 * Enrich a single written lesson file: for every `image` visual with an empty `src`,
 * generate the illustration and write the URL back into the lesson JSON. Used right
 * after lesson generation so new lessons ship with illustrations (not just backfill).
 * Failures are logged but never throw — image enrichment is best-effort.
 */
export async function enrichLessonImages(lessonPath: string): Promise<number> {
  let lesson: any;
  try {
    lesson = JSON.parse(await fs.readFile(lessonPath, "utf-8"));
  } catch {
    return 0;
  }
  const visuals: any[] = Array.isArray(lesson.visuals) ? lesson.visuals : [];
  const needsImage = visuals.filter((v) => v?.kind === "image" && !v?.src);
  if (!needsImage.length) return 0;

  const context = `${lesson.topic ?? ""} — ${lesson.subjectKey ?? ""} grade ${lesson.grade ?? ""}`;
  let generated = 0;
  for (const visual of needsImage) {
    const alt = visual.alt || lesson.topic || "lesson illustration";
    try {
      const { url } = await generateLessonImage({ alt, context });
      visual.src = url;
      generated++;
    } catch (err) {
      console.error(`[enrichLessonImages] failed for "${alt}":`, (err as Error).message);
    }
  }

  if (generated) {
    await fs.writeFile(lessonPath, JSON.stringify(lesson, null, 2) + "\n");
  }
  return generated;
}
