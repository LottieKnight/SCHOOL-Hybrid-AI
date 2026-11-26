import { readdirSync } from "node:fs";

const baseUrl = new URL(".", import.meta.url);
const files = readdirSync(baseUrl).filter(
  (file) => file.endsWith(".test.ts") && file !== "run-all.test.ts",
);

for (const file of files) {
  await import(new URL(file, baseUrl).href);
}

