import { QuizQuestionSchema, type QuizQuestion } from "./lesson-content.js";

const STOP_WORDS = new Set([
  "the",
  "and",
  "that",
  "with",
  "from",
  "this",
  "these",
  "those",
  "into",
  "there",
  "their",
  "about",
  "could",
  "should",
  "would",
  "which",
  "what",
  "when",
  "where",
  "while",
  "your",
  "yours",
  "have",
  "has",
  "had",
  "were",
  "was",
  "are",
  "for",
  "but",
  "not",
  "can",
  "may",
  "will",
  "also",
  "than",
  "then",
  "them",
  "they",
  "each",
  "over",
  "under",
  "such",
  "some",
  "more",
  "most",
  "very",
  "much",
  "many",
  "like",
  "just",
  "other",
  "into",
  "out",
  "our",
  "us",
  "you",
  "she",
  "him",
  "her",
  "his",
  "its",
  "your",
  "yours",
  "we",
  "our",
  "they",
  "them",
  "their",
  "a",
  "an",
  "in",
  "on",
  "of",
  "to",
  "is",
  "it",
  "as",
  "by",
  "be",
  "at",
  "or",
  "if",
]);

const sentenceSplitter = /(?<=[.?!])\s+(?=[A-Z0-9])/g;

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function splitSentences(text: string) {
  const cleaned = text.replace(/\r/g, " ").replace(/\n+/g, " ").trim();
  if (!cleaned) return [];
  return cleaned.split(sentenceSplitter).map((sentence) => sentence.trim()).filter(Boolean);
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 3 && !STOP_WORDS.has(token) && !/^\d+$/.test(token));
}

function topKeywords(text: string, limit: number) {
  const tokens = tokenize(text);
  const counts = new Map<string, number>();
  tokens.forEach((token) => counts.set(token, (counts.get(token) ?? 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token)
    .slice(0, limit);
}

function pickSentencesWithKeywords(sentences: string[], keywords: string[]) {
  const picks: { sentence: string; keyword: string }[] = [];
  keywords.forEach((keyword) => {
    const found = sentences.find((sentence) => sentence.toLowerCase().includes(keyword));
    if (found) {
      picks.push({ sentence: found, keyword });
    }
  });
  return picks;
}

function gradeBand(grade: number) {
  if (grade <= 3) return "foundation";
  if (grade <= 6) return "intermediate";
  return "senior";
}

function mcqPrompt(sentence: string, keyword: string, grade: number) {
  const band = gradeBand(grade);
  const masked = sentence.replace(new RegExp(`\\b${keyword}\\b`, "i"), "____");
  if (band === "foundation") {
    return `Fill in the missing word: ${masked}`;
  }
  if (band === "intermediate") {
    return `Which word best completes the sentence? ${masked}`;
  }
  return `Select the term that completes the statement: ${masked}`;
}

function makeOptions(keyword: string, distractors: string[]) {
  const options = [keyword, ...distractors.filter((item) => item !== keyword)];
  const unique = Array.from(new Set(options));
  return unique.slice(0, 5);
}

function explanationFromSentence(sentence: string, keyword: string) {
  return normalizeText(sentence).replace(new RegExp(`\\b${keyword}\\b`, "i"), keyword);
}

export function generateQuiz(extractedText: string, grade: number) {
  const sentences = splitSentences(extractedText);
  const keywords = topKeywords(extractedText, 12);
  const sentencePicks = pickSentencesWithKeywords(sentences, keywords);
  const questions: QuizQuestion[] = [];

  const mcqTarget = Math.max(4, Math.min(6, sentencePicks.length || 4));
  for (let i = 0; i < mcqTarget; i += 1) {
    const pick = sentencePicks[i % sentencePicks.length];
    const distractors = keywords.filter((word) => word !== pick.keyword).slice(0, 4);
    const options = makeOptions(pick.keyword, distractors);
    const prompt = mcqPrompt(pick.sentence, pick.keyword, grade);
    const question: QuizQuestion = {
      id: `mcq-${i + 1}`,
      type: "mcq",
      prompt,
      options,
      answer: pick.keyword,
      explanation: explanationFromSentence(pick.sentence, pick.keyword),
      difficulty: i < 2 ? "easy" : i < 4 ? "medium" : "hard",
      tags: [pick.keyword],
    };
    questions.push(QuizQuestionSchema.parse(question));
  }

  const shortTargets = grade <= 3 ? 1 : 2;
  for (let i = 0; i < shortTargets; i += 1) {
    const keyword = keywords[i] || sentencePicks[i % sentencePicks.length]?.keyword || "topic";
    const sentence = sentencePicks[i % sentencePicks.length]?.sentence || extractedText;
    const prompt =
      grade <= 3
        ? `Write one thing you learned about ${keyword}.`
        : `Explain ${keyword} in one or two sentences.`;
    const question: QuizQuestion = {
      id: `short-${i + 1}`,
      type: "short_answer",
      prompt,
      answer: normalizeText(sentence),
      explanation: normalizeText(sentence),
      difficulty: grade <= 3 ? "easy" : "medium",
      tags: [keyword],
    };
    questions.push(QuizQuestionSchema.parse(question));
  }

  if (sentences.length) {
    const sentence = sentences[0];
    const question: QuizQuestion = {
      id: "tf-1",
      type: "true_false",
      prompt: sentence,
      answer: "true",
      explanation: normalizeText(sentence),
      difficulty: grade <= 3 ? "easy" : "medium",
      tags: keywords.slice(0, 2),
    };
    questions.push(QuizQuestionSchema.parse(question));
  }

  while (questions.length < 6) {
    const keyword = keywords[questions.length % keywords.length] || "lesson";
    const prompt = grade <= 3 ? `Which word did you see in this lesson?` : `Pick the key term from this lesson.`;
    const options = makeOptions(keyword, keywords.filter((word) => word !== keyword));
    const question: QuizQuestion = {
      id: `fallback-${questions.length + 1}`,
      type: "mcq",
      prompt,
      options,
      answer: keyword,
      explanation: `The lesson text includes the word "${keyword}".`,
      difficulty: "easy",
      tags: [keyword],
    };
    questions.push(QuizQuestionSchema.parse(question));
  }

  return { questions };
}
