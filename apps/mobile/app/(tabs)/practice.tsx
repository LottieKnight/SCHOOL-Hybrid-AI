import * as Haptics from "expo-haptics";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Screen } from "../../src/components/ui/Screen";
import { GlassCard } from "../../src/components/ui/GlassCard";
import { Button } from "../../src/components/ui/Button";
import { colors, radius, spacing } from "../../src/theme/tokens";
import {
  fetchModuleCatalog,
  fetchLessonDetail,
  getFeaturedModule,
  resolveLessonLookup,
  type LessonContent,
} from "../../src/lib/api/learn";
import {
  fetchDailyQuiz,
  fetchQuizHeatmap,
  recordQuizAttempt,
  submitDailyQuiz,
  type DailyQuizReadyResponse,
  type DailyQuizSubmitResponse,
} from "../../src/lib/api/quiz";
import { QuizHeatmapGrid } from "../../src/components/gamification/QuizHeatmapGrid";
import { useCelebrationStore } from "../../src/store/celebrationStore";

type Mode = "daily" | "practice";

type MCQQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
  lessonKey: string;
  subject: string;
  grade: number;
};

function extractQuestions(lessons: LessonContent[], subject: string, grade: number, lessonKey: string): MCQQuestion[] {
  return lessons
    .flatMap((lesson) =>
      lesson.quiz.questions
        .filter((q) => q.type === "mcq" && q.options && q.options.length >= 2)
        .map((q) => ({
          id: q.id,
          prompt: q.prompt,
          options: q.options!,
          answer: q.answer,
          explanation: q.explanation,
          lessonKey,
          subject,
          grade,
        }))
    )
    .slice(0, 10);
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function deriveStreak(weeks: { date: string; score: number | null }[][]) {
  const flattened = weeks.flat();
  let streak = 0;
  for (let index = flattened.length - 1; index >= 0; index -= 1) {
    if (flattened[index]?.score === null) break;
    streak += 1;
  }
  return streak;
}

function isStreakMilestone(streak: number) {
  return streak > 0 && streak % 5 === 0;
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (next: Mode) => void;
}) {
  return (
    <GlassCard style={styles.toggleCard}>
      <View style={styles.toggleRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange("daily")}
          style={[styles.toggleChip, mode === "daily" && styles.toggleChipActive]}
        >
          <Text style={[styles.toggleLabel, mode === "daily" && styles.toggleLabelActive]}>Daily challenge</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange("practice")}
          style={[styles.toggleChip, mode === "practice" && styles.toggleChipActive]}
        >
          <Text style={[styles.toggleLabel, mode === "practice" && styles.toggleLabelActive]}>Practice mode</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/practice/past-papers")}
          style={styles.toggleChip}
        >
          <Text style={styles.toggleLabel}>Past papers</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/tutor")}
          style={styles.toggleChip}
        >
          <Text style={styles.toggleLabel}>Hybrid tutor</Text>
        </Pressable>
      </View>
    </GlassCard>
  );
}

function DailyChallengePanel() {
  const heatmapQuery = useQuery({
    queryKey: ["quiz-heatmap"],
    queryFn: fetchQuizHeatmap,
  });
  const dailyQuery = useQuery({
    queryKey: ["daily-quiz"],
    queryFn: fetchDailyQuiz,
  });

  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<DailyQuizSubmitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const triggerCelebration = useCelebrationStore((state) => state.trigger);

  const streak = useMemo(() => deriveStreak(heatmapQuery.data?.weeks ?? []), [heatmapQuery.data?.weeks]);
  const quiz = dailyQuery.data && "questions" in dailyQuery.data ? (dailyQuery.data as DailyQuizReadyResponse) : null;
  const completedToday = Boolean(dailyQuery.data && "completed" in dailyQuery.data && dailyQuery.data.completed);
  const currentQuestion = quiz?.questions[currentIndex] ?? null;
  const answeredCount = quiz ? quiz.questions.filter((question) => (answers[question.id] ?? "").trim().length > 0).length : 0;
  const progressPercent = quiz && quiz.questions.length > 0 ? ((currentIndex + 1) / quiz.questions.length) * 100 : 0;

  const reset = () => {
    setStarted(false);
    setCurrentIndex(0);
    setAnswers({});
    setSubmitting(false);
    setResults(null);
  };

  const startQuiz = () => {
    if (!quiz) return;
    setStarted(true);
    setResults(null);
    setCurrentIndex(0);
    setAnswers({});
    setError(null);
  };

  const handleNext = () => {
    if (!currentQuestion) return;
    const currentAnswer = (answers[currentQuestion.id] ?? "").trim();
    if (!currentAnswer) {
      setError("Add an answer before moving on.");
      return;
    }
    setError(null);
    setCurrentIndex((index) => Math.min(index + 1, quiz ? quiz.questions.length - 1 : index));
  };

  const handleSubmit = async () => {
    if (!quiz) return;

    const payloadAnswers = Object.fromEntries(
      quiz.questions.map((question) => [question.id, answers[question.id] ?? ""])
    );

    if (Object.values(payloadAnswers).some((value) => value.trim().length === 0)) {
      setError("Answer every question before submitting.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await submitDailyQuiz({
        quizId: quiz.quizId,
        date: quiz.date,
        answers: payloadAnswers,
      });
      setResults(response);
      if (response.scorePercent >= 80 || isStreakMilestone(response.newStreak)) {
        triggerCelebration(
          response.scorePercent >= 80
            ? {
                kind: "quiz",
                title: "Great score",
                message: `${Math.round(response.scorePercent)}% on today's challenge.`,
              }
            : {
                kind: "streak",
                title: "Streak milestone",
                message: `${response.newStreak} days of consistency.`,
              }
        );
      }
      void Haptics.notificationAsync(
        response.scorePercent >= 80
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning
      );
      void heatmapQuery.refetch();
      void dailyQuery.refetch();
    } catch {
      setResults(null);
      setError("Could not submit the quiz right now.");
    } finally {
      setSubmitting(false);
    }
  };

  if (heatmapQuery.isLoading || dailyQuery.isLoading) {
    return (
      <GlassCard style={styles.loadingCard}>
        <ActivityIndicator color={colors.gold} />
        <Text style={styles.loadingText}>Loading today's quiz...</Text>
      </GlassCard>
    );
  }

  if (heatmapQuery.isError || dailyQuery.isError) {
    return (
      <GlassCard style={styles.errorCard}>
        <Text style={styles.errorTitle}>Daily quiz unavailable</Text>
        <Text style={styles.errorCopy}>We couldn’t load the challenge or streak data right now.</Text>
        <Button
          onPress={() => {
            void heatmapQuery.refetch();
            void dailyQuery.refetch();
          }}
          style={styles.retryButton}
        >
          Try again
        </Button>
      </GlassCard>
    );
  }

  if (completedToday && dailyQuery.data && "completed" in dailyQuery.data && !started && !results) {
    const completedQuiz = dailyQuery.data as { completed: true; score: number };
    return (
      <GlassCard style={styles.resultCard}>
        <Text style={styles.resultKicker}>Daily challenge complete</Text>
        <Text style={styles.resultTitle}>{Math.round(completedQuiz.score)}%</Text>
        <Text style={styles.resultCopy}>You’ve already finished today’s quiz. Come back tomorrow for a fresh set.</Text>
        <Button variant="ghost" onPress={reset} style={styles.fullButton}>
          Refresh
        </Button>
      </GlassCard>
    );
  }

  if (results && quiz) {
    return (
      <View style={styles.resultWrap}>
        <GlassCard style={styles.resultCard}>
          <Text style={styles.resultKicker}>Daily challenge result</Text>
          <Text style={styles.resultTitle}>{Math.round(results.scorePercent)}%</Text>
          <Text style={styles.resultCopy}>
            {results.streakBroken ? "Your streak restarted today." : `You are on a ${results.newStreak} day streak.`}
          </Text>
          <View style={styles.scorePill}>
            <Text style={styles.scorePillLabel}>{results.score} correct</Text>
          </View>
        </GlassCard>

        <View style={styles.reviewList}>
          {quiz.questions.map((question, index) => {
            const result = results.answers.find((item) => item.questionId === question.id);
            return (
              <GlassCard key={question.id} style={styles.reviewCard}>
                <Text style={styles.reviewKicker}>Question {index + 1}</Text>
                <Text style={styles.reviewQuestion}>{question.question_text}</Text>
                <Text style={[styles.reviewStatus, result?.correct ? styles.correct : styles.incorrect]}>
                  {result?.correct ? "Correct" : "Incorrect"}
                </Text>
                {!result?.correct ? (
                  <Text style={styles.reviewAnswer}>Answer: {result?.correctAnswer ?? ""}</Text>
                ) : null}
              </GlassCard>
            );
          })}
        </View>

        <Button onPress={reset}>Try again</Button>
      </View>
    );
  }

  if (!started && quiz) {
    return (
      <View style={styles.dailyIdle}>
        <QuizHeatmapGrid weeks={heatmapQuery.data?.weeks ?? []} streak={streak} />

        <GlassCard style={styles.dailyCard}>
          <Text style={styles.cardTitle}>Daily challenge ready</Text>
          <Text style={styles.cardCopy}>
            Five free-response questions tuned from your live study activity and weakness signals.
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaChip}>5 questions</Text>
            <Text style={styles.metaChip}>{quiz.weaknessSubjects[0] ?? "mixed revision"}</Text>
          </View>
          <Button onPress={startQuiz} style={styles.fullButton}>
            Start Daily Challenge
          </Button>
          {error ? <Text style={styles.inlineError}>{error}</Text> : null}
        </GlassCard>
      </View>
    );
  }

  if (started && quiz && currentQuestion) {
    return (
      <View style={styles.quizWrap}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>

        <View style={styles.counterRow}>
          <Text style={styles.counterText}>
            {currentIndex + 1} / {quiz.questions.length}
          </Text>
          <Text style={styles.counterText}>{answeredCount} answered</Text>
        </View>

        <GlassCard style={styles.questionCard}>
          <View style={styles.questionHeader}>
            <Text style={styles.questionKicker}>Question {currentIndex + 1}</Text>
            <Text style={styles.subjectChip}>{currentQuestion.subject}</Text>
          </View>
          <Text style={styles.questionText}>{currentQuestion.question_text}</Text>
          <TextInput
            multiline
            value={answers[currentQuestion.id] ?? ""}
            onChangeText={(value) =>
              {
                setError(null);
                setAnswers((current) => ({
                  ...current,
                  [currentQuestion.id]: value,
                }));
              }
            }
            placeholder="Type your answer"
            placeholderTextColor={colors.textSoft}
            style={styles.answerInput}
          />
          <View style={styles.questionActions}>
            {currentIndex < quiz.questions.length - 1 ? (
              <Button variant="ghost" onPress={handleNext} style={styles.actionButton}>
                Next question
              </Button>
            ) : (
              <Button variant="ghost" onPress={() => void handleSubmit()} disabled={submitting} style={styles.actionButton}>
                {submitting ? "Submitting..." : "Submit quiz"}
              </Button>
            )}
          </View>
          {error ? <Text style={styles.inlineError}>{error}</Text> : null}
        </GlassCard>
      </View>
    );
  }

  return null;
}

type QuizState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "playing"; questions: MCQQuestion[]; index: number; selected: string | null; score: number }
  | { phase: "result"; score: number; total: number };

function OptionButton({
  label,
  selected,
  correct,
  revealed,
  onPress,
}: {
  label: string;
  selected: boolean;
  correct: boolean;
  revealed: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSequence(withSpring(0.95, { mass: 0.2 }), withSpring(1, { mass: 0.2 }));
    onPress();
  };

  let bg = colors.surface2;
  let border = colors.border;
  let textColor = colors.text;

  if (revealed) {
    if (correct) {
      bg = "rgba(16,185,129,0.15)";
      border = colors.green;
      textColor = colors.green;
    } else if (selected) {
      bg = "rgba(239,68,68,0.12)";
      border = colors.red;
      textColor = colors.red;
    }
  } else if (selected) {
    bg = "rgba(255,215,0,0.1)";
    border = colors.gold;
    textColor = colors.gold;
  }

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={revealed ? undefined : handlePress}
        style={[styles.option, { backgroundColor: bg, borderColor: border }]}
      >
        <Text style={[styles.optionText, { color: textColor }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function PracticeModePanel() {
  const [state, setState] = useState<QuizState>({ phase: "idle" });
  const [revealed, setRevealed] = useState(false);
  const triggerCelebration = useCelebrationStore((state) => state.trigger);

  const catalogQuery = useQuery({
    queryKey: ["module-catalog"],
    queryFn: fetchModuleCatalog,
  });

  const startQuiz = async () => {
    setState({ phase: "loading" });
    try {
      const catalog = catalogQuery.data ?? (await fetchModuleCatalog());
      const featured = getFeaturedModule(catalog.modules);
      if (!featured) throw new Error("No modules found");

      const lookup = resolveLessonLookup(featured.moduleCode, "1");
      if (!lookup) throw new Error("Cannot resolve lesson");

      const lessons = await Promise.all(
        [1, 2, 3].map((week) =>
          fetchLessonDetail({ ...lookup, week }).catch(() => null)
        )
      );

      const valid = lessons.filter((lesson): lesson is LessonContent => lesson !== null);
      const lessonKey = `${lookup.subject}/term${lookup.term}/week1`;
      const questions = shuffle(extractQuestions(valid, lookup.subject, lookup.grade, lessonKey));

      if (questions.length === 0) throw new Error("No MCQ questions available");

      setState({ phase: "playing", questions, index: 0, selected: null, score: 0 });
      setRevealed(false);
    } catch {
      setState({ phase: "idle" });
    }
  };

  const handleSelect = (option: string) => {
    if (state.phase !== "playing" || revealed) return;
    setState({ ...state, selected: option });
    setRevealed(true);

    const q = state.questions[state.index];
    const correct = option === q.answer;
    if (correct) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleNext = async () => {
    if (state.phase !== "playing") return;
    const q = state.questions[state.index];
    const correct = state.selected === q.answer;
    const newScore = state.score + (correct ? 1 : 0);
    const nextIndex = state.index + 1;

    if (nextIndex >= state.questions.length) {
      const total = state.questions.length;
      const scorePercent = Math.round((newScore / total) * 100);
      void recordQuizAttempt({
        subject: q.subject,
        grade: q.grade,
        lessonKey: q.lessonKey,
        scorePercent,
        correctCount: newScore,
        totalCount: total,
      }).catch(() => null);
      if (scorePercent >= 80) {
        triggerCelebration({
          kind: "quiz",
          title: "Great work",
          message: `${scorePercent}% on practice mode.`,
        });
      }
      setState({ phase: "result", score: newScore, total });
    } else {
      setState({ ...state, index: nextIndex, selected: null, score: newScore });
      setRevealed(false);
    }
  };

  if (state.phase === "loading") {
    return (
      <GlassCard style={styles.loadingCard}>
        <ActivityIndicator color={colors.gold} size="large" />
        <Text style={styles.loadingText}>Preparing your quiz...</Text>
      </GlassCard>
    );
  }

  if (state.phase === "result") {
    const pct = Math.round((state.score / state.total) * 100);
    return (
      <View style={styles.resultWrap}>
        <GlassCard style={styles.resultCard}>
          <Text style={styles.resultKicker}>Result</Text>
          <Text style={styles.resultTitle}>{pct >= 70 ? "Great work." : "Keep going."}</Text>
          <Text style={styles.scoreBig}>{pct}%</Text>
          <Text style={styles.resultCopy}>
            {state.score} / {state.total} correct
          </Text>
          <Button
            onPress={() => {
              setState({ phase: "idle" });
              setRevealed(false);
            }}
            style={styles.fullButton}
          >
            Try again
          </Button>
        </GlassCard>
      </View>
    );
  }

  if (state.phase === "playing") {
    const q = state.questions[state.index];
    const total = state.questions.length;
    const progress = (state.index + 1) / total;

    return (
      <View style={styles.quizWrap}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <View style={styles.counterRow}>
          <Text style={styles.counterText}>
            {state.index + 1} / {total}
          </Text>
        </View>

        <View style={styles.questionWrap}>
          <Text style={styles.questionText}>{q.prompt}</Text>
        </View>

        <View style={styles.options}>
          {q.options.map((opt) => (
            <OptionButton
              key={opt}
              label={opt}
              selected={state.selected === opt}
              correct={opt === q.answer}
              revealed={revealed}
              onPress={() => handleSelect(opt)}
            />
          ))}
        </View>

        {revealed && (
          <GlassCard style={styles.explanationBox}>
            <Text style={styles.explanationText}>{q.explanation}</Text>
          </GlassCard>
        )}

        {revealed && (
          <Button onPress={() => void handleNext()} style={styles.nextBtn}>
            {state.index + 1 >= total ? "See result" : "Next question"}
          </Button>
        )}
      </View>
    );
  }

  return (
    <GlassCard style={styles.dailyIdleCard}>
      <Text style={styles.cardTitle}>Practice mode</Text>
      <Text style={styles.cardCopy}>
        Ten MCQ questions pulled from your live study modules with haptic feedback and score tracking.
      </Text>
      <Button onPress={() => void startQuiz()} style={styles.fullButton}>
        Start quiz
      </Button>
    </GlassCard>
  );
}

export default function PracticeScreen() {
  const [mode, setMode] = useState<Mode>("daily");

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.kicker}>PRACTICE</Text>
        <Text style={styles.title}>Test your knowledge.</Text>
      </View>

      <ModeToggle mode={mode} onChange={setMode} />

      {mode === "daily" ? <DailyChallengePanel /> : <PracticeModePanel />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  kicker: {
    color: colors.gold,
    fontWeight: "800",
    letterSpacing: 2,
    fontSize: 12,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
  },
  toggleCard: {
    marginBottom: spacing.md,
  },
  toggleRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  toggleChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  toggleChipActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  toggleLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  toggleLabelActive: {
    color: colors.backgroundDeep,
  },
  loadingCard: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 15,
  },
  errorCard: {
    gap: spacing.sm,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  errorCopy: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  retryButton: {
    alignSelf: "flex-start",
  },
  dailyIdle: {
    gap: spacing.md,
  },
  dailyCard: {
    gap: spacing.sm,
  },
  dailyIdleCard: {
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 17,
    marginBottom: spacing.xs,
  },
  cardCopy: {
    color: colors.textMuted,
    lineHeight: 21,
    fontSize: 14,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaChip: {
    color: colors.text,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    fontSize: 12,
    fontWeight: "700",
  },
  fullButton: {
    width: "100%",
    marginTop: spacing.xs,
  },
  quizWrap: {
    gap: spacing.md,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.surface2,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.gold,
    borderRadius: radius.full,
  },
  counterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  counterText: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: "700",
  },
  questionCard: {
    gap: spacing.md,
  },
  questionWrap: {
    marginBottom: spacing.lg,
  },
  questionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    alignItems: "center",
  },
  questionKicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  subjectChip: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  questionText: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "700",
  },
  answerInput: {
    minHeight: 120,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    textAlignVertical: "top",
  },
  questionActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  actionButton: {
    minWidth: 140,
  },
  explanationBox: {
    padding: spacing.md,
  },
  explanationText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  nextBtn: {
    marginTop: spacing.xs,
    alignSelf: "flex-end",
  },
  resultWrap: {
    gap: spacing.md,
  },
  resultCard: {
    gap: spacing.sm,
    alignItems: "center",
  },
  resultKicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  resultTitle: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
  },
  resultCopy: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  scorePill: {
    borderRadius: radius.full,
    backgroundColor: "rgba(255,215,0,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,215,0,0.18)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  scorePillLabel: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "800",
  },
  reviewList: {
    gap: spacing.sm,
  },
  reviewCard: {
    gap: spacing.xs,
  },
  reviewKicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  reviewQuestion: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
  },
  reviewStatus: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  correct: {
    color: colors.green,
  },
  incorrect: {
    color: colors.red,
  },
  reviewAnswer: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  inlineError: {
    color: colors.red,
    fontSize: 13,
    lineHeight: 18,
  },
  scoreBig: {
    color: colors.gold,
    fontSize: 56,
    lineHeight: 64,
    fontWeight: "900",
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  optionText: {
    fontSize: 15,
    lineHeight: 21,
  },
});
