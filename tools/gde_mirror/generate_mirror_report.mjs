import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const mirrorRoot = path.join(repoRoot, "content", "gde_lrip_mip_mirror");
const reportRoot = path.join(repoRoot, "content", "gde_lrip_mip_reports");
const queuePath = path.join(reportRoot, "mirror_queue.json");

function normalizePath(value) {
  return value.replace(/\\/g, "/");
}

async function walkMetadata(root) {
  const metadataFiles = [];
  async function walk(dir) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name === "metadata.json") {
        metadataFiles.push(fullPath);
      }
    }
  }
  if (fs.existsSync(root)) {
    await walk(root);
  }
  return metadataFiles;
}

function buildTree(root, depth = 6, prefix = "") {
  if (depth < 0) return [];
  const lines = [];
  const entries = fs.existsSync(root) ? fs.readdirSync(root, { withFileTypes: true }) : [];
  entries.forEach((entry, index) => {
    const isLast = index === entries.length - 1;
    const marker = isLast ? "└─" : "├─";
    lines.push(`${prefix}${marker} ${entry.name}`);
    if (entry.isDirectory()) {
      const nextPrefix = prefix + (isLast ? "   " : "│  ");
      lines.push(...buildTree(path.join(root, entry.name), depth - 1, nextPrefix));
    }
  });
  return lines;
}

async function main() {
  await fsp.mkdir(reportRoot, { recursive: true });
  const metadataFiles = await walkMetadata(mirrorRoot);
  const totals = {
    links: 0,
    discovered_nodes: 0,
    downloaded_files: 0,
    downloaded_bytes: 0,
    failed_urls: [],
    remaining_queue: 0,
  };
  const byExtension = {};
  const byLinkIndex = {};

  for (const metadataPath of metadataFiles) {
    const raw = await fsp.readFile(metadataPath, "utf-8");
    const metadata = JSON.parse(raw);
    totals.links += 1;
    totals.discovered_nodes += (metadata.discovered_children || []).length;
    (metadata.downloaded_files || []).forEach((file) => {
      totals.downloaded_files += 1;
      totals.downloaded_bytes += file.bytes || 0;
      const ext = path.extname(file.path || file.url || "").toLowerCase() || "none";
      byExtension[ext] = (byExtension[ext] || 0) + 1;
      const linkIndex = normalizePath(metadataPath)
        .split("/")
        .find((segment) => segment.includes("_"))?.split("_")[0];
      if (linkIndex) {
        byLinkIndex[linkIndex] = (byLinkIndex[linkIndex] || 0) + 1;
      }
    });
    (metadata.failures || []).forEach((failure) => {
      totals.failed_urls.push({ url: failure.url, reason: failure.reason || "unknown" });
    });
  }

  if (fs.existsSync(queuePath)) {
    try {
      const queue = JSON.parse(await fsp.readFile(queuePath, "utf-8"));
      totals.remaining_queue = Array.isArray(queue) ? queue.length : 0;
    } catch {
      totals.remaining_queue = 0;
    }
  }

  const report = {
    totals,
    breakdown: {
      by_extension: byExtension,
      by_link_index: byLinkIndex,
    },
  };

  const jsonPath = path.join(reportRoot, "mirror_report.json");
  await fsp.writeFile(jsonPath, JSON.stringify(report, null, 2));

  const mdLines = [
    "# GDE Mirror Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Totals",
    "",
    `Links: ${totals.links}`,
    `Discovered nodes: ${totals.discovered_nodes}`,
    `Downloaded files: ${totals.downloaded_files}`,
    `Downloaded bytes: ${totals.downloaded_bytes}`,
    `Failed URLs: ${totals.failed_urls.length}`,
    `Remaining queue: ${totals.remaining_queue}`,
    "",
    "## Breakdown by extension",
    "",
    "| Extension | Count |",
    "| --- | ---: |",
    ...Object.entries(byExtension).map(([ext, count]) => `| ${ext} | ${count} |`),
    "",
    "## Failed URLs (top 20)",
    "",
    ...totals.failed_urls.slice(0, 20).map((item) => `- ${item.url} (${item.reason})`),
    "",
  ];
  const mdPath = path.join(reportRoot, "mirror_report.md");
  await fsp.writeFile(mdPath, mdLines.join("\n"));

  const treeLines = buildTree(mirrorRoot, 6);
  const treePath = path.join(reportRoot, "mirror_tree.txt");
  await fsp.writeFile(treePath, treeLines.join("\n"));

  console.log("Report written:");
  console.log(jsonPath);
  console.log(mdPath);
  console.log(treePath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
