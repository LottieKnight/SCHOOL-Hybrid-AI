import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";

const OPENAI_API_BASE =
  process.env.OPENAI_API_BASE && process.env.OPENAI_API_BASE.trim().length > 0
    ? process.env.OPENAI_API_BASE.replace(/\/+$/, "")
    : "https://api.openai.com/v1";

const OPENAI_MODEL =
  process.env.OPENAI_MODEL && process.env.OPENAI_MODEL.trim().length > 0
    ? process.env.OPENAI_MODEL
    : "gpt-4o-mini";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { terms } = body;

  if (!Array.isArray(terms) || terms.length === 0) {
    return NextResponse.json({ error: "Terms must be a non-empty array" }, { status: 400 });
  }

  const systemPrompt = "You are a learning scientist. Your job is to create memorable mnemonics (acronyms, stories, or songs) for students to help them remember complex lists of terms. Keep them funny, catchy, and highly effective for South African students.";

  try {
    const res = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Create a mnemonic for these terms: ${terms.join(", ")}` }
        ],
        temperature: 0.8,
        max_tokens: 500,
      }),
    });

    const data = await res.json();
    const mnemonic = data.choices?.[0]?.message?.content?.trim();

    return NextResponse.json({ mnemonic });
  } catch (error) {
    console.error("Mnemonic generation failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
