import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.SHOT_BASE || "http://127.0.0.1:3000";
const out = path.resolve("/workspace/docs/screenshots/zen");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const targets = [
  { id: "android-360x800", viewport: { width: 360, height: 800 }, dsf: 2, touch: true },
  { id: "windows-1366x768", viewport: { width: 1366, height: 768 }, dsf: 1, touch: false },
];

for (const target of targets) {
  const context = await browser.newContext({
    viewport: target.viewport,
    deviceScaleFactor: target.dsf,
    hasTouch: target.touch,
    isMobile: target.touch,
  });
  await context.addInitScript(() => {
    sessionStorage.setItem("school:splash:session", "1");
    localStorage.setItem("school:splash:visited", "1");
    localStorage.removeItem("saedu_zen_mode");
  });
  const page = await context.newPage();
  await page.goto(`${base}/learn`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.getByRole("button", { name: /accept all/i }).click({ timeout: 2000 }).catch(() => undefined);
  await page.getByRole("button", { name: /dismiss/i }).click({ timeout: 1500 }).catch(() => undefined);

  const enter = page.getByRole("button", { name: "Enter focus mode" });
  await enter.waitFor({ timeout: 15000 });
  await page.screenshot({ path: path.join(out, `${target.id}-before.png`) });
  await enter.click();
  const exit = page.getByRole("button", { name: "Exit focus mode" }).last();
  await exit.waitFor({ timeout: 5000 });
  const box = await exit.boundingBox();
  if (!box || box.width < 44 || box.height < 44) {
    throw new Error(`${target.id} exit control is smaller than 44px: ${JSON.stringify(box)}`);
  }
  if (box.y + box.height > target.viewport.height || box.x < 0) {
    throw new Error(`${target.id} exit control is off screen: ${JSON.stringify(box)}`);
  }
  await page.screenshot({ path: path.join(out, `${target.id}-zen.png`) });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Enter focus mode" }).waitFor({ timeout: 5000 });
  await enter.click();
  await exit.waitFor({ timeout: 5000 });
  await page.goBack();
  await page.getByRole("button", { name: "Enter focus mode" }).waitFor({ timeout: 5000 });
  await page.screenshot({ path: path.join(out, `${target.id}-after.png`) });
  const stillHere = page.url();
  if (!stillHere.includes("/learn")) throw new Error(`${target.id} left the page: ${stillHere}`);
  await context.close();
  console.log(`${target.id} enter, escape, and back all stayed on /learn`);
}

await browser.close();
