import { rewriteText } from '@/lib/language/service';
import { insertLanguageRewriteEvent } from '@/lib/server/languageEvents';
import { getBackendSessionFromRequest } from '@/lib/server/backendSession';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = rewriteText(body);
  const session = await getBackendSessionFromRequest(request).catch(() => null);
  const userId = typeof session?.user?.id === 'string' ? session.user.id : null;
  const sessionId = request.headers.get('x-session-id');
  const first = result.outputs[0];

  if (first && typeof body?.text === 'string') {
    void insertLanguageRewriteEvent({
      userId,
      sessionId,
      sourceSurface: typeof body?.surface === 'string' ? body.surface : 'writer',
      moduleCode: typeof body?.moduleCode === 'string' ? body.moduleCode : null,
      rewriteMode: typeof body?.mode === 'string' ? body.mode : 'unknown',
      originalText: body.text,
      outputText: first.text,
      confidenceScore: first.confidence,
      metadata: {
        notes: first.notes ?? [],
      },
    });
  }

  return NextResponse.json(result);
}
