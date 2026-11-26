import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_API_BASE =
  process.env.OPENAI_API_BASE?.trim().replace(/\/+$/, "") ?? "https://api.openai.com/v1";
const OPENAI_MODEL =
  process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

type GameType = "debate_clock" | "plain_language";

const PROMPTS: Record<GameType, (body: Record<string, string>) => string> = {
  debate_clock: ({ statement, argument }) =>
    `Score this counter-argument on three dimensions: relevance (0-10), evidence (0-10), clarity (0-10). ` +
    `Respond ONLY with valid JSON — no markdown, no explanation outside the JSON object: ` +
    `{"relevance": N, "evidence": N, "clarity": N, "feedback": "one sentence"}. ` +
    `Statement: "${statement}". Counter-argument: "${argument}"`,

  plain_language: ({ original, rewrite }) =>
    `Score this plain-language rewrite on three dimensions: clarity (did it simplify? 0-10), ` +
    `accuracy (did it preserve meaning? 0-10), conciseness (is it shorter/tighter? 0-10). ` +
    `Respond ONLY with valid JSON — no markdown, no explanation outside the JSON object: ` +
    `{"clarity": N, "accuracy": N, "conciseness": N, "feedback": "one sentence"}. ` +
    `Original: "${original}". Rewrite: "${rewrite}"`,
};

function extractJson(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[^{}]+\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]) as Record<string, unknown>; }
  catch { return null; }
}

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI scoring unavailable", fallback: true }, { status: 503 });
  }

  let body: Record<string, string>;
  try { body = (await request.json()) as Record<string, string>; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const { gameType, ...fields } = body;
  if (!gameType || !(gameType in PROMPTS)) {
    return NextResponse.json({ error: "Unknown gameType" }, { status: 400 });
  }

  const prompt = PROMPTS[gameType as GameType](fields);

  try {
    const res = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 120,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "AI scoring unavailable", fallback: true }, { status: 503 });
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(content);

    if (!parsed) {
      return NextResponse.json({ error: "Parse error", fallback: true }, { status: 200 });
    }

    return NextResponse.json({ scores: parsed });
  } catch {
    return NextResponse.json({ error: "AI scoring unavailable", fallback: true }, { status: 503 });
  }
}
