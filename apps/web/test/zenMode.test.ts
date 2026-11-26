import { describe, expect, it } from "vitest";
import { enterZen, exitZen, historyMarksZen, onZenPop, restoreZen } from "../lib/zenMode";

const idle = { active: false, historyPushed: false };

describe("focus mode enter and exit", () => {
  it("pushes one history entry when focus mode starts", () => {
    const entered = enterZen(idle);
    expect(entered.pushHistory).toBe(true);
    expect(entered.session).toEqual({ active: true, historyPushed: true });
    expect(enterZen(entered.session).pushHistory).toBe(false);
  });

  it("leaves focus mode on the exit control and asks the browser to pop that entry", () => {
    const entered = enterZen(idle).session;
    const exited = exitZen(entered, "control");
    expect(exited.session.active).toBe(false);
    expect(exited.popHistory).toBe(true);
  });

  it("treats Escape the same as the exit control", () => {
    const entered = enterZen(idle).session;
    expect(exitZen(entered, "escape").popHistory).toBe(true);
  });

  it("lets the Android back button exit focus mode without a second history pop", () => {
    const entered = enterZen(idle).session;
    expect(onZenPop(entered, false)).toBe("exit");
    const exited = exitZen(entered, "pop");
    expect(exited.popHistory).toBe(false);
    expect(exited.session.active).toBe(false);
  });

  it("ignores the pop caused by the exit control itself", () => {
    const entered = enterZen(idle).session;
    expect(onZenPop(entered, true)).toBe("ignore");
  });

  it("syncs leaving browser fullscreen with leaving focus mode", () => {
    const entered = enterZen(idle).session;
    expect(exitZen(entered, "fullscreen").session.active).toBe(false);
  });

  it("reuses the current history entry when focus mode is restored after a reload", () => {
    expect(historyMarksZen({ schoolZen: true })).toBe(true);
    expect(historyMarksZen(null)).toBe(false);
    const restored = restoreZen(idle, true);
    expect(restored.pushHistory).toBe(false);
    expect(restored.session).toEqual({ active: true, historyPushed: true });
    expect(exitZen(restored.session, "control").popHistory).toBe(true);
    expect(restoreZen(restored.session, true).pushHistory).toBe(false);
  });

  it("still pushes one entry when a saved preference is restored on a normal page entry", () => {
    const restored = restoreZen(idle, false);
    expect(restored.pushHistory).toBe(true);
    expect(restored.session.historyPushed).toBe(true);
  });
});
