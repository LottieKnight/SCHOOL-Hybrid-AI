import { explainConcept } from '@/lib/language/service';
import { explainFromGeneratedModuleContent } from '@/lib/server/languageContent';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const grounded = explainFromGeneratedModuleContent({
    moduleCode: typeof body?.moduleCode === 'string' ? body.moduleCode : null,
    term: typeof body?.text === 'string' ? body.text : '',
  });
  const fallback = explainConcept(body);

  return NextResponse.json(
    grounded
      ? {
          ...fallback,
          explanation: grounded.explanation,
          sourceRefs: grounded.sourceRefs,
          relatedTerms: grounded.relatedTerms,
          debug: {
            strategy: typeof body?.moduleCode === 'string' ? 'explicit-module-grounding' : 'cross-module-inference',
            grounded: true,
            sourceCount: grounded.sourceRefs.length,
          },
        }
      : {
          ...fallback,
          debug: {
            strategy: 'fallback-glossary',
            grounded: false,
            sourceCount: 0,
          },
        }
  );
}
