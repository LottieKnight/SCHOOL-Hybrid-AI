import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
function findRepoRoot() {
    const cwd = process.cwd();
    const candidates = [cwd, path.join(cwd, ".."), path.join(cwd, "..", "..")];
    for (const candidate of candidates) {
        if (fs.existsSync(path.join(candidate, "content"))) {
            return candidate;
        }
    }
    return cwd;
}
export function getDefaultChunksPath() {
    const repoRoot = findRepoRoot();
    return path.join(repoRoot, "content", "index", "chunks.jsonl");
}
export async function loadContentChunks(indexPath = getDefaultChunksPath()) {
    if (!fs.existsSync(indexPath)) {
        throw new Error(`Chunks index not found at ${indexPath}. Run build-content-chunks first.`);
    }
    const chunks = [];
    const stream = fs.createReadStream(indexPath, { encoding: "utf-8" });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of rl) {
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed && typeof parsed.file_path === "string") {
                chunks.push(parsed);
            }
        }
        catch {
            // ignore bad lines
        }
    }
    return chunks;
}
function normalizeText(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
}
function tokenize(text) {
    return normalizeText(text)
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 2);
}
function buildIndex(chunks) {
    const docs = [];
    const df = new Map();
    let totalLength = 0;
    for (const chunk of chunks) {
        if (!chunk.text || !chunk.text.trim())
            continue;
        const tokens = tokenize(chunk.text);
        if (!tokens.length)
            continue;
        const tf = new Map();
        const seen = new Set();
        tokens.forEach((token) => {
            tf.set(token, (tf.get(token) ?? 0) + 1);
            seen.add(token);
        });
        seen.forEach((token) => df.set(token, (df.get(token) ?? 0) + 1));
        totalLength += tokens.length;
        docs.push({ chunk, tf, length: tokens.length });
    }
    const avgdl = docs.length ? totalLength / docs.length : 0;
    return { docs, df, avgdl };
}
function scoreBm25(queryTokens, doc, index) {
    if (!doc.length || !index.avgdl)
        return 0;
    const k1 = 1.2;
    const b = 0.75;
    let score = 0;
    const N = index.docs.length;
    for (const token of queryTokens) {
        const df = index.df.get(token);
        if (!df)
            continue;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        const tf = doc.tf.get(token) ?? 0;
        if (!tf)
            continue;
        const denom = tf + k1 * (1 - b + (b * doc.length) / index.avgdl);
        score += idf * ((tf * (k1 + 1)) / denom);
    }
    return score;
}
function matchesFilters(chunk, filters) {
    if (!filters)
        return true;
    if (filters.grade !== undefined && chunk.detected_grade !== null && chunk.detected_grade !== filters.grade) {
        return false;
    }
    if (filters.term !== undefined && chunk.detected_term !== null && chunk.detected_term !== filters.term) {
        return false;
    }
    if (filters.subject &&
        chunk.detected_subject &&
        chunk.detected_subject.toLowerCase() !== filters.subject.toLowerCase()) {
        return false;
    }
    return true;
}
export async function retrieveChunks(query, options = {}) {
    const chunks = await loadContentChunks(options.indexPath);
    const filtered = options.filters ? chunks.filter((chunk) => matchesFilters(chunk, options.filters)) : chunks;
    const index = buildIndex(filtered);
    const tokens = tokenize(query);
    const scored = index.docs
        .map((doc) => ({
        chunk: doc.chunk,
        score: scoreBm25(tokens, doc, index),
    }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score);
    const topK = options.topK ?? 8;
    return scored.slice(0, topK).map((entry) => entry.chunk);
}
