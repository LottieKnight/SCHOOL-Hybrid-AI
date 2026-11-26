import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getServerApiBase } from "@/lib/server/backendApi";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "content-encoding",
  "transfer-encoding",
]);

function buildUpstreamUrl(request: NextRequest, apiPath: string) {
  const url = new URL(`${getServerApiBase()}${apiPath}`);
  url.search = request.nextUrl.search;
  return url;
}

function cloneRequestHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");
  // Prevent the upstream from compressing the response — the proxy strips
  // content-encoding before forwarding, so compressed bytes would reach the
  // browser undecoded.
  headers.delete("accept-encoding");
  // Strip Origin so the upstream does not run CORS validation against it.
  // This is a server-to-server call; CORS is enforced at the Vercel edge,
  // not inside the proxy tunnel.
  headers.delete("origin");
  return headers;
}

export async function proxyAuthRoute(request: NextRequest, apiPath: string) {
  const upstreamUrl = buildUpstreamUrl(request, apiPath);
  const init: RequestInit = {
    method: request.method,
    headers: cloneRequestHeaders(request),
    cache: "no-store",
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.clone().text();
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, init);
  } catch {
    return NextResponse.json(
      { error: "Authentication service temporarily unavailable. Please try again." },
      { status: 503 }
    );
  }

  const response = new NextResponse(upstream.body, { status: upstream.status });

  upstream.headers.forEach((value, key) => {
    if (key === "set-cookie" || HOP_BY_HOP_HEADERS.has(key.toLowerCase())) return;
    response.headers.set(key, value);
  });

  for (const cookie of upstream.headers.getSetCookie()) {
    response.headers.append("set-cookie", cookie);
  }

  return response;
}
