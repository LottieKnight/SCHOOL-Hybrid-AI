import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
export function isOcrEnabled() {
    return process.env.OCR_ENABLED === "1";
}
export function getOcrMaxPages() {
    const value = Number(process.env.OCR_MAX_PAGES || 8);
    return Number.isFinite(value) && value > 0 ? value : 8;
}
function getOcrDpi() {
    const value = Number(process.env.OCR_DPI || 150);
    return Number.isFinite(value) && value > 0 ? value : 150;
}
function getOcrLang() {
    return process.env.OCR_LANG || "eng";
}
function isCommandAvailable(cmd, args) {
    const result = spawnSync(cmd, args, { stdio: "ignore" });
    return result.status === 0;
}
function ensureBinaries() {
    const tesseractOk = isCommandAvailable("tesseract", ["--version"]);
    const pdftoppmOk = isCommandAvailable("pdftoppm", ["-h"]);
    return {
        tesseractOk,
        pdftoppmOk,
    };
}
function sortByPage(files) {
    return files.sort((a, b) => {
        const aMatch = a.match(/-(\d+)\.png$/i);
        const bMatch = b.match(/-(\d+)\.png$/i);
        const aNum = aMatch ? Number(aMatch[1]) : 0;
        const bNum = bMatch ? Number(bMatch[1]) : 0;
        return aNum - bNum;
    });
}
export async function runOcrForPdf(filePath, maxPages = getOcrMaxPages()) {
    if (!isOcrEnabled()) {
        return { used: false, text: "", pageTexts: [], error: "ocr_disabled" };
    }
    const { tesseractOk, pdftoppmOk } = ensureBinaries();
    if (!tesseractOk || !pdftoppmOk) {
        const missing = [];
        if (!tesseractOk)
            missing.push("tesseract");
        if (!pdftoppmOk)
            missing.push("pdftoppm");
        return { used: false, text: "", pageTexts: [], error: `missing_binary:${missing.join(",")}` };
    }
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ocr-"));
    const outputPrefix = path.join(tempDir, "page");
    const dpi = getOcrDpi();
    const lang = getOcrLang();
    const render = spawnSync("pdftoppm", ["-f", "1", "-l", String(maxPages), "-r", String(dpi), "-png", filePath, outputPrefix], { stdio: "ignore" });
    if (render.status !== 0) {
        await fs.rm(tempDir, { recursive: true, force: true });
        return { used: false, text: "", pageTexts: [], error: "pdftoppm_failed" };
    }
    const images = sortByPage((await fs.readdir(tempDir))
        .filter((file) => file.toLowerCase().endsWith(".png"))
        .map((file) => path.join(tempDir, file)));
    const pageTexts = [];
    for (const imagePath of images) {
        const result = spawnSync("tesseract", [imagePath, "stdout", "-l", lang], {
            encoding: "utf-8",
            stdio: ["ignore", "pipe", "ignore"],
        });
        if (result.status !== 0) {
            continue;
        }
        const text = result.stdout ? String(result.stdout) : "";
        pageTexts.push(text);
    }
    const text = pageTexts.join("\n");
    await fs.rm(tempDir, { recursive: true, force: true });
    if (!text.trim()) {
        return { used: false, text: "", pageTexts: [], error: "ocr_empty" };
    }
    return { used: true, text, pageTexts };
}
