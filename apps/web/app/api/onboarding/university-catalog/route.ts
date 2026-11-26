import { NextRequest, NextResponse } from "next/server";
import { getUniversityCatalogPayload } from "@/lib/server/universityYearbookCatalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const institution = searchParams.get("institution") ?? searchParams.get("institutionSlug");
  const faculty = searchParams.get("faculty");
  const campus = searchParams.get("campus");

  if (!institution || !institution.trim()) {
    return NextResponse.json(
      {
        institutionName: "",
        academicPeriodType: "semester",
        academicUnitLabel: "Faculty",
        campuses: [],
        faculties: [],
        courses: [],
        note: null,
      },
      { status: 200 }
    );
  }

  const payload = getUniversityCatalogPayload(institution, {
    faculty,
    campus,
  });

  return NextResponse.json(payload, { status: 200 });
}
