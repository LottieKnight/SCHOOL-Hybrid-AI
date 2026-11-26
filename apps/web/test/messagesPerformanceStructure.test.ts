import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("messages performance structure", () => {
  const routeShell = readFileSync(path.join(process.cwd(), "app/messages/page.tsx"), "utf8");
  const clientPage = readFileSync(path.join(process.cwd(), "app/messages/MessagesClientPage.tsx"), "utf8");

  it("keeps /messages route shell as a server component", () => {
    expect(routeShell).not.toContain('"use client"');
    expect(routeShell).toContain('dynamic(() => import("./MessagesClientPage")');
  });

  it("loads heavy message tools lazily", () => {
    expect(clientPage).toContain("MessageAttachmentList = dynamic(");
    expect(clientPage).toContain("ModerationFeedPanel = dynamic(");
  });

  it("starts SSE stream only after an active conversation is selected", () => {
    expect(clientPage).toContain("if (!session || !activeId) return;");
    expect(clientPage).toContain("new EventSource(`${apiBase}/messages/stream`");
  });

  it("uses guarded SSE reconnect logic to avoid duplicate streams", () => {
    expect(clientPage).toContain("messageStreamRef = useRef<EventSource | null>(null)");
    expect(clientPage).toContain("if (cancelled || messageStreamRef.current) return;");
    expect(clientPage).toContain("const scheduleReconnect = () => {");
  });
});
