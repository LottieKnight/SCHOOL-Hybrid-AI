import { correctText } from '@/lib/language/service';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.json();
  return NextResponse.json(correctText(body));
}
