import { NextResponse } from "next/server";

type RetiredRouteOptions = {
  replacement: string;
  reason: string;
};

export function retiredRouteResponse({ replacement, reason }: RetiredRouteOptions) {
  return NextResponse.json(
    {
      error: "Route retired",
      reason,
      replacement,
    },
    {
      status: 410,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
