const { chromium } = require("playwright");

const EXEC =
  "/home/lottie/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";

(async () => {
  const browser = await chromium.launch({
    executablePath: EXEC,
    args: ["--no-sandbox", "--disable-gpu"],
  });

  const errors = [];
  const capture = async (name, url, vp) => {
    const ctx = await browser.newContext({
      viewport: vp,
      locale: "en-ZA",
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${name} pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`${name} console: ${m.text()}`);
    });
    try {
      await page.goto(url, { waitUntil: "load", timeout: 60000 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `/tmp/opencode/${name}.png`, fullPage: false });
      const info = await page.evaluate(() => {
        const s = document.querySelector(".shell-sidebar");
        const main = document.querySelector(".shell-main");
        const backdrop = document.querySelector(".shell-backdrop");
        const cs = s ? getComputedStyle(s) : null;
        const bodyCls = document.body.className;
        const htmlCls = document.documentElement.className;
        return {
          bodyCls,
          htmlCls,
          sidebarVisible: s ? cs.display !== "none" && cs.visibility !== "hidden" : null,
          sidebarRect: s ? s.getBoundingClientRect().toJSON() : null,
          sidebarCss: cs
            ? {
                transform: cs.transform,
                position: cs.position,
                width: cs.width,
                height: cs.height,
                left: cs.left,
                opacity: cs.opacity,
                zIndex: cs.zIndex,
                backgroundImage: cs.backgroundImage.slice(0, 60),
                transition: cs.transition,
              }
            : null,
          contentMarginLeft: main ? getComputedStyle(main).marginLeft : null,
          hasBackdrop: !!backdrop && getComputedStyle(backdrop).display !== "none",
          links: document.querySelectorAll(".sidebar-link").length,
          collapsed: document.querySelector("[data-collapsed]")?.getAttribute("data-collapsed"),
          open: document.querySelector("[data-open]")?.getAttribute("data-open"),
        };
      });
      console.log(`== ${name} ==`);
      console.log(JSON.stringify(info, null, 1));
    } catch (e) {
      console.log(`== ${name} FAILED: ${e.message}`);
    }
    await ctx.close();
  };

  await capture("desktop-learn", "http://localhost:3000/learn", { width: 1440, height: 900 });
  await capture("desktop-dashboard", "http://localhost:3000/dashboard", { width: 1440, height: 900 });
  await capture("mobile-learn", "http://localhost:3000/learn", { width: 390, height: 844 });
  await capture("tablet-learn", "http://localhost:3000/learn", { width: 820, height: 1180 });

  console.log("== JS ERRORS ==");
  for (const e of errors) console.log(e);

  await browser.close();
})();