import { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Flashcard } from "../../lib/api/learn";
import { colors, radius, spacing } from "../../theme/tokens";
import { Button } from "../ui/Button";
import { GlassCard } from "../ui/GlassCard";

type FlashcardDeckProps = {
  cards: Flashcard[];
  onExit?: () => void;
  onFinished?: (summary: { gotIt: number; needMorePractice: number }) => void;
};

const FLIP_DURATION = 260;
const SWIPE_THRESHOLD = 90;

export function FlashcardDeck({ cards, onExit, onFinished }: FlashcardDeckProps) {
  const [index, setIndex] = useState(0);
  const [gotIt, setGotIt] = useState(0);
  const [needMorePractice, setNeedMorePractice] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const completedRef = useRef(false);
  const translateX = useSharedValue(0);
  const flipProgress = useSharedValue(0);

  const screenWidth = useMemo(() => Dimensions.get("window").width, []);
  const currentCard = cards[index] ?? null;
  const hasCards = cards.length > 0;
  const isComplete = hasCards && index >= cards.length;

  useEffect(() => {
    completedRef.current = false;
    setIndex(0);
    setGotIt(0);
    setNeedMorePractice(0);
    setIsFlipped(false);
    translateX.value = 0;
    flipProgress.value = 0;
  }, [cards, flipProgress, translateX]);

  useEffect(() => {
    if (!isComplete || completedRef.current) return;
    completedRef.current = true;
    onFinished?.({ gotIt, needMorePractice });
  }, [gotIt, isComplete, needMorePractice, onFinished]);

  const goToNextCard = (direction: "known" | "practice") => {
    if (direction === "known") {
      setGotIt((current) => current + 1);
    } else {
      setNeedMorePractice((current) => current + 1);
    }

    setIsFlipped(false);
    flipProgress.value = 0;
    translateX.value = 0;
    setIndex((current) => current + 1);
  };

  const dismissCard = (direction: "known" | "practice") => {
    const targetX = direction === "known" ? screenWidth * 1.2 : -screenWidth * 1.2;
    translateX.value = withTiming(targetX, { duration: 180 }, (finished) => {
      if (finished) {
        runOnJS(goToNextCard)(direction);
      }
    });
  };

  const toggleFlip = () => {
    const nextValue = isFlipped ? 0 : 1;
    setIsFlipped(!isFlipped);
    flipProgress.value = withTiming(nextValue, { duration: FLIP_DURATION });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const resetAndRestart = () => {
    completedRef.current = false;
    setIndex(0);
    setGotIt(0);
    setNeedMorePractice(0);
    setIsFlipped(false);
    translateX.value = withSpring(0);
    flipProgress.value = withSpring(0);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 8 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderMove: (_, gestureState) => {
          translateX.value = gestureState.dx;
        },
        onPanResponderRelease: (_, gestureState) => {
          const { dx } = gestureState;

          if (dx > SWIPE_THRESHOLD) {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            dismissCard("known");
            return;
          }

          if (dx < -SWIPE_THRESHOLD) {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            dismissCard("practice");
            return;
          }

          translateX.value = withSpring(0);
        },
        onPanResponderTerminate: () => {
          translateX.value = withSpring(0);
        },
      }),
    [dismissCard, translateX]
  );

  const animatedCardStyle = useAnimatedStyle(() => {
    const rotation = interpolate(flipProgress.value, [0, 1], [0, 180]);
    const tilt = interpolate(translateX.value, [-screenWidth, 0, screenWidth], [-8, 0, 8]);

    return {
      transform: [
        { perspective: 1400 },
        { translateX: translateX.value },
        { rotateZ: `${tilt}deg` },
        { rotateY: `${rotation}deg` },
      ],
    };
  });

  if (isComplete) {
    return (
      <GlassCard style={styles.summaryCard}>
        <Text style={styles.summaryKicker}>Flashcards complete</Text>
        <Text style={styles.summaryTitle}>You finished this deck.</Text>
        <Text style={styles.summaryCopy}>
          Got it: {gotIt} · Need more practice: {needMorePractice}
        </Text>
        <View style={styles.summaryActions}>
          <Button variant="ghost" onPress={resetAndRestart} style={styles.summaryButton}>
            Restart
          </Button>
          {onExit ? (
            <Button onPress={onExit} style={styles.summaryButton}>
              Back to module
            </Button>
          ) : null}
        </View>
      </GlassCard>
    );
  }

  if (!currentCard) {
    return (
      <GlassCard style={styles.summaryCard}>
        <Text style={styles.summaryKicker}>Flashcards</Text>
        <Text style={styles.summaryTitle}>No cards available.</Text>
        <Text style={styles.summaryCopy}>Try a different chapter or return to the module overview.</Text>
        {onExit ? (
          <Button onPress={onExit} style={styles.summaryButton}>
            Back to module
          </Button>
        ) : null}
      </GlassCard>
    );
  }

  return (
    <View style={styles.deck}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>FLASHCARDS</Text>
          <Text style={styles.progress}>
            {index + 1}/{cards.length}
          </Text>
        </View>
        <Text style={styles.helper}>Tap to flip · Swipe left/right to sort</Text>
      </View>

      <View {...panResponder.panHandlers} style={styles.cardTouchArea}>
        <Pressable accessibilityRole="button" onPress={toggleFlip} style={styles.cardPressable}>
          <Animated.View style={[styles.cardStack, animatedCardStyle]}>
            <View style={[styles.face, styles.frontFace]}>
              <Text style={styles.faceTag}>Front</Text>
              <Text style={styles.faceText}>{currentCard.front}</Text>
              <Text style={styles.faceHint}>Tap to reveal the answer</Text>
            </View>

            <View style={[styles.face, styles.backFace]}>
              <Text style={styles.faceTag}>Back</Text>
              <Text style={styles.faceText}>{currentCard.back}</Text>
              <Text style={styles.faceHint}>Swipe right if you got it</Text>
            </View>
          </Animated.View>
        </Pressable>
      </View>

      <View style={styles.actions}>
        <Button variant="ghost" onPress={() => void dismissCard("practice")} style={styles.actionButton}>
          Need more practice
        </Button>
        <Button onPress={() => void dismissCard("known")} style={styles.actionButton}>
          Got it
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  deck: {
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  kicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  progress: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  helper: {
    flex: 1,
    color: colors.textMuted,
    textAlign: "right",
    lineHeight: 18,
    fontSize: 12,
  },
  cardTouchArea: {
    minHeight: 360,
  },
  cardPressable: {
    flex: 1,
  },
  cardStack: {
    flex: 1,
    minHeight: 360,
  },
  face: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.xl,
    padding: spacing.lg,
    justifyContent: "space-between",
    backfaceVisibility: "hidden",
  },
  frontFace: {
    backgroundColor: colors.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  backFace: {
    backgroundColor: colors.surface3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gold,
    transform: [{ rotateY: "180deg" }],
  },
  faceTag: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  faceText: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "800",
    textAlign: "center",
  },
  faceHint: {
    color: colors.textMuted,
    textAlign: "center",
    fontSize: 12,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  summaryCard: {
    borderRadius: radius.xl,
    gap: spacing.sm,
  },
  summaryKicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  summaryTitle: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
  },
  summaryCopy: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  summaryActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  summaryButton: {
    flex: 1,
  },
});
