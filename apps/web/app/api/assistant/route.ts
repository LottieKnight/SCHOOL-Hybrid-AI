import {
  buildAssistantModeInstruction,
  buildLanguageInstruction,
  getAssistantValidationError,
  mapAssistantUpstreamError,
  type AssistantMode,
} from "@/lib/assistant";
import { getCurrentPeriod } from "@/lib/academicPeriod";
import {
  appendMemoryEvent,
  buildMemoryPromptBlock,
  extractMemoryConcept,
  getMemorySummary,
} from "@/lib/memory";
import { redis } from "@/lib/redis";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { buildAssistantGroundingBlock } from "@/lib/server/assistantGrounding";
import { getInstitutionContextForUser } from "@/lib/server/institutions";
import { getUserAppPreferences, readAcademicState, readPersonalisationState, readLanguagePreference, SA_LANGUAGES } from "@/lib/server/userProfileState";
import { captureAIError } from "@/lib/sentry";
import { extractTopicSignal } from "@/lib/topicExtractor";
import { checkAiRateLimit, checkAiDailyLimit, isPaidAccess } from "@/lib/aiRateLimit";
import { checkAnonymousAiLimit } from "@/lib/aiAnonymousLimit";
import { recordAiCall } from "@/lib/server/growthDb";
import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_BASE =
  process.env.OPENAI_API_BASE && process.env.OPENAI_API_BASE.trim().length > 0
    ? process.env.OPENAI_API_BASE.replace(/\/+$/, "")
    : "https://api.openai.com/v1";

const OPENAI_MODEL =
  process.env.OPENAI_MODEL && process.env.OPENAI_MODEL.trim().length > 0
    ? process.env.OPENAI_MODEL
    : "gpt-4o-mini";

type AssistantResult = {
  explanation?: string;
  summary?: string;
  quiz?: {
    questions: Array<{ question: string; answer: string }>;
  };
};

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export const runtime = "nodejs";

const SYSTEM_PROMPT = `
You are a study assistant for South African students across two levels:
1) School learners following the CAPS curriculum (Grade R to Grade 12)
2) University students

Your job is to help the student understand their material clearly, accurately, and at the right difficulty level.

Rules you MUST follow:

- Adapt your language and explanation depth to the student's apparent level based on the content provided.
- If the level is not obvious, default to clear, simple explanations without sounding childish.
- When material appears to be CAPS-aligned, structure explanations around the term and topic framework South African learners will recognize.
- Use plain, direct language.
- Do NOT invent information beyond what the student provides.
- Structure responses for learning and revision.
- For quiz mode, create questions and answers based strictly on the student's material.
- When the material appears to be for a younger learner, keep explanations shorter, simpler, and more concrete.
- When the material appears to be university-level, keep explanations precise and academically useful.
`.trim();

function buildInstitutionContextPrompt(input: {
  institutionName?: string;
  faculty?: string | null;
  currentModules?: string[];
  academicPeriodType?: "term" | "semester" | "trimester" | "quarter" | null;
}) {
  const modules = Array.isArray(input.currentModules)
    ? input.currentModules.map((value) => value.trim()).filter(Boolean).slice(0, 8)
    : [];
  const lines: string[] = [];

  if (input.institutionName) {
    lines.push(`- Institution: ${input.institutionName}`);
  }
  if (input.faculty) {
    lines.push(`- Faculty: ${input.faculty}`);
  }
  if (modules.length > 0) {
    lines.push(`- Current modules: ${modules.join(", ")}`);
  }
  if (input.academicPeriodType) {
    const currentPeriod = getCurrentPeriod(input.academicPeriodType);
    lines.push(`- Academic calendar: ${input.academicPeriodType}`);
    lines.push(`- Current period: ${currentPeriod.label}`);
  }

  if (lines.length === 0) {
    return "";
  }

  return [
    "Student academic context:",
    ...lines,
    "Use this context to adapt framing, terminology, examples, and emphasis when it is relevant to the student's material. Do not invent institution-specific facts that are not supported by the student input.",
  ].join("\n");
}

const SOCRATIC_PROMPT = `
SOCRATIC MODE ACTIVE:
- DO NOT provide direct explanations or summaries.
- Instead, respond by asking the student thoughtful, guiding questions.
- Help the student break down the material themselves.
- If they ask for an answer, politely refuse and provide a hint or a question to lead them there.
`.trim();

const MZANSI_PROMPT = `
MZANSI PERSONA ACTIVE:
- Use South African English and common local slang (e.g., 'bra', 'chommie', 'sharp', 'now-now', 'lekker', 'moer') naturally.
- Be friendly, encouraging, and sound like a cool older cousin or mentor from the neighborhood.
- Keep the academic quality high, but make it relatable. Use local examples or metaphors if helpful.
`.trim();

const STRICT_PROMPT = `
STRICT ACADEMIC PERSONA ACTIVE:
- Use formal, precise academic language.
- Be direct, concise, and no-nonsense.
- Focus strictly on the facts and curriculum requirements.
- Maintain a highly professional and authoritative tone.
`.trim();

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const requestBody = body as {
    material?: unknown;
    mode?: unknown;
    sessionId?: unknown;
    socratic?: boolean;
  };

  if (
    !body ||
    typeof body !== "object" ||
    typeof requestBody.material !== "string" ||
    !requestBody.material.trim()
  ) {
    return NextResponse.json(
      { error: "Body must include a non-empty 'material' string." },
      { status: 400 }
    );
  }

  const socratic = !!requestBody.socratic;

  const rawMode = requestBody.mode as AssistantMode | undefined;
  const mode: AssistantMode =
    rawMode === "explain" || rawMode === "quiz" || rawMode === "mixed"
      ? rawMode
      : "mixed";
  const incomingSessionId =
    typeof requestBody.sessionId === "string"
      ? requestBody.sessionId.trim()
      : request.headers.get("x-session-id")?.trim() || "";
  const sessionId = incomingSessionId || randomUUID();
  let sessionHeaders: Record<string, string> = { "X-Session-Id": sessionId };
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";

  if (!userId) {
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
        { status: 429, headers: { "Retry-After": String(anon.retryAfter), ...sessionHeaders } }
      );
    }
  }

  if (userId) {
    const rateCheck = await checkAiRateLimit(userId);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many AI requests. Please wait a moment before trying again." },
        { status: 429, headers: { "Retry-After": String(rateCheck.retryAfter), ...sessionHeaders } }
      );
    }
  }

  const userAccess = session?.user
    ? { planType: session.user.planType, planStatus: session.user.planStatus }
    : null;
  const paid = userAccess ? isPaidAccess(userAccess) : false;
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
        { status: 429, headers: { "Retry-After": String(dailyCheck.retryAfter), ...sessionHeaders, "X-Daily-Remaining": "0" } }
      );
    }
  }

  let grade: number | undefined;
  let institution: string | undefined;
  let assistantSystemPrompt = SYSTEM_PROMPT;
  let institutionId: string | undefined;
  let currentModules: string[] = [];
  let activeMemoryModule: string | null = null;

  if (userId) {
    try {
      const preferences = await getUserAppPreferences(userId);
      const personalisation = readPersonalisationState(preferences);
      const academicState = readAcademicState(preferences);
      const languageCode = readLanguagePreference(preferences);
      const institutionContext = await getInstitutionContextForUser(userId).catch(() => null);
      grade = academicState.grade ?? undefined;
      institution = institutionContext?.name ?? academicState.institution ?? undefined;
      institutionId = institutionContext?.id ?? academicState.institutionId ?? undefined;
      currentModules = institutionContext?.currentModules ?? academicState.selectedSubjects;
      activeMemoryModule = currentModules[0] ?? null;

      const institutionContextPrompt = buildInstitutionContextPrompt({
        institutionName: institutionContext?.name ?? academicState.institution ?? undefined,
        faculty: institutionContext?.faculty ?? academicState.faculty,
        currentModules,
        academicPeriodType: institutionContext?.academicPeriodType ?? academicState.calendarFormat,
      });

      if (institutionContextPrompt) {
        assistantSystemPrompt = `${SYSTEM_PROMPT}\n\n${institutionContextPrompt}`;
      }

      if (personalisation.aiPersona === "mzansi") {
        assistantSystemPrompt = `${assistantSystemPrompt}\n\n${MZANSI_PROMPT}`;
      } else if (personalisation.aiPersona === "strict") {
        assistantSystemPrompt = `${assistantSystemPrompt}\n\n${STRICT_PROMPT}`;
      }

      const languageInstruction = buildLanguageInstruction(SA_LANGUAGES[languageCode]);
      if (languageInstruction) {
        assistantSystemPrompt = `${assistantSystemPrompt}\n\n${languageInstruction}`;
      }

      const memoryPrompt = buildMemoryPromptBlock(await getMemorySummary(userId, activeMemoryModule));
      if (memoryPrompt) {
        assistantSystemPrompt = `${assistantSystemPrompt}\n\n${memoryPrompt}`;
      }
    } catch {
      // Ignore profile lookup issues for Sentry context.
    }
  }

  if (socratic) {
    assistantSystemPrompt = `${assistantSystemPrompt}\n\n${SOCRATIC_PROMPT}`;
  }

  const material = requestBody.material.trim();
  const validationError = getAssistantValidationError(material);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400, headers: sessionHeaders });
  }

  const truncatedMaterial = material.length > 8000 ? material.slice(0, 8000) : material;
  const groundingBlock = buildAssistantGroundingBlock({
    moduleCode: activeMemoryModule,
    material: truncatedMaterial,
  });
  const modeInstruction = buildAssistantModeInstruction(mode);
  const promptHash = createHash("sha256").update(`${assistantSystemPrompt}\n${groundingBlock}`).digest("hex");
  const cacheKey = createHash("sha256")
    .update(`assistant:${userId || "anon"}:${mode}:${socratic}:${promptHash}:${material.slice(0, 500)}`)
    .digest("hex");

  try {
    const cached = redis ? await redis.get(cacheKey) : null;
    if (cached) {
      const memoryConcept = userId
        ? await extractMemoryConcept({
            material,
            institutionId,
            currentModules,
          })
        : { conceptKey: null, conceptLabel: null, moduleCode: activeMemoryModule };
      const memoryEvent =
        userId && memoryConcept.conceptKey
          ? await appendMemoryEvent({
              userId,
              moduleCode: memoryConcept.moduleCode,
              eventType: "assistant_question",
              sourceType: "assistant",
              conceptKey: memoryConcept.conceptKey,
              sessionId,
              metadata: {
                mode,
                cacheStatus: "HIT",
              },
            })
          : null;
      if (memoryConcept.conceptKey) {
        sessionHeaders = {
          ...sessionHeaders,
          "X-Memory-Concept-Key": memoryConcept.conceptKey,
          "X-Memory-Concept-Label": memoryConcept.conceptLabel ?? memoryConcept.conceptKey,
          "X-Memory-Is-New-Concept": memoryEvent?.is_new_concept ? "true" : "false",
        };
      }
      if (sessionId && userId) {
        extractTopicSignal(material, sessionId, userId);
      }
      return NextResponse.json(JSON.parse(cached), {
        headers: {
          "X-Cache": "HIT",
          ...sessionHeaders,
          ...(dailyRemaining !== undefined ? { "X-Daily-Remaining": String(dailyRemaining) } : {}),
        },
      });
    }
  } catch {
    // Ignore cache failures and continue to the provider call.
  }

  const messages = [
    {
      role: "system" as const,
      content: assistantSystemPrompt,
    },
    {
      role: "user" as const,
      content: `
STUDENT MATERIAL (exact text, do not add external facts):

${truncatedMaterial}

${modeInstruction}
Respond ONLY with valid JSON that matches the described shape. Do not include markdown, commentary, or any text outside the JSON object.
      `.trim(),
    },
  ];

  const memoryConcept = userId
    ? await extractMemoryConcept({
        material,
        institutionId,
        currentModules,
      })
    : { conceptKey: null, conceptLabel: null, moduleCode: activeMemoryModule };

  const groundedSystemPrompt = buildAssistantGroundingBlock({
    moduleCode: memoryConcept.moduleCode ?? activeMemoryModule,
    material: truncatedMaterial,
  })
    ? `${assistantSystemPrompt}\n\n${buildAssistantGroundingBlock({
        moduleCode: memoryConcept.moduleCode ?? activeMemoryModule,
        material: truncatedMaterial,
      })}`
    : assistantSystemPrompt;

  messages[0] = {
    role: "system",
    content: groundedSystemPrompt,
  };

  recordAiCall(); // fire-and-forget counter for growth dashboard

  let response: Response;
  try {
    response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        temperature: mode === "quiz" ? 0.3 : 0.5,
        max_tokens: 1200,
      }),
    });
  } catch (error) {
    captureAIError(error instanceof Error ? error : new Error("Assistant provider request failed."), {
      mode,
      inputLength: material.length,
      grade,
      institution,
    });
    return NextResponse.json(
      { error: "Failed to reach the AI provider. Please try again shortly." },
      { status: 502, headers: sessionHeaders }
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    captureAIError(new Error(`Assistant provider responded with status ${response.status}.`), {
      mode,
      inputLength: material.length,
      grade,
      institution,
    });
    const mappedError = mapAssistantUpstreamError(response.status, text);
    return NextResponse.json(
      { error: mappedError.error },
      { status: mappedError.status, headers: sessionHeaders }
    );
  }

  const data = (await response.json().catch(() => ({}))) as OpenAIChatResponse;
  const rawContent = data.choices?.[0]?.message?.content?.trim() ?? "";

  if (!rawContent) {
    return NextResponse.json(
      { error: "OpenAI returned an empty response." },
      { status: 502, headers: sessionHeaders }
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
          {
            error: "Failed to parse JSON from model response.",
          },
          { status: 502, headers: sessionHeaders }
        );
      }
    } else {
      return NextResponse.json(
        {
          error: "Model response was not valid JSON.",
        },
        { status: 502, headers: sessionHeaders }
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
  };

  try {
    if (redis) {
      await redis.setex(cacheKey, 86400, JSON.stringify(result));
    }
  } catch {
    // Ignore cache failures and return the fresh response.
  }

  const memoryEvent =
    userId && memoryConcept.conceptKey
      ? await appendMemoryEvent({
          userId,
          moduleCode: memoryConcept.moduleCode,
          eventType: "assistant_question",
          sourceType: "assistant",
          conceptKey: memoryConcept.conceptKey,
          sessionId,
          metadata: {
            mode,
            cacheStatus: "MISS",
          },
        })
      : null;

  if (memoryConcept.conceptKey) {
    sessionHeaders = {
      ...sessionHeaders,
      "X-Memory-Concept-Key": memoryConcept.conceptKey,
      "X-Memory-Concept-Label": memoryConcept.conceptLabel ?? memoryConcept.conceptKey,
      "X-Memory-Is-New-Concept": memoryEvent?.is_new_concept ? "true" : "false",
    };
  }

  if (sessionId && userId) {
    extractTopicSignal(material, sessionId, userId);
  }

  return NextResponse.json(result, {
    status: 200,
    headers: {
      "X-Cache": "MISS",
      ...sessionHeaders,
      ...(dailyRemaining !== undefined ? { "X-Daily-Remaining": String(dailyRemaining) } : {}),
    },
  });
}
