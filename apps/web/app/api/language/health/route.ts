import { languageSeedMetadata } from '@/lib/language/service';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ ok: true, seedMetadata: languageSeedMetadata });
}
