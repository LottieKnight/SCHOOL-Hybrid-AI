import { submitFeedback } from '@/lib/language/service';
import { insertLanguageFeedbackEvent } from '@/lib/server/languageEvents';
import { getBackendSessionFromRequest } from '@/lib/server/backendSession';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const session = await getBackendSessionFromRequest(request).catch(() => null);
  const userId = typeof session?.user?.id === 'string' ? session.user.id : null;
  const sessionId = request.headers.get('x-session-id');

  void insertLanguageFeedbackEvent({
    userId,
    sessionId,
    eventType: typeof body?.eventType === 'string' ? body.eventType : 'unknown',
    sourceSurface: typeof body?.surface === 'string' ? body.surface : 'unknown',
    requestId: typeof body?.requestId === 'string' ? body.requestId : null,
    outputId: typeof body?.outputId === 'string' ? body.outputId : null,
    accepted: typeof body?.accepted === 'boolean' ? body.accepted : null,
    editedAfterAccept: Boolean(body?.editedAfterAccept),
    rating: typeof body?.rating === 'number' ? body.rating : null,
    note: typeof body?.note === 'string' ? body.note : null,
    metadata: typeof body?.metadata === 'object' && body?.metadata !== null ? body.metadata : {},
  });

  return NextResponse.json(submitFeedback(body));
}
