import { parseTopicSignalBody } from "@/lib/sessionTopicSignal";
import { storeTopicSignal } from "@/lib/server/sessionTopics";

const OPENAI_API_BASE =
  process.env.OPENAI_API_BASE ??
  "https://api.openai.com/v1";

export type TopicSignal = {
  topic: string;
  subject: string;
  grade_inferred: number | null;
  weakness_detected: boolean;
  difficulty_level: number;
};

export async function extractTopicSignal(
  studentInput: string,
  sessionId: string,
  userId: string
): Promise<void> {
  void extractAsync(studentInput, sessionId, userId)
    .catch((error) => console.error("Topic extraction failed:", error));
}

async function extractAsync(
  input: string,
  sessionId: string,
  userId: string
): Promise<void> {
  const prompt = `Analyze this student study input 
and return only valid JSON with no markdown:
{
  "topic": "specific topic name",
  "subject": "school subject name",
  "grade_inferred": null or grade number 1-12,
  "weakness_detected": true or false,
  "difficulty_level": 1 to 5
}

weakness_detected is true if the student expresses
confusion, asks the same thing multiple ways, or
the topic is typically difficult.

Student input: "${input.slice(0, 500)}"`;

  try {
    const response = await fetch(
      `${OPENAI_API_BASE}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model:
            process.env.OPENAI_MODEL ?? "gpt-4o-mini",
          max_tokens: 150,
          temperature: 0,
          messages: [{ role: "user", content: prompt }],
        }),
      }
    );

    if (!response.ok) return;
    const data = await response.json();
    const raw = data.content?.[0]?.text
      ?? data.choices?.[0]?.message?.content
      ?? "{}";

    let signal: TopicSignal;
    try {
      signal = JSON.parse(
        String(raw).replace(/```json|```/g, "").trim()
      ) as TopicSignal;
    } catch {
      return;
    }

    const parsed = parseTopicSignalBody({ sessionId, ...signal }, userId);
    if (!parsed.ok) return;
    await storeTopicSignal(parsed.value);
  } catch {
    // Silently fail — never block main response
  }
}
