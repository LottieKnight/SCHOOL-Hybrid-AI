import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { getInstitutionContextForUser } from "@/lib/server/institutions";
import { getInstitutionResourceLibrary, type ResourceLibraryScope } from "@/lib/server/resourceLibrary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeScope(value: string | null): ResourceLibraryScope | undefined {
  return value === "institution" || value === "universal" || value === "all" ? value : undefined;
}

export async function GET(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  const institutionContext = userId ? await getInstitutionContextForUser(userId).catch(() => null) : null;
  const searchParams = request.nextUrl.searchParams;
  const requestedScope = normalizeScope(searchParams.get("institutionScope"));
  const institutionScope = requestedScope ?? (institutionContext?.id ? "institution" : "all");

  try {
    const catalog = await getInstitutionResourceLibrary({
      phase: searchParams.get("phase") || undefined,
      grade: searchParams.get("grade") ? Number(searchParams.get("grade")) : undefined,
      subject: searchParams.get("subject") || undefined,
      format: searchParams.get("format") || undefined,
      priceType: searchParams.get("priceType") || undefined,
      license: searchParams.get("license") || undefined,
      commercialAllowedOnly: searchParams.get("commercialAllowedOnly") === "true",
      q: searchParams.get("q") || undefined,
      page: searchParams.get("page") ? Number(searchParams.get("page")) : 1,
      pageSize: searchParams.get("pageSize") ? Number(searchParams.get("pageSize")) : 24,
      institutionScope,
      institutionId: institutionContext?.id ?? null,
      userId: userId || null,
      activeModule: institutionContext?.currentModules?.[0] ?? null,
      currentModules: institutionContext?.currentModules ?? [],
    });

    return NextResponse.json({
      ...catalog,
      institution: institutionContext
        ? {
            id: institutionContext.id,
            name: institutionContext.name,
            shortName: institutionContext.shortName,
          }
        : null,
      institutionScope,
    });
  } catch {
    return NextResponse.json({ error: "Unable to load institution resources." }, { status: 500 });
  }
}
