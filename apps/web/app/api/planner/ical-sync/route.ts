import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb } from "@/lib/server/plannerDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await request.json();
  const { url, label } = body;

  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  try {
    // 1. Fetch ICS file
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch calendar");
    const icsContent = await res.text();

    // 2. Simple regex parser for VEVENT (Summary, DTStart)
    const events = [];
    const eventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
    let match;
    while ((match = eventRegex.exec(icsContent)) !== null) {
      const block = match[1];
      const summary = block.match(/SUMMARY:(.*)/)?.[1]?.trim();
      const dtStart = block.match(/DTSTART[:;](?:VALUE=DATE:)?(\d{8})/)?.[1];
      
      if (summary && dtStart) {
        const year = dtStart.slice(0, 4);
        const month = dtStart.slice(4, 6);
        const day = dtStart.slice(6, 8);
        const dateStr = `${year}-${month}-${day}`;

        events.push({
          student_id: userId,
          title: summary,
          event_date: dateStr,
          start_time: "09:00:00",
          end_time: "10:00:00",
          event_type: "academic",
          is_manual: false,
          colour_tag: "purple",
        });
      }
    }

    // 3. Batch insert
    for (const e of events.slice(0, 50)) { // Limit to 50 events for stability
      await queryPlannerDb(
        `
          INSERT INTO student_planner_events 
          (student_id, title, event_date, start_time, end_time, event_type, is_manual, colour_tag)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT DO NOTHING
        `,
        [e.student_id, e.title, e.event_date, e.start_time, e.end_time, e.event_type, e.is_manual, e.colour_tag]
      );
    }

    // 4. Record subscription
    await queryPlannerDb(
      `
        INSERT INTO user_calendar_subscriptions (user_id, ical_url, label, last_synced_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT DO NOTHING
      `,
      [userId, url, label ?? "Imported Calendar"]
    );

    return NextResponse.json({ success: true, count: events.length });
  } catch (error) {
    console.error("Failed to sync iCal:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
