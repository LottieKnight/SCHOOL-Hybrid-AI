const languageBases = [
    "english",
    "afrikaans",
    "isizulu",
    "isixhosa",
    "isindebele",
    "siswati",
    "sesotho",
    "sepedi",
    "setswana",
    "tshivenda",
    "xitsonga",
];
function tokenize(input) {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2);
}
function containsTokens(tokens, needed) {
    return needed.every((token) => tokens.includes(token));
}
function collectLanguageBases(tokens, outlineKeys) {
    const available = new Set();
    outlineKeys.forEach((key) => {
        const match = key.match(/^([a-z]+)-(home-language|first-additional-language)$/);
        if (match) {
            available.add(match[1]);
        }
    });
    return languageBases.filter((base) => available.has(base) && tokens.includes(base));
}
export function resolveSubjectKey(input) {
    const text = [input.filename, ...(input.folderHints ?? [])].join(" ");
    const tokens = tokenize(text);
    const outlineSet = new Set(input.outlineKeys);
    const candidates = [];
    const hasToken = (token) => tokens.includes(token);
    const hasNaturalScience = (hasToken("natural") && (hasToken("science") || hasToken("sciences"))) || hasToken("ns");
    const hasSocialScience = (hasToken("social") && (hasToken("science") || hasToken("sciences"))) || hasToken("ss");
    const hasMath = hasToken("math") || hasToken("maths") || hasToken("mathematics");
    const hasTechnology = hasToken("technology") || hasToken("tech");
    const hasLifeSkills = input.phase === "foundation" && (hasToken("life") && hasToken("skills") ? true : hasToken("lifeskills") || hasToken("ls"));
    if (hasMath && outlineSet.has("mathematics"))
        candidates.push("mathematics");
    if (hasNaturalScience && outlineSet.has("natural-sciences"))
        candidates.push("natural-sciences");
    if (hasSocialScience && outlineSet.has("social-sciences"))
        candidates.push("social-sciences");
    if (hasTechnology && outlineSet.has("technology"))
        candidates.push("technology");
    if (hasLifeSkills && outlineSet.has("life-skills"))
        candidates.push("life-skills");
    const languageMatches = collectLanguageBases(tokens, input.outlineKeys);
    if (languageMatches.length > 1) {
        return {
            subjectKey: null,
            confidence: "none",
            reason: "multiple language bases",
            tokens,
        };
    }
    if (languageMatches.length === 1) {
        const base = languageMatches[0];
        const hasHL = hasToken("hl") || containsTokens(tokens, ["home", "language"]);
        const hasFAL = hasToken("fal") || containsTokens(tokens, ["first", "additional"]);
        const hasAFAL = hasToken("afal");
        if (hasAFAL && !tokens.includes(base)) {
            return {
                subjectKey: null,
                confidence: "none",
                reason: "ambiguous language stream",
                tokens,
            };
        }
        if (hasHL && hasFAL) {
            return {
                subjectKey: null,
                confidence: "none",
                reason: "ambiguous language stream",
                tokens,
            };
        }
        if (!hasHL && !hasFAL && !hasAFAL) {
            return {
                subjectKey: null,
                confidence: "none",
                reason: "ambiguous language stream",
                tokens,
            };
        }
        const isAfrikaans = base === "afrikaans";
        const stream = hasHL ? "home-language" : hasFAL || (hasAFAL && isAfrikaans) ? "first-additional-language" : null;
        if (!stream) {
            return {
                subjectKey: null,
                confidence: "none",
                reason: "ambiguous language stream",
                tokens,
            };
        }
        const languageKey = `${base}-${stream}`;
        if (!outlineSet.has(languageKey)) {
            return {
                subjectKey: null,
                confidence: "none",
                reason: "no matching outline key",
                tokens,
            };
        }
        candidates.push(languageKey);
    }
    if (candidates.length === 0) {
        return {
            subjectKey: null,
            confidence: "none",
            reason: "no matching alias",
            tokens,
        };
    }
    const unique = Array.from(new Set(candidates));
    if (unique.length > 1) {
        return {
            subjectKey: null,
            confidence: "none",
            reason: "multiple candidates",
            tokens,
            candidates: unique,
        };
    }
    return {
        subjectKey: unique[0],
        confidence: "high",
        reason: "matched",
        tokens,
    };
}
