"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

type Option = { text: string; score: 0 | 1 | 2; feedback: string };
type Question = { question: string; context?: string; options: Option[] };
type Employer = { name: string; role: string; company: string; questions: Question[] };

const EMPLOYERS: Employer[] = [
  {
    name: "Zanele Mokoena",
    role: "HR Manager",
    company: "Standard Bank",
    questions: [
      {
        question: "Tell me about yourself.",
        options: [
          { text: "I'm a BCom student at NWU, specialising in Finance. I've maintained a 72% average, volunteered as a peer tutor, and I'm passionate about credit risk analysis.", score: 2, feedback: "Excellent — structured, relevant, and demonstrates initiative beyond academics." },
          { text: "I'm 21, I grew up in Soweto, I love football and I'm studying at university.", score: 0, feedback: "This response is personal but irrelevant. Answer with academic background, skills, and career interest." },
          { text: "I'm a hard-working and passionate person who loves challenges and thinks outside the box.", score: 1, feedback: "These are clichés. Generic phrases without evidence don't differentiate you from other candidates." },
          { text: "Uhh, I'm not sure where to start. I've been studying finance and stuff…", score: 0, feedback: "Lack of preparation signals disinterest. Practice a 60-second structured self-introduction." },
        ],
      },
      {
        question: "Why do you want to work at Standard Bank specifically?",
        options: [
          { text: "Standard Bank has the most extensive continental African presence of any bank — your operations in 20 countries align with my interest in African economic development.", score: 2, feedback: "Specific research into the company shows genuine interest and preparation." },
          { text: "I've always wanted to work in banking and Standard Bank is a big bank so it makes sense.", score: 1, feedback: "Shows basic reasoning but no specific knowledge of the company. Research the employer's strategy." },
          { text: "Honestly, I applied to multiple banks — Standard Bank was just one of them.", score: 0, feedback: "Honesty is admirable but this answer shows no company-specific interest. Never say this." },
          { text: "My aunt works here so I know it's a good place to work.", score: 0, feedback: "Personal connections may have informed your interest but this is not a professional answer to this question." },
        ],
      },
      {
        question: "Where do you see yourself in five years?",
        options: [
          { text: "In five years I'd like to have completed my Chartered Financial Analyst qualification and be managing a portfolio within Standard Bank's credit risk division.", score: 2, feedback: "Specific, ambitious, and directly relevant to the role and company — exactly what employers want." },
          { text: "Hopefully still here, working my way up. I just want to be stable and have a good salary.", score: 1, feedback: "Understandable but too vague. Show professional ambition and link it to the company's growth." },
          { text: "I haven't thought that far ahead — five years is a long time.", score: 0, feedback: "This signals lack of direction. Every candidate should have a professional 5-year vision prepared." },
          { text: "I want to start my own business eventually, so this would be a stepping stone.", score: 0, feedback: "Telling an employer you plan to leave destroys the business case for hiring and training you." },
        ],
      },
    ],
  },
  {
    name: "Sipho Dlamini",
    role: "Operations Director",
    company: "GreenSpace NGO",
    questions: [
      {
        question: "Describe a time you had to work with a difficult person.",
        context: "This is a behavioural question — use the STAR method (Situation, Task, Action, Result).",
        options: [
          { text: "During a group project, a team member repeatedly missed deadlines. I arranged a one-on-one conversation to understand their constraints, redistributed tasks, and we submitted on time.", score: 2, feedback: "Clear STAR structure, shows emotional intelligence and problem-solving without blame." },
          { text: "Honestly, I just avoid difficult people. Life's too short to deal with drama.", score: 0, feedback: "This signals poor conflict resolution skills — a critical professional competency." },
          { text: "In a previous part-time job, a colleague was rude to me. I reported it to management and it got resolved.", score: 1, feedback: "Describes a situation but doesn't show what you personally did to resolve it. You escalated, not resolved." },
          { text: "I've never had that problem — I get along with everyone.", score: 0, feedback: "Not credible. Experienced interviewers know everyone encounters conflict. Prepare a real example." },
        ],
      },
      {
        question: "What is your biggest weakness?",
        options: [
          { text: "I struggle to delegate — I tend to take on too much to ensure quality. I've been working on this by deliberately assigning tasks in group projects and following up without micromanaging.", score: 2, feedback: "This is the ideal format: real weakness + evidence of self-awareness + active steps to improve." },
          { text: "I'm a perfectionist — I just care too much about doing things right.", score: 0, feedback: "This is the most over-used, insincere answer in job interviews. Interviewers immediately discount it." },
          { text: "I don't really have weaknesses. I pick things up quickly.", score: 0, feedback: "Claiming no weaknesses shows lack of self-awareness — a serious red flag for any employer." },
          { text: "I sometimes struggle with deadlines when I'm under pressure.", score: 1, feedback: "Honest but concerning without the follow-up. Add what you're doing to address it." },
        ],
      },
      {
        question: "Why should we hire you over other candidates?",
        options: [
          { text: "I bring three specific things your job description highlights: data analysis experience (I've done SPSS for two research papers), fluency in Zulu and Xhosa for community fieldwork, and I've volunteered at a township literacy NGO for two years.", score: 2, feedback: "This maps your specific skills directly to the role's needs — the most compelling possible answer." },
          { text: "I'm hardworking, motivated, and a quick learner. I'll give 100%.", score: 0, feedback: "Every candidate says this. Generic qualities without evidence are meaningless in a competitive pool." },
          { text: "I need this job and I'll work really hard to prove myself.", score: 0, feedback: "Expressing need is not a value proposition for the employer. Focus on what you bring, not what you need." },
          { text: "I'm not sure — you'd have to decide based on all the interviews.", score: 1, feedback: "Shows humility but misses the opportunity. This is your moment to make the case for yourself." },
        ],
      },
    ],
  },
  {
    name: "Kefilwe Sithole",
    role: "Recruitment Lead",
    company: "Shoprite Group",
    questions: [
      {
        question: "What is your salary expectation?",
        context: "This is asked for a graduate retail management trainee position.",
        options: [
          { text: "Based on my research, the market range for this role in retail is R12,000–R16,000 per month. Given that I'm a recent graduate, I'd be comfortable starting at the lower end while building experience.", score: 2, feedback: "Demonstrates research, realistic expectations, and flexibility. This is the professional approach." },
          { text: "I don't mind, whatever you think is fair.", score: 0, feedback: "Appearing without expectations signals poor self-worth and knowledge of the market. Always state a range." },
          { text: "I need at least R25,000 — that's my minimum because of my expenses.", score: 0, feedback: "Citing personal expenses is irrelevant to the employer. The market, not your bills, sets salary expectations." },
          { text: "I'd rather not say — what's the budget for this role?", score: 1, feedback: "It's acceptable to ask, but you should still be prepared to state a researched range if pressed." },
        ],
      },
      {
        question: "How do you handle working under pressure?",
        options: [
          { text: "During my final exams, I managed four assignments and two tests in one week. I used a priority matrix to rank deadlines, blocked study time, and delivered all submissions on time.", score: 2, feedback: "Concrete, specific example with a methodology — shows you handle pressure systematically." },
          { text: "I actually work better under pressure — stress motivates me.", score: 1, feedback: "Plausible but unsubstantiated. Back it up with an example to make it credible." },
          { text: "I find it very stressful honestly. I try to take breaks and relax.", score: 0, feedback: "Describing pressure negatively without a coping strategy raises concern for a high-paced retail environment." },
          { text: "I try to focus on one thing at a time and not panic.", score: 1, feedback: "This shows a basic strategy but lacks specificity. Add a real example of a pressured situation you handled." },
        ],
      },
    ],
  },
];

type Phase = "idle" | "playing" | "feedback" | "done";

function getOutcome(total: number, max: number) {
  const pct = total / max;
  if (pct >= 0.8) return { label: "Hired", description: "Outstanding performance. You demonstrated preparation, self-awareness, and professionalism across the board." };
  if (pct >= 0.6) return { label: "Second Interview", description: "Strong showing with a few areas to sharpen. Review the feedback and you'll be ready for round two." };
  return { label: "Thanks, we'll be in touch", description: "You showed promise in places, but need more preparation. Study the feedback and practise your answers." };
}

export default function InterviewSurvivalPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [employerIdx, setEmployerIdx] = useState(0);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [chosen, setChosen] = useState<Option | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [maxScore, setMaxScore] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const employer = EMPLOYERS[employerIdx];
  const question = employer?.questions[questionIdx];

  const totalQuestions = EMPLOYERS.reduce((sum, e) => sum + e.questions.length, 0);
  let currentQuestion = 0;
  for (let i = 0; i < employerIdx; i++) currentQuestion += EMPLOYERS[i].questions.length;
  currentQuestion += questionIdx + 1;

  const startGame = () => {
    setEmployerIdx(0);
    setQuestionIdx(0);
    setChosen(null);
    setTotalScore(0);
    setMaxScore(0);
    setSubmitted(false);
    setPhase("playing");
  };

  const selectOption = (option: Option) => {
    setChosen(option);
    setTotalScore((prev) => prev + option.score);
    setMaxScore((prev) => prev + 2);
    setPhase("feedback");
  };

  const nextQuestion = async () => {
    const nextQIdx = questionIdx + 1;
    if (nextQIdx < employer.questions.length) {
      setQuestionIdx(nextQIdx);
      setChosen(null);
      setPhase("playing");
    } else {
      const nextEIdx = employerIdx + 1;
      if (nextEIdx < EMPLOYERS.length) {
        setEmployerIdx(nextEIdx);
        setQuestionIdx(0);
        setChosen(null);
        setPhase("playing");
      } else {
        setPhase("done");
        if (!submitted) {
          setSubmitted(true);
          await fetch("/api/games/scores", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ gameType: "interview_survival", score: totalScore, metadata: { employers: EMPLOYERS.length } }),
          }).catch(() => {});
        }
      }
    }
  };

  if (phase === "idle") {
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.intro}>
            <Link className="button" href="/community/games">← Games</Link>
            <h1>Interview Survival</h1>
            <p className="subtitle">Navigate real-world job interview questions with 3 South African employers. Pick the best response and learn why it works.</p>
            <div className={styles.employers}>
              {EMPLOYERS.map((e) => (
                <div key={e.name} className={styles.employerCard}>
                  <strong>{e.role}</strong>
                  <span className="subtitle">{e.company}</span>
                </div>
              ))}
            </div>
            <button className="button" onClick={startGame}>Start interview</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "playing" && question) {
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.header}>
            <span className={styles.progress}>Q{currentQuestion} / {totalQuestions}</span>
            <span className={styles.score}>{totalScore}/{maxScore} pts</span>
          </div>

          <div className={styles.employerBanner}>
            <strong>{employer.name}</strong>
            <span>{employer.role} · {employer.company}</span>
          </div>

          {question.context && <p className={styles.context}>{question.context}</p>}
          <h2 className={styles.question}>"{question.question}"</h2>

          <div className={styles.options}>
            {question.options.map((opt, i) => (
              <button key={i} className={styles.optionBtn} onClick={() => selectOption(opt)}>
                {opt.text}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (phase === "feedback" && chosen && question) {
    const scoreLabel = chosen.score === 2 ? "Excellent" : chosen.score === 1 ? "Acceptable" : "Poor";
    const scoreClass = chosen.score === 2 ? styles.excellent : chosen.score === 1 ? styles.acceptable : styles.poor;
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.header}>
            <span className={styles.progress}>Q{currentQuestion} / {totalQuestions}</span>
            <span className={styles.score}>{totalScore}/{maxScore} pts</span>
          </div>

          <div className={styles.employerBanner}>
            <strong>{employer.name}</strong>
            <span>{employer.role} · {employer.company}</span>
          </div>

          <h2 className={styles.question}>"{question.question}"</h2>
          <div className={`${styles.chosenAnswer} ${scoreClass}`}>
            <div className={styles.scoreTag}>{scoreLabel} · {chosen.score === 2 ? "+2" : chosen.score === 1 ? "+1" : "+0"} pts</div>
            <p className={styles.chosenText}>"{chosen.text}"</p>
          </div>
          <div className={styles.feedbackBox}>
            <strong>Why:</strong> {chosen.feedback}
          </div>

          {chosen.score < 2 && (
            <div className={styles.bestAnswer}>
              <strong>Best answer:</strong>
              <p>{question.options.find((o) => o.score === 2)?.text}</p>
            </div>
          )}

          <button className="button" onClick={nextQuestion}>
            {questionIdx + 1 < employer.questions.length || employerIdx + 1 < EMPLOYERS.length
              ? "Next question →"
              : "See final result"}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const outcome = getOutcome(totalScore, maxScore);
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.done}>
            <div className={styles.outcomeLabel}>{outcome.label}</div>
            <p className={styles.finalScore}>{totalScore} / {maxScore} points</p>
            <p className="subtitle">{outcome.description}</p>
            <div className={styles.doneActions}>
              <button className="button" onClick={startGame}>Try again</button>
              <Link className="button" href="/community/games">All games</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
