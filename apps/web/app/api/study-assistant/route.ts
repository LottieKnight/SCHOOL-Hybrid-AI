import {
  buildAssistantModeInstruction,
  buildLanguageInstruction,
  getAssistantValidationError,
  mapAssistantUpstreamError,
  type AssistantMode,
} from "@/lib/assistant";
import {
  checkSemanticCache,
  embedQuery,
  getRAGContext,
  incrementCacheHits,
  storeInSemanticCache,
  type RAGDocument,
  type RAGFilter,
} from "@/lib/rag";
import { redis } from "@/lib/redis";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { getUserAppPreferences, readAcademicState, readLanguagePreference, SA_LANGUAGES } from "@/lib/server/userProfileState";
import { checkAiRateLimit, checkAiDailyLimit, getAiDailyUsage, isPaidAccess } from "@/lib/aiRateLimit";
import { checkAnonymousAiLimit } from "@/lib/aiAnonymousLimit";
import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { captureLearningSession } from "@/lib/learning/capture";

// Generation backend — prefers local Ollama GPU, falls back to Anthropic in production.
const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL ?? "").replace(/\/+$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2:3b";
const OPENAI_API_BASE =
  process.env.OPENAI_API_BASE && process.env.OPENAI_API_BASE.trim().length > 0
    ? process.env.OPENAI_API_BASE.replace(/\/+$/, "")
    : "https://api.openai.com/v1";
const OPENAI_MODEL = process.env.OPENAI_MODEL && process.env.OPENAI_MODEL.trim().length > 0
  ? process.env.OPENAI_MODEL
  : "gpt-4o-mini";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  const userAccess = session?.user
    ? { planType: session.user.planType, planStatus: session.user.planStatus }
    : null;
  const paid = userAccess ? isPaidAccess(userAccess) : false;
  if (!userId || paid) {
    return NextResponse.json({ paid: true });
  }
  const usage = await getAiDailyUsage(userId);
  return NextResponse.json({ paid: false, ...usage });
}


type AssistantResult = {
  explanation?: string;
  summary?: string;
  quiz?: {
    questions: Array<{ question: string; answer: string }>;
  };
};

type GroundingSource = {
  id: string;
  label: string;
  subject: string | null;
  grade: number | null;
  curriculum: string | null;
  similarity: number;
};

type GroundingEvidence = {
  grounded: boolean;
  confidence: "high" | "medium" | "low";
  boundary: string;
  sources: GroundingSource[];
};

// OpenAI-compatible response shape (used by both Ollama and Anthropic paths).
type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>;
  error?: { message: string };
};

const SYSTEM_PROMPT = `
You are a study assistant for South African students following the CAPS curriculum.
You help learners from Grade R through Grade 12, and university students.

Your rules:
- When CURRICULUM CONTEXT is provided, use it as your primary source for answering.
- If the context does not cover the topic, say so clearly and answer from general knowledge.
- Adapt language and explanation depth to the student's apparent level.
- Use South African examples (Stats SA data, SARB policy, Rand prices) where helpful.
- Keep responses clear and structured for revision and learning.
- For quiz mode: write questions strictly based on the student's material.
`.trim();

const SOCRATIC_ADDENDUM = `
SOCRATIC MODE: Do not provide direct answers. Instead, ask thoughtful guiding questions
that lead the student to work it out themselves.
`.trim();

function metadataText(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function buildGroundingEvidence(sources: Array<{ id: string; metadata: Record<string, unknown>; similarity: number }>): GroundingEvidence {
  const maxSimilarity = sources.reduce((max, source) => Math.max(max, Number(source.similarity) || 0), 0);
  const confidence: GroundingEvidence["confidence"] = sources.length === 0
    ? "low"
    : maxSimilarity >= 0.72 && sources.length >= 2
      ? "high"
      : maxSimilarity >= 0.5
        ? "medium"
        : "low";

  return {
    grounded: sources.length > 0,
    confidence,
    boundary: sources.length > 0
      ? "This answer is anchored to retrieved curriculum material. Check the source labels when revising."
      : "No matching curriculum source was retrieved. Treat this as a general explanation and verify it against your course material.",
    sources: sources.map((source) => {
      const metadata = source.metadata ?? {};
      const title = metadataText(metadata, ["title", "document_title", "source_label", "file_path"]);
      const subject = metadataText(metadata, ["subject", "subject_name"]);
      const curriculum = metadataText(metadata, ["curriculum", "curriculum_name"]);
      const gradeValue = metadata.grade ?? metadata.grade_level;
      const grade = Number.isFinite(Number(gradeValue)) ? Number(gradeValue) : null;
      return {
        id: String(source.id),
        label: title || [subject, grade ? `Grade ${grade}` : null, curriculum].filter(Boolean).join(" · ") || "CAPS curriculum source",
        subject,
        grade,
        curriculum,
        similarity: Math.round((Number(source.similarity) || 0) * 100) / 100,
      };
    }),
  };
}

export async function POST(request: NextRequest) {
  if (!OLLAMA_BASE_URL && !OPENAI_API_KEY && !ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "No generation backend configured. Set OLLAMA_BASE_URL (local GPU), OPENAI_API_KEY (production), or ANTHROPIC_API_KEY (production)." },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const req = body as {
    material?: unknown;
    mode?: unknown;
    subject?: unknown;
    grade?: unknown;
    sessionId?: unknown;
    socratic?: unknown;
  };

  if (typeof req.material !== "string" || !req.material.trim()) {
    return NextResponse.json(
      { error: "Body must include a non-empty 'material' string." },
      { status: 400 }
    );
  }

  const material = req.material.trim();
  const validationError = getAssistantValidationError(material);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const rawMode = req.mode as AssistantMode | undefined;
  const mode: AssistantMode =
    rawMode === "explain" || rawMode === "quiz" || rawMode === "mixed"
      ? rawMode
      : "mixed";

  const socratic = req.socratic === true;

  const incomingSessionId =
    typeof req.sessionId === "string"
      ? req.sessionId.trim()
      : request.headers.get("x-session-id")?.trim() ?? "";
  const sessionId = incomingSessionId || randomUUID();

  // Resolve subject and grade — prefer request body, fall back to user profile.
  const subject =
    typeof req.subject === "string" && req.subject.trim()
      ? req.subject.trim().toLowerCase()
      : undefined;
  let grade =
    typeof req.grade === "number" && req.grade > 0 ? req.grade : undefined;

  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  const userAccess = session?.user
    ? { planType: session.user.planType, planStatus: session.user.planStatus }
    : null;
  const paid = userAccess ? isPaidAccess(userAccess) : false;

  if (!userId) {
    // Anonymous callers have no trusted user identity, so the client-side
    // guest allowance (localStorage) is not a security boundary. Enforce a
    // server-side bucket keyed on the proxy-set client network identity.
    const anon = await checkAnonymousAiLimit(request.headers);
    if (!anon.allowed) {
      return NextResponse.json(
        {
          error:
            anon.reason === "daily"
              ? "You've reached today's free anonymous AI limit. Create a free account for more generations."
              : "Too many requests. Please wait a moment before trying again.",
          anonymousLimitReached: true,
        },
        { status: 429, headers: { "Retry-After": String(anon.retryAfter) } }
      );
    }
  }

  if (userId) {
    const rateCheck = await checkAiRateLimit(userId);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many AI requests. Please wait a moment before trying again." },
        { status: 429, headers: { "Retry-After": String(rateCheck.retryAfter) } }
      );
    }
  }

  let dailyRemaining: number | undefined;
  if (userId && !paid) {
    const dailyCheck = await checkAiDailyLimit(userId);
    dailyRemaining = dailyCheck.remaining;
    if (!dailyCheck.allowed) {
      return NextResponse.json(
        {
          error: "You've reached today's free AI generation limit. Your daily cap resets in a few hours — or upgrade for unlimited generations.",
          dailyLimitReached: true,
          dailyRemaining: 0,
          dailyLimit: dailyCheck.limit,
        },
        { status: 429, headers: { "Retry-After": String(dailyCheck.retryAfter), "X-Daily-Remaining": "0" } }
      );
    }
  }

  let languageInstruction = "";
  if (userId) {
    try {
      const prefs = await getUserAppPreferences(userId);
      if (!grade) grade = readAcademicState(prefs).grade ?? undefined;
      const langCode = readLanguagePreference(prefs);
      languageInstruction = buildLanguageInstruction(SA_LANGUAGES[langCode]);
    } catch {
      // ignore profile failures
    }
  }

  const ragFilter: RAGFilter = {
    ...(subject ? { subject } : {}),
    ...(grade ? { grade } : {}),
    curriculum: "CAPS",
    country: "ZA",
  };

  const cacheKey = createHash("sha256")
    .update(
      `study-assistant:${mode}:${socratic}:${JSON.stringify(ragFilter)}:${material.slice(0, 500)}`
    )
    .digest("hex");

  // Layer 1: Redis exact-match cache (fastest — no GPU needed).
  try {
    const cached = redis ? await redis.get(cacheKey) : null;
    if (cached) {
      const headers: Record<string, string> = { "X-Cache": "HIT", "X-Session-Id": sessionId };
      if (dailyRemaining !== undefined) headers["X-Daily-Remaining"] = String(dailyRemaining);
      return NextResponse.json(JSON.parse(cached), { headers });
    }
  } catch {
    // ignore cache errors — continue to fresh call
  }

  // Embed the query once — reused for both the semantic cache lookup and RAG retrieval.
  let queryEmbedding: number[] | null = null;
  try {
    queryEmbedding = await embedQuery(material.slice(0, 2000));
  } catch {
    // Embedding server down — skip semantic cache, continue without RAG context.
  }

  // Layer 2: Semantic cache — catches similar-but-not-identical queries across sessions.
  if (queryEmbedding) {
    try {
      const semCached = await checkSemanticCache(queryEmbedding, ragFilter);
      if (semCached) {
        // Fire-and-forget hit counter — do not block the response.
        incrementCacheHits(semCached.id).catch(() => {});
        return NextResponse.json(semCached.response, {
          headers: {
            "X-Cache": "SEMANTIC-HIT",
            "X-Session-Id": sessionId,
            "X-Cache-Similarity": semCached.similarity.toFixed(3),
            ...(dailyRemaining !== undefined ? { "X-Daily-Remaining": String(dailyRemaining) } : {}),
          },
        });
      }
    } catch {
      // Supabase unreachable — continue to full pipeline.
    }
  }

  // RAG retrieval — pass the pre-computed embedding to avoid a second GPU call.
  let ragContext = "";
  let sourcesFound = 0;
  let ragSources: RAGDocument[] = [];
  try {
    const { context, sources } = await getRAGContext(
      material.slice(0, 1000),
      ragFilter,
      5,
      queryEmbedding ?? undefined
    );
    ragContext = context;
    ragSources = sources;
    sourcesFound = sources.length;
  } catch {
    // Embedding server down or Supabase unreachable — continue without context.
  }

  const contextBlock = ragContext
    ? `\n\nCURRICULUM CONTEXT (CAPS-aligned — use where relevant to the student's question):\n\n${ragContext}`
    : "";

  let systemPrompt = `${SYSTEM_PROMPT}${contextBlock}`;
  if (socratic) {
    systemPrompt = `${systemPrompt}\n\n${SOCRATIC_ADDENDUM}`;
  }
  if (languageInstruction) {
    systemPrompt = `${systemPrompt}\n\n${languageInstruction}`;
  }

  const truncatedMaterial =
    material.length > 8000 ? material.slice(0, 8000) : material;
  const modeInstruction = buildAssistantModeInstruction(mode);

  const userMessage = [
    "STUDENT MATERIAL:",
    "",
    truncatedMaterial,
    "",
    modeInstruction,
    "Respond ONLY with valid JSON matching the described shape.",
    "No markdown fences, no text outside the JSON object.",
  ].join("\n");

  type OpenAIChatResponse = {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  let response: Response;
  let rawContent = "";

  if (OLLAMA_BASE_URL) {
    // --- Local GPU path via Ollama (dev) ---
    try {
      response = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          response_format: { type: "json_object" },
          temperature: mode === "quiz" ? 0.3 : 0.5,
          stream: false,
        }),
      });
    } catch {
      return NextResponse.json(
        { error: "Ollama is not running. Start it with: python scripts/embedding_server.py && ollama serve" },
        { status: 502, headers: { "X-Session-Id": sessionId } }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `Ollama error: ${response.status}` },
        { status: 502, headers: { "X-Session-Id": sessionId } }
      );
    }

    const ollamaData = (await response.json().catch(() => ({}))) as ChatCompletionResponse;
    rawContent = ollamaData.choices?.[0]?.message?.content?.trim() ?? "";
  } else if (OPENAI_API_KEY) {
    try {
      response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          response_format: { type: "json_object" },
          temperature: mode === "quiz" ? 0.3 : 0.5,
          max_tokens: 1200,
        }),
      });
    } catch {
      return NextResponse.json(
        { error: "Failed to reach the AI provider. Please try again shortly." },
        { status: 502, headers: { "X-Session-Id": sessionId } }
      );
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      const mappedError = mapAssistantUpstreamError(response.status, errText);
      return NextResponse.json(
        { error: mappedError.error },
        { status: mappedError.status, headers: { "X-Session-Id": sessionId } }
      );
    }

    const openAIData = (await response.json().catch(() => ({}))) as OpenAIChatResponse;
    rawContent = openAIData.choices?.[0]?.message?.content?.trim() ?? "";
  } else {
    // --- Anthropic API path (production fallback) ---
    try {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
          "x-api-key": ANTHROPIC_API_KEY,
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 1200,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        }),
      });
    } catch {
      return NextResponse.json(
        { error: "Failed to reach the AI provider. Please try again shortly." },
        { status: 502, headers: { "X-Session-Id": sessionId } }
      );
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      let detail = `AI provider error: ${response.status}`;
      try {
        const parsed = JSON.parse(errText) as AnthropicResponse;
        if (parsed.error?.message) detail = parsed.error.message;
      } catch { /* use default */ }
      return NextResponse.json(
        { error: detail },
        { status: 502, headers: { "X-Session-Id": sessionId } }
      );
    }

    const anthropicData = (await response.json().catch(() => ({}))) as AnthropicResponse;
    rawContent = anthropicData.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
  }

  if (!rawContent) {
    return NextResponse.json(
      { error: "AI provider returned an empty response." },
      { status: 502, headers: { "X-Session-Id": sessionId } }
    );
  }

  let parsed: AssistantResult;
  const cleaned = rawContent
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    parsed = JSON.parse(cleaned) as AssistantResult;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        parsed = JSON.parse(cleaned.slice(start, end + 1)) as AssistantResult;
      } catch {
        return NextResponse.json(
          { error: "Failed to parse JSON from model response." },
          { status: 502, headers: { "X-Session-Id": sessionId } }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Model response was not valid JSON." },
        { status: 502, headers: { "X-Session-Id": sessionId } }
      );
    }
  }

  if (!parsed.quiz) {
    parsed.quiz = { questions: [] };
  } else if (!Array.isArray(parsed.quiz.questions)) {
    parsed.quiz.questions = [];
  }

  const result = {
    result: parsed,
    sources_found: sourcesFound,
    rag_context_used: sourcesFound > 0,
    grounding: buildGroundingEvidence(ragSources),
  };

  try {
    if (redis) {
      // 1-hour TTL — shorter than the existing assistant route (24h) because
      // RAG context may grow as new CAPS content is ingested.
      await redis.setex(cacheKey, 3600, JSON.stringify(result));
    }
  } catch {
    // ignore cache write failures
  }

  // Semantic cache write — fire-and-forget, must not block the response.
  if (queryEmbedding) {
    storeInSemanticCache(
      material.slice(0, 500),
      queryEmbedding,
      ragFilter,
      result as unknown as Record<string, unknown>
    ).catch(() => {});
  }

  let learningCapture: { sessionId: string; artifactId: string } | null = null;
  if (userId) {
    try {
      learningCapture = await captureLearningSession({
        userId,
        kind: "assistant",
        title: `AI Study Coach · ${subject || "general study"}`,
        subject: subject || null,
        sourceType: "assistant_session",
        sourceId: sessionId,
        takeaways: [
          parsed.summary?.trim() || "Completed an AI Study Coach exchange.",
          sourcesFound > 0 ? `Grounded in ${sourcesFound} curriculum source${sourcesFound === 1 ? "" : "s"}.` : "No curriculum source was matched; verify the explanation independently.",
        ],
        nextAction: "Turn one idea from this exchange into a practice question or revision note.",
        evidence: [{ type: "ai_study_coach", label: sourcesFound > 0 ? `${sourcesFound} curriculum source${sourcesFound === 1 ? "" : "s"}` : "General explanation" }, ...buildGroundingEvidence(ragSources).sources.slice(0, 3).map((source) => ({ type: "curriculum_anchor", label: source.label }))],
      });
    } catch {
      // Learning capture is best-effort and must not delay a valid AI response.
    }
  }

  return NextResponse.json({ ...result, learningCapture }, {
    status: 200,
    headers: {
      "X-Cache": "MISS",
      "X-Session-Id": sessionId,
      "X-Sources-Found": String(sourcesFound),
      ...(dailyRemaining !== undefined ? { "X-Daily-Remaining": String(dailyRemaining) } : {}),
    },
  });
}
