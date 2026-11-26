import { NextRequest, NextResponse } from "next/server";
import {
  appendMemoryEvent,
  MEMORY_EVENT_TYPES,
  MEMORY_SOURCE_TYPES,
  type MemoryEventType,
  type MemorySourceType,
} from "@/lib/memory";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MemoryEventBody = {
  module_code?: unknown;
  event_type?: unknown;
  source_type?: unknown;
  concept_key?: unknown;
  resource_id?: unknown;
  quiz_attempt_id?: unknown;
  session_id?: unknown;
  event_weight?: unknown;
  is_new_concept?: unknown;
  metadata?: unknown;
};

function isEventType(value: unknown): value is MemoryEventType {
  return typeof value === "string" && (MEMORY_EVENT_TYPES as readonly string[]).includes(value);
}

function isSourceType(value: unknown): value is MemorySourceType {
  return typeof value === "string" && (MEMORY_SOURCE_TYPES as readonly string[]).includes(value);
}

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: MemoryEventBody;
  try {
    body = (await request.json()) as MemoryEventBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isEventType(body.event_type) || !isSourceType(body.source_type)) {
    return NextResponse.json({ error: "event_type and source_type are required." }, { status: 400 });
  }

  const event = await appendMemoryEvent({
    userId,
    moduleCode: typeof body.module_code === "string" ? body.module_code : null,
    eventType: body.event_type,
    sourceType: body.source_type,
    conceptKey: typeof body.concept_key === "string" ? body.concept_key : null,
    resourceId: typeof body.resource_id === "string" ? body.resource_id : null,
    quizAttemptId: typeof body.quiz_attempt_id === "string" ? body.quiz_attempt_id : null,
    sessionId: typeof body.session_id === "string" ? body.session_id : null,
    eventWeight:
      typeof body.event_weight === "number" && Number.isFinite(body.event_weight) ? body.event_weight : undefined,
    isNewConcept: typeof body.is_new_concept === "boolean" ? body.is_new_concept : undefined,
    metadata: typeof body.metadata === "object" && body.metadata !== null ? (body.metadata as Record<string, unknown>) : {},
  });

  if (!event) {
    return NextResponse.json({ error: "Unable to append memory event." }, { status: 500 });
  }

  return NextResponse.json({ success: true, event }, { status: 201 });
}
