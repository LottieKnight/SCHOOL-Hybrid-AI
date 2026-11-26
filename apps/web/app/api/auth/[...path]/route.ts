import { NextRequest } from "next/server";
import { proxyAuthRoute } from "@/lib/server/authRouteProxy";

async function proxy(request: NextRequest) {
  const apiPath = request.nextUrl.pathname.replace(/^\/api/, "");
  return proxyAuthRoute(request, apiPath);
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = proxy;
