import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";

const OPENAI_API_BASE =
  process.env.OPENAI_API_BASE && process.env.OPENAI_API_BASE.trim().length > 0
    ? process.env.OPENAI_API_BASE.replace(/\/+$/, "")
    : "https://api.openai.com/v1";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No audio file provided." }, { status: 400 });
  }

  try {
    // 1. Transcribe with Whisper
    const transcriptionFormData = new FormData();
    transcriptionFormData.append("file", file);
    transcriptionFormData.append("model", "whisper-1");
    transcriptionFormData.append("language", "en"); // Could be dynamic later

    const transcribeRes = await fetch(`${OPENAI_API_BASE}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: transcriptionFormData,
    });

    if (!transcribeRes.ok) {
      const errorText = await transcribeRes.text();
      console.error("Whisper error:", errorText);
      throw new Error("Transcription failed.");
    }

    const { text: transcript } = await transcribeRes.json();

    if (!transcript || transcript.trim().length < 5) {
      return NextResponse.json({ error: "Audio was too short or silent." }, { status: 400 });
    }

    // 2. Summarize with GPT
    const summaryRes = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
You are an expert academic summarizer. 
Create high-quality study notes from the following lecture transcript.
- Use a clear title.
- Use bullet points for key concepts.
- Define important terms.
- Keep it concise but comprehensive.
`.trim(),
          },
          {
            role: "user",
            content: transcript,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!summaryRes.ok) {
      throw new Error("Summarization failed.");
    }

    const summaryData = await summaryRes.json();
    const summary = summaryData.choices?.[0]?.message?.content?.trim() || "";

    return NextResponse.json({ transcript, summary });
  } catch (error) {
    console.error("Voice processing error:", error);
    return NextResponse.json(
      { error: "Failed to process audio. Please try again." },
      { status: 502 }
    );
  }
}
