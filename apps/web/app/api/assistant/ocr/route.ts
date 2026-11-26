import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";

const OPENAI_API_BASE = process.env.OPENAI_API_BASE || "https://api.openai.com/v1";
const OPENAI_MODEL = "gpt-4o-mini"; // Or gpt-4o for better vision

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { image } = body; // Base64 image data

  if (!image) return NextResponse.json({ error: "Missing image" }, { status: 400 });

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
          {
            role: "user",
            content: [
              { type: "text", text: "Solve this academic problem step-by-step. If it's a math equation, show the working. If it's a diagram, explain the components." },
              { type: "image_url", image_url: { url: image } }
            ],
          },
        ],
        max_tokens: 1000,
      }),
    });

    const data = await res.json();
    const solution = data.choices?.[0]?.message?.content;

    return NextResponse.json({ solution });
  } catch (error) {
    console.error("OCR failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
