"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

type Source = {
  label: string;
  type: string;
  description: string;
};

type Round = {
  question: string;
  sources: Source[];
  correctOrder: number[];
  explanations: string[];
};

const ROUNDS: Round[] = [
  {
    question: "Is social media harmful to academic performance?",
    sources: [
      { label: "Peer-reviewed journal article (2023)", type: "Academic", description: "Published in Journal of Educational Psychology, 847 citations." },
      { label: "Government education report", type: "Official", description: "Department of Basic Education South Africa, 2022 annual review." },
      { label: "News article (Daily Maverick)", type: "News", description: "Opinion piece by a journalist, references one study." },
      { label: "Quora answer", type: "User Content", description: "Anonymous user's personal experience, no citations." },
    ],
    correctOrder: [0, 1, 2, 3],
    explanations: [
      "Peer-reviewed academic research is the gold standard — rigorously checked by experts.",
      "Government reports use verified data and methodologies, though may have policy bias.",
      "Quality journalism can be reliable but is written for general audiences, not specialists.",
      "User-generated content has no accountability or verification process.",
    ],
  },
  {
    question: "Does load-shedding affect South African student outcomes?",
    sources: [
      { label: "University of Cape Town research paper", type: "Academic", description: "Eskom impact study, peer-reviewed, 2023." },
      { label: "Stats SA household survey", type: "Government Data", description: "Official national statistics on household electricity access." },
      { label: "News24 article", type: "News", description: "Quotes two unnamed sources and one lecturer." },
      { label: "Reddit thread on r/southafrica", type: "Social Media", description: "Collection of anecdotes, upvoted 3k times." },
    ],
    correctOrder: [0, 1, 2, 3],
    explanations: [
      "Peer-reviewed research with a clear methodology is always the strongest source.",
      "Stats SA is an official government statistical service with rigorous collection standards.",
      "News reporting can be timely and informative but often lacks depth and verification.",
      "Reddit anecdotes reflect individual experiences, not representative data.",
    ],
  },
  {
    question: "What are the effects of the National Minimum Wage on youth employment?",
    sources: [
      { label: "DPME evaluation report", type: "Government", description: "Dept of Planning, Monitoring & Evaluation's official policy review." },
      { label: "NBER working paper", type: "Academic", description: "National Bureau of Economic Research pre-print, under peer review." },
      { label: "Business Day editorial", type: "News", description: "Editor's opinion with references to unnamed economists." },
      { label: "Wikipedia article", type: "Encyclopedia", description: "Crowd-sourced, cites 12 sources but may be outdated." },
    ],
    correctOrder: [0, 1, 2, 3],
    explanations: [
      "Official government evaluations use primary data and established methodology.",
      "Working papers are academic but not yet fully peer-reviewed — strong but provisional.",
      "Newspaper editorials represent informed opinion, not verified research.",
      "Wikipedia is useful for orientation but never citable in academic work.",
    ],
  },
  {
    question: "Is student debt affecting graduation rates in South Africa?",
    sources: [
      { label: "Higher Education SA (HESA) report", type: "Academic Body", description: "Annual sector-wide analysis of graduation and dropout trends." },
      { label: "NSFAS press release", type: "Official", description: "National Student Financial Aid Scheme, February 2024 statement." },
      { label: "TimesLIVE feature article", type: "News", description: "Interviews three affected students and one university finance manager." },
      { label: "Student Facebook group post", type: "Social Media", description: "Viral post with 12k shares, claims '80% of students can't pay fees'." },
    ],
    correctOrder: [0, 1, 2, 3],
    explanations: [
      "Sector-wide research bodies compile verified data from all universities.",
      "Official government agency statements are authoritative but may reflect institutional interests.",
      "Feature journalism can humanise issues but is anecdotal by design.",
      "Viral social media claims are almost never verified and often contain misinformation.",
    ],
  },
  {
    question: "Does bilingual education improve academic outcomes?",
    sources: [
      { label: "Meta-analysis in Applied Linguistics Quarterly", type: "Academic", description: "Synthesises 42 studies across 18 countries, 2022." },
      { label: "PanSALB policy document", type: "Official", description: "Pan South African Language Board's official language-in-education position." },
      { label: "Teacher blog post", type: "Blog", description: "Experienced teacher shares classroom observations, no citations." },
      { label: "YouTube video: 'Bilingualism explained'", type: "Video", description: "56k views, created by a language tutor, not an academic." },
    ],
    correctOrder: [0, 1, 2, 3],
    explanations: [
      "A meta-analysis that synthesises dozens of studies is the most rigorous form of evidence.",
      "Official language body positions are authoritative on policy but not always on research.",
      "A teacher's experience is valuable for practice but not generalisable evidence.",
      "YouTube content has no peer review or fact-checking process.",
    ],
  },
  {
    question: "How does poverty affect children's cognitive development?",
    sources: [
      { label: "Nature Neuroscience study", type: "Academic", description: "Neuroimaging study of 1,000 South African children, Nature, 2023." },
      { label: "UNICEF South Africa report", type: "International Body", description: "UNICEF's child poverty and development assessment for SA." },
      { label: "Podcast episode on child development", type: "Media", description: "Features two developmental psychologists, but no transcript or citations." },
      { label: "Parenting blog post", type: "Blog", description: "Personal anecdotes from a parent, 100k Instagram followers." },
    ],
    correctOrder: [0, 1, 2, 3],
    explanations: [
      "Nature is one of the world's most rigorous scientific journals — extremely high bar for publication.",
      "UNICEF uses verified data collection across countries with established child-welfare frameworks.",
      "Expert podcasts add context but are informal and may not represent scientific consensus.",
      "Social media reach and expertise are completely unrelated — popularity ≠ accuracy.",
    ],
  },
  {
    question: "What causes high unemployment among South African graduates?",
    sources: [
      { label: "World Bank SA economic review", type: "International Org", description: "Comprehensive labour market analysis using government datasets." },
      { label: "Statistics SA Quarterly Labour Force Survey", type: "Government Data", description: "Official employment data, Q3 2023." },
      { label: "Business Insider SA article", type: "Business News", description: "References HR professionals and one Stats SA chart." },
      { label: "LinkedIn post by a recruiter", type: "Social Media", description: "'In my experience...' 4,200 likes, based on one person's client base." },
    ],
    correctOrder: [0, 1, 2, 3],
    explanations: [
      "International organisations bring comparative data and independent analysis free of local political pressure.",
      "Stats SA's quarterly surveys are the official authoritative source for South African labour data.",
      "Business journalism covers economic news competently but is not a primary research source.",
      "A single recruiter's experience cannot represent a national labour market of millions.",
    ],
  },
  {
    question: "Does exercise improve academic performance in school students?",
    sources: [
      { label: "Systematic review in British Journal of Sports Medicine", type: "Academic", description: "Reviews 38 RCTs on exercise and cognition in school-age children." },
      { label: "SA Department of Sport & Recreation report", type: "Government", description: "Physical education participation and academic outcome tracking, 2022." },
      { label: "Health24 article", type: "Health Media", description: "References a single US study, quotes a personal trainer." },
      { label: "Instagram post by a fitness influencer", type: "Social Media", description: "#ExerciseYourMind caption, 89k likes." },
    ],
    correctOrder: [0, 1, 2, 3],
    explanations: [
      "Systematic reviews of randomised controlled trials represent the highest quality evidence.",
      "Government education departments track large populations with verified methodologies.",
      "Health journalism simplifies research for general audiences — helpful but not authoritative.",
      "Fitness influencer content is marketing, not evidence — no methodology or accountability.",
    ],
  },
  {
    question: "What are the long-term effects of COVID-19 on South African learners?",
    sources: [
      { label: "Economic Research Southern Africa (ERSA) working paper", type: "Academic", description: "Learning loss analysis using NIDS-CRAM household panel data." },
      { label: "DBE Annual Performance Plan 2023", type: "Government", description: "Department of Basic Education's official recovery plan and metrics." },
      { label: "The Conversation article by a UCT lecturer", type: "Expert Commentary", description: "Opinion piece, peer-reviewed outlet, author has a PhD in education." },
      { label: "Parent Facebook group discussion", type: "Social Media", description: "Thread with 340 comments, mostly personal experiences." },
    ],
    correctOrder: [0, 1, 2, 3],
    explanations: [
      "Using national panel data with academic rigour makes this highly reliable evidence.",
      "Official government plans are authoritative, though they may frame data optimistically.",
      "The Conversation publishes peer-reviewed expert commentary — better than standard journalism.",
      "Parent experiences capture lived reality but cannot stand in for representative research.",
    ],
  },
  {
    question: "Is entrepreneurship education effective for African university students?",
    sources: [
      { label: "African Journal of Business Management RCT study", type: "Academic", description: "Randomised controlled trial across 6 African universities, n=1,400." },
      { label: "SEDA (Small Enterprise Development Agency) evaluation", type: "Government", description: "Programme evaluation of government-funded entrepreneurship modules." },
      { label: "Forbes Africa '30 Under 30' profile", type: "Media", description: "Celebrates 30 successful young entrepreneurs, no academic methodology." },
      { label: "TikTok 'hustle culture' compilation", type: "Social Media", description: "Motivational clips, 2.1M views." },
    ],
    correctOrder: [0, 1, 2, 3],
    explanations: [
      "An RCT (randomised controlled trial) is the gold standard for measuring causality in education interventions.",
      "Government programme evaluations use established frameworks and have accountability to public funds.",
      "Success profiles show what's possible but suffer from survivorship bias — we don't see the failures.",
      "Motivational content is designed to inspire, not to inform — no evidence standard at all.",
    ],
  },
];

type Phase = "idle" | "ranking" | "result" | "done";

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function SourceSorterPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [roundIdx, setRoundIdx] = useState(0);
  const [shuffledSources, setShuffledSources] = useState<Source[]>([]);
  const [shuffleMap, setShuffleMap] = useState<number[]>([]);
  const [ranking, setRanking] = useState<number[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [roundScores, setRoundScores] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const startGame = () => {
    const round = ROUNDS[0];
    const indices = round.sources.map((_, i) => i);
    const shuffled = shuffle(indices);
    setShuffledSources(shuffled.map((i) => round.sources[i]));
    setShuffleMap(shuffled);
    setRoundIdx(0);
    setRanking([]);
    setTotalScore(0);
    setRoundScores([]);
    setSubmitted(false);
    setPhase("ranking");
  };

  const startRound = (idx: number) => {
    const round = ROUNDS[idx];
    const indices = round.sources.map((_, i) => i);
    const shuffled = shuffle(indices);
    setShuffledSources(shuffled.map((i) => round.sources[i]));
    setShuffleMap(shuffled);
    setRanking([]);
    setPhase("ranking");
  };

  const selectSource = (displayIdx: number) => {
    if (ranking.includes(displayIdx)) return;
    setRanking((prev) => [...prev, displayIdx]);
  };

  const removeFromRanking = (rankPos: number) => {
    setRanking((prev) => prev.filter((_, i) => i !== rankPos));
  };

  const submitRanking = () => {
    const round = ROUNDS[roundIdx];
    let score = 0;
    for (let rankPos = 0; rankPos < ranking.length; rankPos++) {
      const displayIdx = ranking[rankPos];
      const originalIdx = shuffleMap[displayIdx];
      const correctOriginalIdx = round.correctOrder[rankPos];
      if (originalIdx === correctOriginalIdx) score += 10;
    }
    const newScores = [...roundScores, score];
    setRoundScores(newScores);
    setTotalScore((prev) => prev + score);
    setPhase("result");
  };

  const nextRound = async () => {
    const next = roundIdx + 1;
    if (next >= ROUNDS.length) {
      setPhase("done");
      if (!submitted) {
        setSubmitted(true);
        await fetch("/api/games/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameType: "source_sorter", score: totalScore, metadata: { rounds: ROUNDS.length } }),
        }).catch(() => {});
      }
    } else {
      setRoundIdx(next);
      startRound(next);
    }
  };

  const round = ROUNDS[roundIdx];

  if (phase === "idle") {
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.intro}>
            <Link className="button" href="/community/games">← Games</Link>
            <h1>Source Sorter</h1>
            <p className="subtitle">Rank sources from most to least reliable for a given research question. 10 rounds · 40 points max each.</p>
            <div className={styles.howTo}>
              <h3>How to play</h3>
              <ul>
                <li>A research question appears with 4 sources.</li>
                <li>Click sources in order from most reliable (1st) to least reliable (4th).</li>
                <li>10 points for each correctly placed source.</li>
                <li>After ranking, see why each placement was right or wrong.</li>
              </ul>
            </div>
            <button className="button" onClick={startGame}>Start game</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "ranking") {
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.header}>
            <span className={styles.progress}>Round {roundIdx + 1} / {ROUNDS.length}</span>
            <span className={styles.score}>Score: {totalScore}</span>
          </div>
          <h2 className={styles.question}>{round.question}</h2>
          <p className={styles.instruction}>Click sources from most reliable (1st) to least reliable (4th).</p>

          <div className={styles.rankSlots}>
            {[0, 1, 2, 3].map((rankPos) => (
              <div key={rankPos} className={styles.rankSlot}>
                <span className={styles.rankNum}>{rankPos + 1}</span>
                {ranking[rankPos] !== undefined ? (
                  <div className={`${styles.sourceCard} ${styles.placed}`} onClick={() => removeFromRanking(rankPos)}>
                    <strong>{shuffledSources[ranking[rankPos]].label}</strong>
                    <span className={styles.sourceType}>{shuffledSources[ranking[rankPos]].type}</span>
                    <span className={styles.removeHint}>✕ click to remove</span>
                  </div>
                ) : (
                  <div className={`${styles.sourceCard} ${styles.empty}`}>
                    <span className={styles.emptyLabel}>Drop here</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className={styles.sourcePool}>
            {shuffledSources.map((source, displayIdx) => (
              !ranking.includes(displayIdx) && (
                <div key={displayIdx} className={styles.sourceCard} onClick={() => selectSource(displayIdx)}>
                  <strong>{source.label}</strong>
                  <span className={styles.sourceType}>{source.type}</span>
                  <p className={styles.sourceDesc}>{source.description}</p>
                </div>
              )
            ))}
          </div>

          {ranking.length === 4 && (
            <button className="button" onClick={submitRanking}>Submit ranking</button>
          )}
        </div>
      </div>
    );
  }

  if (phase === "result") {
    const roundScore = roundScores[roundScores.length - 1];
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.header}>
            <span className={styles.progress}>Round {roundIdx + 1} / {ROUNDS.length}</span>
            <span className={styles.score}>+{roundScore} this round · {totalScore} total</span>
          </div>
          <h2 className={styles.question}>{round.question}</h2>

          <div className={styles.resultList}>
            {round.correctOrder.map((originalIdx, rankPos) => {
              const playerOriginalIdx = ranking[rankPos] !== undefined ? shuffleMap[ranking[rankPos]] : -1;
              const correct = playerOriginalIdx === originalIdx;
              return (
                <div key={rankPos} className={`${styles.resultRow} ${correct ? styles.correct : styles.wrong}`}>
                  <span className={styles.rankNum}>{rankPos + 1}</span>
                  <div>
                    <strong>{round.sources[originalIdx].label}</strong>
                    <p className={styles.explanation}>{round.explanations[rankPos]}</p>
                    {!correct && ranking[rankPos] !== undefined && (
                      <p className={styles.yourAnswer}>
                        You placed: {round.sources[shuffleMap[ranking[rankPos]]].label}
                      </p>
                    )}
                  </div>
                  <span className={styles.tick}>{correct ? "✓" : "✗"}</span>
                </div>
              );
            })}
          </div>

          <button className="button" onClick={nextRound}>
            {roundIdx + 1 < ROUNDS.length ? "Next round →" : "See final score"}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const maxScore = ROUNDS.length * 40;
    const pct = Math.round((totalScore / maxScore) * 100);
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.done}>
            <h1>{totalScore >= 320 ? "Information Literacy Expert" : totalScore >= 240 ? "Strong Researcher" : "Keep Practising"}</h1>
            <p className={styles.finalScore}>{totalScore} / {maxScore} points · {pct}%</p>
            <p className="subtitle">
              Your ability to evaluate sources critically determines the quality of your academic work.
              {totalScore >= 320 ? " You consistently identified the most rigorous sources." : " Focus on understanding what makes each source type stronger or weaker."}
            </p>
            <div className={styles.doneActions}>
              <button className="button" onClick={startGame}>Play again</button>
              <Link className="button" href="/community/games">All games</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
