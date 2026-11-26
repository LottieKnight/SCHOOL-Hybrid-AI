import { NextResponse } from 'next/server';

export async function GET() {
  // Simple health check – can be expanded later (DB ping, etc.)
  return NextResponse.json({ status: 'ok' });
}
