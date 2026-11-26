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
export function getDefaultRagV1IndexPath() {
    const repoRoot = findRepoRoot();
    return path.join(repoRoot, "content", "rag_v1", "index.jsonl");
}
async function loadChunks(indexPath) {
    if (!fs.existsSync(indexPath)) {
        throw new Error(`RAG v1 index not found at ${indexPath}. Run rag:v1:index first.`);
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
            if (parsed && parsed.file_path && typeof parsed.text === "string") {
                chunks.push(parsed);
            }
        }
        catch {
            // ignore malformed lines
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
        for (const token of tokens) {
            tf.set(token, (tf.get(token) ?? 0) + 1);
            seen.add(token);
        }
        for (const token of seen) {
            df.set(token, (df.get(token) ?? 0) + 1);
        }
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
function matchesFilters(chunk, params) {
    if (params.grade !== undefined && chunk.detected_grade !== null && chunk.detected_grade !== params.grade) {
        return false;
    }
    if (params.term !== undefined && chunk.detected_term !== null && chunk.detected_term !== params.term) {
        return false;
    }
    if (params.subjectKey &&
        chunk.detected_subject_key &&
        chunk.detected_subject_key.toLowerCase() !== params.subjectKey.toLowerCase()) {
        return false;
    }
    if (params.phase && chunk.phase && chunk.phase !== params.phase) {
        return false;
    }
    return true;
}
function buildQuery(params) {
    const parts = [];
    if (params.phase)
        parts.push(params.phase);
    if (params.grade !== undefined)
        parts.push(`grade ${params.grade}`);
    if (params.subjectKey)
        parts.push(params.subjectKey);
    if (params.term !== undefined)
        parts.push(`term ${params.term}`);
    if (params.week !== undefined)
        parts.push(`week ${params.week}`);
    if (params.topic)
        parts.push(params.topic);
    return parts.join(" ");
}
export async function retrieveRagV1Chunks(params) {
    const indexPath = params.indexPath ?? getDefaultRagV1IndexPath();
    const allChunks = await loadChunks(indexPath);
    const filtered = allChunks.filter((chunk) => matchesFilters(chunk, params));
    const index = buildIndex(filtered);
    const query = buildQuery(params);
    const queryTokens = tokenize(query);
    const scored = index.docs
        .map((doc) => ({ chunk: doc.chunk, score: scoreBm25(queryTokens, doc, index) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score);
    const k = params.k ?? 12;
    if (scored.length) {
        return scored.slice(0, k).map((entry) => ({ ...entry.chunk, score: entry.score }));
    }
    if (filtered.length !== allChunks.length) {
        const relaxedIndex = buildIndex(allChunks);
        const relaxedScored = relaxedIndex.docs
            .map((doc) => ({ chunk: doc.chunk, score: scoreBm25(queryTokens, doc, relaxedIndex) }))
            .filter((entry) => entry.score > 0)
            .sort((a, b) => b.score - a.score);
        return relaxedScored.slice(0, k).map((entry) => ({ ...entry.chunk, score: entry.score }));
    }
    return [];
}
