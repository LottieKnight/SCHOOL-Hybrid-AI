import { NextResponse } from 'next/server';

// Mock login endpoint – in a real app this would redirect to Okta
export async function GET() {
  // Normally you would generate an Okta auth URL here.
  // For now we just return a stub URL for the frontend to use.
  const mockOktaAuthUrl = 'https://example.okta.com/oauth2/v1/authorize?client_id=FAKE&redirect_uri=http://localhost:3000/api/auth/callback&response_type=code&scope=openid profile email';
  return NextResponse.json({ authUrl: mockOktaAuthUrl });
}
