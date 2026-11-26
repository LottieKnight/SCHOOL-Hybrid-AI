import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const base = process.env.SHOT_BASE || "http://127.0.0.1:3000";
const out = path.resolve("/workspace/docs/screenshots");
mkdirSync(out, { recursive: true });

const pages = [
  { path: "/", name: "home" },
  { path: "/tutor", name: "tutor" },
  { path: "/past-papers", name: "past-papers" },
  { path: "/learn", name: "learn" },
  { path: "/offline", name: "offline" },
];

const targets = [
  { id: "galaxy-360x800", viewport: { width: 360, height: 800 }, dsf: 2 },
  { id: "pixel-393x851", viewport: { width: 393, height: 851 }, dsf: 2.75 },
  { id: "iphone-se-375x667", viewport: { width: 375, height: 667 }, dsf: 2 },
  { id: "landscape-800x360", viewport: { width: 800, height: 360 }, dsf: 2 },
  { id: "win-1366x768", viewport: { width: 1366, height: 768 }, dsf: 1 },
  { id: "win-1536x864-125", viewport: { width: 1229, height: 691 }, dsf: 1.25 },
  { id: "win-1920-100", viewport: { width: 1920, height: 1080 }, dsf: 1 },
  { id: "win-1920-125", viewport: { width: 1536, height: 864 }, dsf: 1.25 },
  { id: "win-1920-150", viewport: { width: 1280, height: 720 }, dsf: 1.5 },
  { id: "win-2560x1440", viewport: { width: 2560, height: 1440 }, dsf: 1 },
];

const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const notes = [];
for (const target of targets) {
  const context = await browser.newContext({
    viewport: target.viewport,
    deviceScaleFactor: target.dsf,
    hasTouch: target.viewport.width < 900,
    isMobile: target.viewport.width < 900,
    userAgent: devices["Pixel 5"].userAgent,
  });
  await context.addInitScript(() => {
    sessionStorage.setItem("school:splash:session", "1");
    localStorage.setItem("school:splash:visited", "1");
  });
  const page = await context.newPage();
  for (const entry of pages) {
    const folder = target.id.startsWith("win-") ? "windows" : "mobile";
    const file = path.join(out, folder, `${target.id}-${entry.name}.png`);
    mkdirSync(path.dirname(file), { recursive: true });
    try {
      const response = await page.goto(base + entry.path, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.getByRole("button", { name: /accept all/i }).click({ timeout: 1500 }).catch(() => undefined);
      await page.getByRole("button", { name: /dismiss/i }).click({ timeout: 1500 }).catch(() => undefined);
      await page.waitForTimeout(400);
      await page.screenshot({ path: file, fullPage: false });
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth > window.innerWidth + 4;
      });
      notes.push(`${target.id} ${entry.path} status=${response?.status() ?? "?"} overflow=${overflow}`);
    } catch (error) {
      notes.push(`${target.id} ${entry.path} ERROR ${error instanceof Error ? error.message : error}`);
    }
  }
  await context.close();
}

await browser.close();
console.log(notes.join("\n"));
