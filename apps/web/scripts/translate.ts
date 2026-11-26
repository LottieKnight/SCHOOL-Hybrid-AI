/**
 * Translates messages/en.json into all target SA languages using the OpenAI API.
 *
 * - Idempotent: keys already present in a target file are preserved (human
 *   corrections are never overwritten). Only missing keys are translated.
 * - Run: OPENAI_API_KEY=... npx tsx scripts/translate.ts
 *   (or set OPENAI_API_KEY in .env.local and run without the prefix)
 */
import OpenAI from "openai";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LOCALES, LOCALE_NAMES, type Locale } from "../lib/locale";

const MESSAGES_DIR = join(import.meta.dirname, "..", "messages");
const MODEL = "gpt-4o";

type Messages = Record<string, Record<string, string>>;

function readJson(path: string): Messages {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

// Returns the subset of `source` whose leaf keys are absent from `target`.
function missingKeys(source: Messages, target: Messages): Messages {
  const out: Messages = {};
  for (const [ns, entries] of Object.entries(source)) {
    for (const [key, value] of Object.entries(entries)) {
      if (target[ns]?.[key] === undefined) {
        (out[ns] ??= {})[key] = value;
      }
    }
  }
  return out;
}

// Deep-merges `incoming` into `base` (incoming wins only for keys it defines).
function mergeMessages(base: Messages, incoming: Messages): Messages {
  const out: Messages = structuredClone(base);
  for (const [ns, entries] of Object.entries(incoming)) {
    out[ns] = { ...(out[ns] ?? {}), ...entries };
  }
  return out;
}

async function translateChunk(
  client: OpenAI,
  languageName: string,
  chunk: Messages,
): Promise<Messages> {
  const systemPrompt = [
    `You are a professional translator for an educational platform serving South African learners (Grade R-12).`,
    `Translate the JSON string VALUES into ${languageName}. Rules:`,
    `- Return ONLY valid JSON with the exact same key structure. Do not add or remove keys.`,
    `- Preserve any {placeholder} markers EXACTLY (e.g. {name}, {count}) — do not translate or reorder their contents.`,
    `- Use clear, age-appropriate educational register.`,
    `- Keep widely-used English technical terms in English where no established ${languageName} equivalent exists.`,
  ].join("\n");

  // response_format: json_object forces the model to emit valid JSON, preventing
  // control-character / parse errors that occur with free-form text output.
  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 8000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify(chunk, null, 2) },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error(`No JSON object found in model response for ${languageName}`);
  }
  return JSON.parse(text.slice(jsonStart, jsonEnd + 1));
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY is not set.");
    process.exit(1);
  }
  const client = new OpenAI({ apiKey });
  const source = readJson(join(MESSAGES_DIR, "en.json"));

  for (const locale of LOCALES.filter((l): l is Locale => l !== "en")) {
    const targetPath = join(MESSAGES_DIR, `${locale}.json`);
    const existing = readJson(targetPath);
    const todo = missingKeys(source, existing);
    const todoCount = Object.values(todo).reduce((n, e) => n + Object.keys(e).length, 0);

    if (todoCount === 0) {
      console.log(`${locale} (${LOCALE_NAMES[locale]}): up to date — 0 keys.`);
      continue;
    }

    console.log(`${locale} (${LOCALE_NAMES[locale]}): translating ${todoCount} keys...`);
    try {
      const translated = await translateChunk(client, LOCALE_NAMES[locale], todo);
      const merged = mergeMessages(existing, translated);
      writeFileSync(targetPath, JSON.stringify(merged, null, 2) + "\n");
      console.log(`${locale}: wrote ${todoCount} keys.`);
    } catch (error) {
      console.error(`${locale}: FAILED —`, error instanceof Error ? error.message : error);
    }
  }
}

void main();
