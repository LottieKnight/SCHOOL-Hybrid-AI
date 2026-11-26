export type WeakSignal = {
  topic: string;
  subject?: string;
  mastery: number;
};

export type CandidateQuestion = {
  id: string;
  pastPaperId: string;
  qNumber: string;
  label: string;
  maxMarks: number;
  topicTags: string | null;
  subject: string;
  grade: number | null;
  title: string;
};

export type WeightedQuestion = CandidateQuestion & { weight: number };

export function questionWeight(question: Pick<CandidateQuestion, "subject" | "topicTags">, weak: WeakSignal[]): number {
  const hay = `${question.subject} ${question.topicTags ?? ""}`.toLowerCase();
  let weight = 1;
  for (const item of weak) {
    const topic = item.topic.trim().toLowerCase();
    const subject = (item.subject ?? "").trim().toLowerCase();
    const matched = (topic.length > 1 && hay.includes(topic)) || (subject.length > 1 && hay.includes(subject));
    if (!matched) continue;
    weight += 1 + Math.max(0, 100 - item.mastery) / 25;
  }
  return weight;
}

export function pickWeighted<T extends { weight: number }>(
  items: T[],
  count: number,
  random: () => number = Math.random,
): T[] {
  const pool = [...items];
  const picked: T[] = [];
  const target = Math.max(0, Math.min(count, pool.length));
  while (picked.length < target) {
    const total = pool.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
    if (total <= 0) {
      picked.push(pool.shift() as T);
      continue;
    }
    let ticket = random() * total;
    let index = pool.length - 1;
    for (let i = 0; i < pool.length; i += 1) {
      ticket -= Math.max(0, pool[i].weight);
      if (ticket <= 0) {
        index = i;
        break;
      }
    }
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

export function weightCandidates(questions: CandidateQuestion[], weak: WeakSignal[]): WeightedQuestion[] {
  return questions.map((question) => ({ ...question, weight: questionWeight(question, weak) }));
}
