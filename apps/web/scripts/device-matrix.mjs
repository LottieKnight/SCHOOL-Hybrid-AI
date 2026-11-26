import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium, devices } from "playwright";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const DEFAULT_OUTPUT_DIR = path.join(os.tmpdir(), "school-device-matrix");
const DEFAULT_DEVICES = [
  { name: "iPhone SE (3rd gen)", descriptor: "iPhone SE (3rd gen)" },
  { name: "iPhone 13 mini", descriptor: "iPhone 13 Mini" },
  { name: "iPhone 14", descriptor: "iPhone 14" },
  { name: "iPhone 14 Plus", descriptor: "iPhone 14 Plus" },
  { name: "Galaxy S24", descriptor: "Galaxy S24" },
];
const DEFAULT_ROUTES = [
  { path: "/learn/wves312", label: "wves312" },
  { path: "/learn", label: "learn" },
];

function normalizeRouteLabel(routePath) {
  return (
    routePath
      .replace(/^\/+/, "")
      .replace(/[?#].*$/, "")
      .replace(/\/+/g, "-")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "") || "home"
  );
}

function parseListArgs(argv, flag) {
  const values = [];

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current) continue;

    if (current === flag) {
      const next = argv[index + 1];
      if (next && !next.startsWith("--")) {
        values.push(next);
        index += 1;
      }
      continue;
    }

    if (current.startsWith(`${flag}=`)) {
      values.push(current.slice(flag.length + 1));
    }
  }

  return values;
}

function parseSingleArg(argv, flag) {
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current) continue;

    if (current === flag) {
      return argv[index + 1] ?? null;
    }

    if (current.startsWith(`${flag}=`)) {
      return current.slice(flag.length + 1);
    }
  }

  return null;
}

function buildContextOptions(descriptor) {
  if (!(descriptor in devices)) {
    throw new Error(`Unknown Playwright device: ${descriptor}`);
  }

  const device = devices[descriptor];
  return {
    ...device,
    colorScheme: "dark",
  };
}

async function installApiMocks(page) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "localhost" || url.port !== "4000") {
      await route.continue();
      return;
    }

    if (url.pathname.endsWith("/auth/session")) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "unauthenticated" }),
      });
      return;
    }

    if (url.pathname.endsWith("/health")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ db: "ok" }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "mocked-offline" }),
    });
  });
}

async function main() {
  const argv = process.argv.slice(2);
  const baseUrl = parseSingleArg(argv, "--base-url") ?? DEFAULT_BASE_URL;
  const outputDir = path.resolve(parseSingleArg(argv, "--out") ?? DEFAULT_OUTPUT_DIR);

  const routeArgs = parseListArgs(argv, "--route");
  const routes = (routeArgs.length
    ? routeArgs.map((route) => ({ path: route, label: normalizeRouteLabel(route) }))
    : DEFAULT_ROUTES
  ).map((route) => ({
    ...route,
    path: route.path.startsWith("/") ? route.path : `/${route.path}`,
  }));

  const deviceArgs = parseListArgs(argv, "--device");
  const selectedDevices = deviceArgs.length ? deviceArgs : DEFAULT_DEVICES.map((device) => device.descriptor);
  const devicesToCapture = selectedDevices.map((descriptor) => ({
    name: descriptor,
    descriptor,
  }));

  await mkdir(outputDir, { recursive: true });

  try {
    const browser = await chromium.launch({ headless: true });
    const manifest = [];

    try {
      for (const device of devicesToCapture) {
        const deviceDir = path.join(outputDir, device.name.replace(/\s+/g, "-").toLowerCase());
        await mkdir(deviceDir, { recursive: true });

        const context = await browser.newContext(buildContextOptions(device.descriptor));
        const page = await context.newPage();
        await installApiMocks(page);
        const consoleErrors = [];

        page.on("pageerror", (error) => {
          consoleErrors.push(`pageerror: ${error.message}`);
        });

        page.on("console", (message) => {
          if (message.type() === "error") {
            const text = message.text();
            if (text.includes("401 (Unauthorized)") || text.includes("/auth/session")) {
              return;
            }
            consoleErrors.push(`console: ${text}`);
          }
        });

        for (const route of routes) {
          const url = new URL(route.path, baseUrl);
          await page.goto(url.toString(), { waitUntil: "domcontentloaded" });
          await page.waitForLoadState("load");
          await page.evaluate(async () => {
            if ("fonts" in document) {
              await document.fonts.ready;
            }
          });
          await page.waitForTimeout(1000);
          const acceptCookies = page.getByRole("button", { name: /accept all/i });
          if (await acceptCookies.count()) {
            try {
              await acceptCookies.first().click({ timeout: 1500, force: true });
            } catch {
              // ignore, some routes may not render the banner
            }
          }
          await page.waitForTimeout(250);

          const fileName = `${route.label}.png`;
          const screenshotPath = path.join(deviceDir, fileName);
          await page.screenshot({
            path: screenshotPath,
            fullPage: true,
            animations: "disabled",
            caret: "hide",
          });

          manifest.push({
            device: device.name,
            route: route.path,
            screenshot: screenshotPath,
          });
        }

        await context.close();

        if (consoleErrors.length) {
          console.warn(`\n${device.name} console issues:`);
          for (const issue of consoleErrors) {
            console.warn(`- ${issue}`);
          }
        }
      }
    } finally {
      await browser.close();
    }

    await writeFile(
      path.join(outputDir, "manifest.json"),
      `${JSON.stringify({ baseUrl, routes, devices: devicesToCapture, screenshots: manifest }, null, 2)}\n`,
      "utf8"
    );

    console.log(`\nSaved screenshots to ${outputDir}`);
    for (const item of manifest) {
      console.log(`- ${item.device} :: ${item.route} -> ${item.screenshot}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  }

  if (process.exitCode == null) {
    process.exitCode = 0;
  }
}

void main();
