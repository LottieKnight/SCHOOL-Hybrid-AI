import { retiredRouteResponse } from "@/lib/retiredRoute";

export const runtime = "nodejs";

export async function GET() {
  return retiredRouteResponse({
    replacement: "/learn/{phase}/{grade}/{subject}/term/{term}/week/{week}",
    reason: "Content lesson API is retired. Use the /learn route tree instead.",
  });
}

export async function POST() {
  return retiredRouteResponse({
    replacement: "/learn/{phase}/{grade}/{subject}/term/{term}/week/{week}",
    reason: "Content lesson API is retired. Use the /learn route tree instead.",
  });
}
