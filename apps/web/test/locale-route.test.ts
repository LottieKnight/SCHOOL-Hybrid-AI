import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/locale/route";

function req(body: unknown) {
  return new Request("http://localhost/api/locale", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/locale", () => {
  it("sets the NEXT_LOCALE cookie for a valid locale", async () => {
    const res = await POST(req({ locale: "zu" }));
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("NEXT_LOCALE=zu");
    expect(setCookie).toContain("Path=/");
  });

  it("rejects an unsupported locale", async () => {
    const res = await POST(req({ locale: "fr" }));
    expect(res.status).toBe(400);
  });
});
