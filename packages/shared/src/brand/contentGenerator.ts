import type { BrandSignal, Platform, PlatformContent, VoiceModel } from "./types.js";

const OPENAI_API_BASE = process.env.OPENAI_API_BASE ?? "https://api.openai.com/v1";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const PLATFORM_INSTRUCTIONS: Record<Platform, string> = {
  x: `Generate a Twitter/X thread. Rules:
- 4–8 tweets, each under 280 characters
- Tweet 1 is the hook — bold, specific, no fluff, makes them stop scrolling
- No hashtags except 1 max on final tweet
- Numbered format: "1/" "2/" etc.
- Conversational, direct, builder tone
- End with a question or CTA
- Return as JSON: { "thread": ["tweet1", "tweet2", ...] }`,

  linkedin: `Generate a LinkedIn post. Rules:
- 500–900 words
- First line is the hook — no "I'm excited to share" opener
- Use short paragraphs (2–3 sentences max)
- Include a practical framework or numbered insight
- Builder/founder credibility angle — South African context where relevant
- End with a genuine question to drive comments
- Return as JSON: { "text": "full post text" }`,

  instagram: `Generate an Instagram caption and visual brief. Rules:
- Caption: 80–150 words, punchy, first sentence is the hook
- 3–5 relevant hashtags at the end (niche, not spam)
- Visual brief: describe the image or carousel in detail for generation (mood, colours, layout, text overlay)
- Return as JSON: { "caption": "...", "visualBrief": "..." }`,

  youtube: `Generate a YouTube video outline. Rules:
- Title: 50–60 chars, curiosity-driven, SEO-aware
- Description: 200 words, first 2 sentences must hook before "Show more"
- Script: Hook (30s) → Problem (60s) → Framework (3 min) → Examples (2 min) → CTA (30s)
- 10–15 tags, mix of broad and niche
- Return as JSON: { "title": "...", "description": "...", "script": "...", "tags": ["..."] }`,
};

export async function generateContent(
  signal: BrandSignal,
  platforms: Platform[],
  voiceModel: VoiceModel
): Promise<PlatformContent> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for BrandOS content generation");
  }

  const examplesText = voiceModel.examples
    .slice(0, 5)
    .map((e: { platform: Platform; content: string }) => `Platform: ${e.platform}\nContent: ${e.content}`)
    .join("\n\n---\n\n");

  const results: PlatformContent = {};

  for (const platform of platforms) {
    const messages = [
      {
        role: "system" as const,
        content: `${voiceModel.systemPrompt}\n\nHere are examples of high-performing content in this voice:\n\n${examplesText}`,
      },
      {
        role: "user" as const,
        content: `Signal source: ${signal.source}
Content pillar: ${signal.pillar}
Raw signal: ${signal.rawContent}

${PLATFORM_INSTRUCTIONS[platform]}

Respond ONLY with valid JSON. No markdown, no explanation.`,
      },
    ];

    const response = await fetch(`${OPENAI_API_BASE.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        temperature: 0.8,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI error for ${platform}: ${response.status} ${text}`);
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content?.trim() ?? "";

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      switch (platform) {
        case "x":
          results.x = parsed as PlatformContent["x"];
          break;
        case "linkedin":
          results.linkedin = parsed as PlatformContent["linkedin"];
          break;
        case "instagram":
          results.instagram = parsed as PlatformContent["instagram"];
          break;
        case "youtube":
          results.youtube = parsed as PlatformContent["youtube"];
          break;
      }
    } catch {
      throw new Error(`Failed to parse JSON for ${platform}: ${raw.slice(0, 200)}`);
    }
  }

  return results;
}
